"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { assertAdmin } from "@/lib/auth/admin"
import { fail, ok, run, UserError, type ActionResult } from "@/lib/action"
import { logActivity } from "@/lib/activity"
import { buildSchedule, summarizeSale, toDueDate } from "@/lib/finance"
import { formatMoney, fullName } from "@/lib/format"
import { normalizePhone } from "@/lib/phone"
import { nextReceiptNumber, nextSaleReference } from "@/lib/sequences"
import { sendPaymentConfirmation, sendReminder, sendWelcomeSms } from "@/lib/notifications"

type Tx = Prisma.TransactionClient

const FREQUENCIES = ["WEEKLY", "BIWEEKLY", "MONTHLY", "BIMONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "CUSTOM"] as const
const METHODS = ["CASH", "WAVE", "ORANGE_MONEY", "FREE_MONEY", "BANK_TRANSFER", "CHECK", "OTHER"] as const

const dateString = z
  .string()
  .min(1, "Date requise")
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Date invalide")

const amount = z.number({ error: "Montant requis" }).finite().nonnegative()

const planSchema = z
  .object({
    price: z.number({ error: "Prix requis" }).finite().positive("Le prix doit être positif"),
    withDeposit: z.boolean(),
    depositAmount: amount.default(0),
    depositDueDate: dateString,
    installmentsCount: z.number().int().min(0).max(600),
    frequency: z.enum(FREQUENCIES),
    customIntervalDays: z.number().int().min(1).max(3650).nullable().optional(),
    firstDueDate: dateString,
    installmentAmount: z.number().finite().positive().nullable().optional(),
  })
  .superRefine((plan, ctx) => {
    const deposit = plan.withDeposit ? plan.depositAmount : 0
    if (plan.withDeposit && deposit <= 0) ctx.addIssue({ code: "custom", path: ["depositAmount"], message: "Indiquez le montant de l'acompte" })
    if (deposit > plan.price) ctx.addIssue({ code: "custom", path: ["depositAmount"], message: "L'acompte dépasse le prix du terrain" })
    if (deposit < plan.price && plan.installmentsCount < 1)
      ctx.addIssue({ code: "custom", path: ["installmentsCount"], message: "Répartissez le solde en au moins une échéance" })
    if (plan.frequency === "CUSTOM" && !plan.customIntervalDays)
      ctx.addIssue({ code: "custom", path: ["customIntervalDays"], message: "Indiquez l'intervalle en jours" })
  })

function scheduleFrom(plan: z.output<typeof planSchema>) {
  const deposit = plan.withDeposit ? Math.round(plan.depositAmount) : 0
  return buildSchedule({
    price: plan.price,
    depositAmount: deposit,
    depositDueDate: new Date(plan.depositDueDate),
    installmentsCount: deposit >= plan.price ? 0 : plan.installmentsCount,
    frequency: plan.frequency,
    customIntervalDays: plan.customIntervalDays ?? null,
    firstDueDate: new Date(plan.firstDueDate),
    installmentAmount: plan.installmentAmount ?? null,
  })
}

function isUniqueError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

/** Remet le statut de la vente en cohérence avec les versements (ACTIVE ⇄ COMPLETED). */
async function syncSaleStatus(tx: Tx, saleId: string) {
  const sale = await tx.sale.findUnique({ where: { id: saleId }, select: { status: true, price: true, payments: { select: { amount: true } } } })
  if (!sale || sale.status === "CANCELLED") return sale?.status
  const paid = sale.payments.reduce((s, p) => s + p.amount, 0)
  const status = paid >= Math.round(sale.price) ? "COMPLETED" : "ACTIVE"
  if (status !== sale.status) await tx.sale.update({ where: { id: saleId }, data: { status } })
  return status
}

function revalidateSale(saleId?: string, buyerId?: string) {
  revalidatePath("/admin")
  revalidatePath("/admin/ventes")
  revalidatePath("/admin/versements")
  if (saleId) revalidatePath(`/admin/ventes/${saleId}`)
  if (buyerId) revalidatePath(`/admin/acheteurs/${buyerId}`)
}

// ─────────────────────────────────────────────────────────────
// Création d'une vente (attribution d'un terrain)
// ─────────────────────────────────────────────────────────────

const newBuyerSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis").max(80),
  lastName: z.string().trim().min(1, "Nom requis").max(80),
  phone: z.string().trim().min(6, "Téléphone requis"),
  email: z.string().trim().email("E-mail invalide").max(120).optional().or(z.literal("")),
  address: z.string().trim().max(200).optional(),
  city: z.string().trim().max(80).optional(),
  profession: z.string().trim().max(80).optional(),
  idType: z.string().trim().max(40).optional(),
  idNumber: z.string().trim().max(60).optional(),
})

const createSaleSchema = z
  .object({
    lotId: z.string().min(1, "Choisissez un terrain"),
    buyerId: z.string().optional().nullable(),
    newBuyer: newBuyerSchema.optional().nullable(),
    requestId: z.string().optional().nullable(),
    signedAt: dateString,
    notes: z.string().trim().max(2000).optional(),
    collectDeposit: z.object({ method: z.enum(METHODS), reference: z.string().trim().max(80).optional() }).optional().nullable(),
    sendWelcomeSms: z.boolean().default(false),
    plan: planSchema,
  })
  .refine((v) => v.buyerId || v.newBuyer, { path: ["buyerId"], message: "Choisissez ou créez un acheteur" })

export async function createSale(input: z.input<typeof createSaleSchema>): Promise<ActionResult<{ saleId: string; reference: string }>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const data = createSaleSchema.parse(input)
    const schedule = scheduleFrom(data.plan)
    if (schedule.length === 0) return fail("L'échéancier est vide : vérifiez le prix et les modalités.")

    let newBuyerPhone: string | null = null
    if (!data.buyerId && data.newBuyer) {
      newBuyerPhone = normalizePhone(data.newBuyer.phone, env.defaultCountry)
      if (!newBuyerPhone) return fail("Numéro de téléphone invalide", { "newBuyer.phone": "Numéro invalide" })
    }

    const attempt = () =>
      db.$transaction(async (tx) => {
        const lot = await tx.lot.findUnique({ where: { id: data.lotId } })
        if (!lot) throw new UserError("Terrain introuvable")
        if (lot.status !== "AVAILABLE" && lot.status !== "RESERVED")
          throw new UserError(`Le terrain n°${lot.number} n'est pas disponible à la vente.`)
        const existing = await tx.sale.count({ where: { lotId: lot.id, status: { in: ["ACTIVE", "COMPLETED"] } } })
        if (existing > 0) throw new UserError(`Le terrain n°${lot.number} est déjà attribué.`)

        let buyerId = data.buyerId ?? null
        if (buyerId) {
          const buyer = await tx.buyer.findUnique({ where: { id: buyerId }, select: { id: true } })
          if (!buyer) throw new UserError("Acheteur introuvable")
        } else if (data.newBuyer && newBuyerPhone) {
          const found = await tx.buyer.findUnique({ where: { phone: newBuyerPhone }, select: { id: true } })
          if (found) buyerId = found.id
          else {
            const b = data.newBuyer
            const created = await tx.buyer.create({
              data: {
                firstName: b.firstName,
                lastName: b.lastName,
                phone: newBuyerPhone,
                email: b.email || null,
                address: b.address || null,
                city: b.city || null,
                profession: b.profession || null,
                idType: b.idType || null,
                idNumber: b.idNumber || null,
              },
            })
            buyerId = created.id
          }
        }
        if (!buyerId) throw new UserError("Choisissez ou créez un acheteur")

        const deposit = data.plan.withDeposit ? Math.round(data.plan.depositAmount) : 0
        const signedAt = toDueDate(data.signedAt)
        const sale = await tx.sale.create({
          data: {
            reference: await nextSaleReference(tx),
            lotId: lot.id,
            buyerId,
            price: Math.round(data.plan.price),
            depositAmount: deposit,
            depositDueDate: deposit > 0 ? toDueDate(data.plan.depositDueDate) : null,
            installmentsCount: schedule.filter((l) => l.index > 0).length,
            frequency: data.plan.frequency,
            customIntervalDays: data.plan.frequency === "CUSTOM" ? (data.plan.customIntervalDays ?? null) : null,
            firstDueDate: toDueDate(data.plan.firstDueDate),
            signedAt,
            notes: data.notes || null,
            installments: { create: schedule },
          },
        })
        await tx.lot.update({ where: { id: lot.id }, data: { status: "SOLD", reservedNote: null } })

        if (data.requestId) {
          await tx.reservationRequest.updateMany({
            where: { id: data.requestId },
            data: { status: "CONVERTED", buyerId, saleId: sale.id, handledAt: new Date() },
          })
        }

        let paymentId: string | null = null
        if (deposit > 0 && data.collectDeposit) {
          const payment = await tx.payment.create({
            data: {
              saleId: sale.id,
              amount: deposit,
              paidAt: signedAt,
              method: data.collectDeposit.method,
              reference: data.collectDeposit.reference || null,
              note: "Acompte encaissé à la signature",
              receiptNumber: await nextReceiptNumber(tx),
              recordedById: admin.id,
            },
          })
          paymentId = payment.id
          await syncSaleStatus(tx, sale.id)
        }
        return { sale, lot, buyerId, paymentId }
      })

    let result: Awaited<ReturnType<typeof attempt>>
    try {
      result = await attempt()
    } catch (error) {
      if (!isUniqueError(error)) throw error
      result = await attempt()
    }

    const buyer = await db.buyer.findUnique({ where: { id: result.buyerId }, select: { firstName: true, lastName: true } })
    await logActivity({
      type: "sale",
      message: `Terrain n°${result.lot.number} attribué à ${buyer ? fullName(buyer) : "un acheteur"} (${result.sale.reference}, ${formatMoney(result.sale.price)})`,
      actorId: admin.id,
      entityType: "sale",
      entityId: result.sale.id,
    })
    if (data.sendWelcomeSms) await sendWelcomeSms(result.sale.id)
    revalidateSale(result.sale.id, result.buyerId)
    revalidatePath("/admin/terrains")
    revalidatePath("/admin/demandes")
    return ok({ saleId: result.sale.id, reference: result.sale.reference }, `Vente ${result.sale.reference} créée`)
  })
}

// ─────────────────────────────────────────────────────────────
// Versements
// ─────────────────────────────────────────────────────────────

const paymentSchema = z.object({
  amount: z.number({ error: "Montant requis" }).finite().positive("Le montant doit être positif"),
  paidAt: dateString,
  method: z.enum(METHODS),
  reference: z.string().trim().max(80).optional(),
  note: z.string().trim().max(500).optional(),
})

export async function recordPayment(
  saleId: string,
  input: z.input<typeof paymentSchema> & { sendSms?: boolean },
): Promise<ActionResult<{ paymentId: string; receiptNumber: string; completed: boolean }>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const data = paymentSchema.parse(input)
    const amountValue = Math.round(data.amount)

    const attempt = () =>
      db.$transaction(async (tx) => {
        const sale = await tx.sale.findUnique({
          where: { id: saleId },
          include: { payments: { select: { amount: true } }, lot: { select: { number: true } }, buyer: { select: { id: true, firstName: true, lastName: true } } },
        })
        if (!sale) throw new UserError("Vente introuvable")
        if (sale.status === "CANCELLED") throw new UserError("Cette vente est annulée : aucun versement ne peut être enregistré.")
        const paid = sale.payments.reduce((s, p) => s + p.amount, 0)
        const remaining = Math.round(sale.price - paid)
        if (remaining <= 0) throw new UserError("Ce terrain est déjà entièrement payé.")
        if (amountValue > remaining) throw new UserError(`Le montant dépasse le reste à payer (${formatMoney(remaining)}).`)
        const payment = await tx.payment.create({
          data: {
            saleId,
            amount: amountValue,
            paidAt: toDueDate(data.paidAt),
            method: data.method,
            reference: data.reference || null,
            note: data.note || null,
            receiptNumber: await nextReceiptNumber(tx),
            recordedById: admin.id,
          },
        })
        const status = await syncSaleStatus(tx, saleId)
        return { payment, sale, completed: status === "COMPLETED" }
      })

    let result: Awaited<ReturnType<typeof attempt>>
    try {
      result = await attempt()
    } catch (error) {
      if (!isUniqueError(error)) throw error
      result = await attempt()
    }

    await logActivity({
      type: "payment",
      message: `Versement de ${formatMoney(amountValue)} reçu de ${fullName(result.sale.buyer)} (terrain n°${result.sale.lot.number})${result.completed ? " — terrain soldé" : ""}`,
      actorId: admin.id,
      entityType: "payment",
      entityId: result.payment.id,
    })
    let smsWarning: string | undefined
    if (input.sendSms) {
      const sms = await sendPaymentConfirmation(result.payment.id)
      if (!sms.ok) smsWarning = " (SMS non envoyé)"
    }
    revalidateSale(saleId, result.sale.buyer.id)
    return ok(
      { paymentId: result.payment.id, receiptNumber: result.payment.receiptNumber, completed: result.completed },
      `Versement enregistré — reçu ${result.payment.receiptNumber}${smsWarning ?? ""}`,
    )
  })
}

export async function updatePayment(paymentId: string, input: z.input<typeof paymentSchema>): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const data = paymentSchema.parse(input)
    const amountValue = Math.round(data.amount)
    const saleId = await db.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { sale: { include: { payments: { select: { id: true, amount: true } } } } } })
      if (!payment) throw new UserError("Versement introuvable")
      const others = payment.sale.payments.filter((p) => p.id !== paymentId).reduce((s, p) => s + p.amount, 0)
      if (others + amountValue > Math.round(payment.sale.price))
        throw new UserError(`Le total versé dépasserait le prix du terrain (${formatMoney(payment.sale.price)}).`)
      await tx.payment.update({
        where: { id: paymentId },
        data: { amount: amountValue, paidAt: toDueDate(data.paidAt), method: data.method, reference: data.reference || null, note: data.note || null },
      })
      await syncSaleStatus(tx, payment.saleId)
      return payment.saleId
    })
    await logActivity({ type: "payment", message: `Versement modifié (${formatMoney(amountValue)})`, actorId: admin.id, entityType: "payment", entityId: paymentId })
    revalidateSale(saleId)
    return ok(null, "Versement mis à jour")
  })
}

export async function deletePayment(paymentId: string): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const { saleId, payment } = await db.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } })
      if (!payment) throw new UserError("Versement introuvable")
      await tx.payment.delete({ where: { id: paymentId } })
      await syncSaleStatus(tx, payment.saleId)
      return { saleId: payment.saleId, payment }
    })
    await logActivity({
      type: "payment",
      message: `Versement supprimé : ${payment.receiptNumber} (${formatMoney(payment.amount)})`,
      actorId: admin.id,
      entityType: "sale",
      entityId: saleId,
    })
    revalidateSale(saleId)
    return ok(null, "Versement supprimé")
  })
}

// ─────────────────────────────────────────────────────────────
// Échéancier, annulation, relance
// ─────────────────────────────────────────────────────────────

export async function updateSchedule(saleId: string, input: z.input<typeof planSchema>): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const plan = planSchema.parse(input)
    const schedule = scheduleFrom(plan)
    if (schedule.length === 0) return fail("L'échéancier est vide.")
    const sale = await db.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({ where: { id: saleId }, include: { payments: { select: { amount: true } }, lot: { select: { number: true } } } })
      if (!sale) throw new UserError("Vente introuvable")
      if (sale.status === "CANCELLED") throw new UserError("Vente annulée : l'échéancier ne peut plus être modifié.")
      const paid = sale.payments.reduce((s, p) => s + p.amount, 0)
      if (paid > Math.round(plan.price)) throw new UserError(`Le prix ne peut pas être inférieur au total déjà versé (${formatMoney(paid)}).`)
      const deposit = plan.withDeposit ? Math.round(plan.depositAmount) : 0
      await tx.installment.deleteMany({ where: { saleId } })
      await tx.sale.update({
        where: { id: saleId },
        data: {
          price: Math.round(plan.price),
          depositAmount: deposit,
          depositDueDate: deposit > 0 ? toDueDate(plan.depositDueDate) : null,
          installmentsCount: schedule.filter((l) => l.index > 0).length,
          frequency: plan.frequency,
          customIntervalDays: plan.frequency === "CUSTOM" ? (plan.customIntervalDays ?? null) : null,
          firstDueDate: toDueDate(plan.firstDueDate),
          installments: { create: schedule },
        },
      })
      await syncSaleStatus(tx, saleId)
      return sale
    })
    await logActivity({ type: "sale", message: `Échéancier modifié pour la vente ${sale.reference} (terrain n°${sale.lot.number})`, actorId: admin.id, entityType: "sale", entityId: saleId })
    revalidateSale(saleId, sale.buyerId)
    return ok(null, "Échéancier mis à jour")
  })
}

export async function cancelSale(saleId: string, reason: string): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const cleanReason = z.string().trim().min(3, "Indiquez le motif de l'annulation").max(500).parse(reason)
    const sale = await db.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({ where: { id: saleId }, include: { lot: true, buyer: true } })
      if (!sale) throw new UserError("Vente introuvable")
      if (sale.status === "CANCELLED") throw new UserError("Cette vente est déjà annulée.")
      await tx.sale.update({ where: { id: saleId }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: cleanReason } })
      const other = await tx.sale.count({ where: { lotId: sale.lotId, id: { not: saleId }, status: { in: ["ACTIVE", "COMPLETED"] } } })
      if (other === 0 && sale.lot.status === "SOLD") await tx.lot.update({ where: { id: sale.lotId }, data: { status: "AVAILABLE" } })
      return sale
    })
    await logActivity({
      type: "sale",
      message: `Vente ${sale.reference} annulée (${fullName(sale.buyer)}, terrain n°${sale.lot.number}) — ${cleanReason}`,
      actorId: admin.id,
      entityType: "sale",
      entityId: saleId,
    })
    revalidateSale(saleId, sale.buyerId)
    revalidatePath("/admin/terrains")
    return ok(null, `Vente annulée — le terrain n°${sale.lot.number} est de nouveau disponible`)
  })
}

export async function remindSale(saleId: string): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const result = await sendReminder(saleId, admin.id)
    if (!result.ok) return fail(result.error)
    revalidatePath(`/admin/ventes/${saleId}`)
    return ok(null, "Relance envoyée par SMS")
  })
}

export async function updateSaleNotes(saleId: string, notes: string): Promise<ActionResult<null>> {
  return run(async () => {
    await assertAdmin("ADMIN")
    const value = z.string().trim().max(2000).parse(notes)
    await db.sale.update({ where: { id: saleId }, data: { notes: value || null } })
    revalidatePath(`/admin/ventes/${saleId}`)
    return ok(null, "Notes enregistrées")
  })
}

/** Ventes en cours (pour la saisie rapide d'un versement). */
export async function listActiveSalesForPayment(): Promise<ActionResult<{ id: string; reference: string; lotNumber: string; buyerName: string; phone: string; remaining: number; nextDue: number | null }[]>> {
  return run(async () => {
    await assertAdmin("ADMIN")
    const sales = await db.sale.findMany({
      where: { status: "ACTIVE" },
      include: { lot: { select: { number: true } }, buyer: { select: { firstName: true, lastName: true, phone: true } }, installments: true, payments: { select: { amount: true, paidAt: true } } },
    })
    return ok(
      sales
        .map((s) => {
          const summary = summarizeSale(s)
          return {
            id: s.id,
            reference: s.reference,
            lotNumber: s.lot.number,
            buyerName: fullName(s.buyer),
            phone: s.buyer.phone,
            remaining: summary.remaining,
            nextDue: summary.nextDue?.remaining ?? null,
          }
        })
        .sort((a, b) => a.buyerName.localeCompare(b.buyerName, "fr")),
    )
  })
}
