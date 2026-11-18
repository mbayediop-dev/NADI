"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import type { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { assertAdmin } from "@/lib/auth/admin"
import { fail, ok, run, UserError, type ActionResult } from "@/lib/action"
import { logActivity } from "@/lib/activity"
import { DEFAULT_PHASES, isUnderContract, quoteItemSchema, quoteTotal } from "@/lib/construction"
import { createConstructionProject, isUniqueError, respondToQuote } from "@/lib/construction-service"
import { toDueDate } from "@/lib/finance"
import { formatMoney, fullName } from "@/lib/format"
import { CONSTRUCTION_STATUS } from "@/lib/labels"
import { normalizePhone } from "@/lib/phone"
import { nextConstructionReceiptNumber, nextQuoteNumber } from "@/lib/sequences"
import { getSettings } from "@/lib/settings"
import { sendSms } from "@/lib/sms"
import { deleteObject } from "@/lib/storage"

const METHODS = ["CASH", "WAVE", "ORANGE_MONEY", "FREE_MONEY", "BANK_TRANSFER", "CHECK", "OTHER"] as const
const STATUSES = ["REQUESTED", "STUDY", "OFFER_SENT", "SIGNED", "IN_PROGRESS", "SUSPENDED", "DELIVERED", "CANCELLED"] as const
const LAND_ORIGINS = ["COMPANY_LOT", "OWN_LAND", "NO_LAND"] as const

const dateString = z
  .string()
  .min(1, "Date requise")
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Date invalide")
const optionalDate = z
  .string()
  .optional()
  .nullable()
  .refine((v) => !v || !Number.isNaN(new Date(v).getTime()), "Date invalide")
const optionalText = (max: number) => z.string().trim().max(max).optional().nullable()
const optionalAmount = z.number().finite().nonnegative().optional().nullable()

function revalidateProject(projectId?: string) {
  revalidatePath("/admin")
  revalidatePath("/admin/construction")
  revalidatePath("/admin/depenses")
  if (projectId) revalidatePath(`/admin/construction/${projectId}`)
}

// ─────────────────────────────────────────────────────────────
// Projet
// ─────────────────────────────────────────────────────────────

const newBuyerSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis").max(80),
  lastName: z.string().trim().min(1, "Nom requis").max(80),
  phone: z.string().trim().min(6, "Téléphone requis"),
  email: z.string().trim().email("E-mail invalide").max(120).optional().or(z.literal("")),
})

const landSchema = z.object({
  landOrigin: z.enum(LAND_ORIGINS),
  lotId: z.string().optional().nullable(),
  landAddress: optionalText(200),
  landAreaM2: z.number().finite().positive().max(1_000_000).optional().nullable(),
  landReference: optionalText(120),
})

const houseSchema = z.object({
  title: z.string().trim().min(3, "Donnez un intitulé au projet").max(140),
  houseModelId: z.string().optional().nullable(),
  customPlan: z.boolean().default(false),
  requirements: optionalText(3000),
  budget: optionalAmount,
})

const createSchema = landSchema
  .extend(houseSchema.shape)
  .extend({
    buyerId: z.string().optional().nullable(),
    newBuyer: newBuyerSchema.optional().nullable(),
    withDefaultPhases: z.boolean().default(true),
  })
  .refine((v) => v.buyerId || v.newBuyer, { path: ["buyerId"], message: "Choisissez ou créez un client" })
  .refine((v) => v.landOrigin !== "COMPANY_LOT" || !!v.lotId, { path: ["lotId"], message: "Choisissez le terrain du lotissement" })

function landData(data: z.output<typeof landSchema>) {
  return {
    landOrigin: data.landOrigin,
    lotId: data.landOrigin === "COMPANY_LOT" ? (data.lotId ?? null) : null,
    landAddress: data.landOrigin === "OWN_LAND" ? data.landAddress || null : null,
    landAreaM2: data.landOrigin === "OWN_LAND" ? (data.landAreaM2 ?? null) : null,
    landReference: data.landOrigin === "OWN_LAND" ? data.landReference || null : null,
  }
}

/** Trouve l'acheteur portant ce téléphone, sinon le crée. */
async function findOrCreateBuyer(input: z.output<typeof newBuyerSchema>) {
  const phone = normalizePhone(input.phone, env.defaultCountry)
  if (!phone) throw new UserError("Numéro de téléphone invalide. Vérifiez l'indicatif et le numéro.")
  const existing = await db.buyer.findUnique({ where: { phone } })
  if (existing) return existing
  return db.buyer.create({ data: { firstName: input.firstName, lastName: input.lastName, phone, email: input.email || null } })
}

/** Ouvre un projet de construction pour un client (existant ou nouveau). */
export async function createProject(input: z.input<typeof createSchema>): Promise<ActionResult<{ projectId: string; reference: string }>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const data = createSchema.parse(input)
    const buyer = data.buyerId ? await db.buyer.findUnique({ where: { id: data.buyerId } }) : await findOrCreateBuyer(data.newBuyer!)
    if (!buyer) return fail("Client introuvable")
    if (data.landOrigin === "COMPANY_LOT" && !(await db.lot.findUnique({ where: { id: data.lotId! }, select: { id: true } }))) return fail("Terrain introuvable")

    const project = await createConstructionProject({
      ...landData(data),
      title: data.title,
      status: "STUDY",
      source: "ADMIN",
      buyerId: buyer.id,
      contactName: fullName(buyer),
      contactPhone: buyer.phone,
      contactEmail: buyer.email,
      houseModelId: data.houseModelId || null,
      customPlan: data.customPlan,
      requirements: data.requirements || null,
      budget: data.budget ?? null,
    })
    if (data.withDefaultPhases) {
      await db.constructionPhase.createMany({ data: DEFAULT_PHASES.map((p, i) => ({ projectId: project.id, title: p.title, weight: p.weight, sortOrder: i })) })
    }
    await logActivity({
      type: "construction",
      message: `Projet de construction ${project.reference} ouvert pour ${fullName(buyer)} : « ${project.title} »`,
      actorId: admin.id,
      entityType: "construction",
      entityId: project.id,
    })
    revalidateProject(project.id)
    return ok({ projectId: project.id, reference: project.reference }, `Projet ${project.reference} créé`)
  })
}

const updateSchema = landSchema.extend(houseSchema.shape).extend({
  contractAmount: optionalAmount,
  startDate: optionalDate,
  plannedEndDate: optionalDate,
  showExpensesToClient: z.boolean(),
})

export async function updateProject(projectId: string, input: z.input<typeof updateSchema>): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const data = updateSchema.parse(input)
    if (data.landOrigin === "COMPANY_LOT" && !data.lotId) return fail("Choisissez le terrain du lotissement", { lotId: "Terrain requis" })
    const paid = await db.constructionPayment.aggregate({ where: { projectId }, _sum: { amount: true } })
    const totalPaid = paid._sum.amount ?? 0
    if (totalPaid > 0 && (data.contractAmount == null || data.contractAmount < totalPaid)) {
      return fail(`Le montant du contrat ne peut pas être inférieur à ce qui a déjà été versé (${formatMoney(totalPaid)}).`)
    }
    const project = await db.constructionProject.update({
      where: { id: projectId },
      data: {
        ...landData(data),
        title: data.title,
        houseModelId: data.houseModelId || null,
        customPlan: data.customPlan,
        requirements: data.requirements || null,
        budget: data.budget ?? null,
        contractAmount: data.contractAmount ?? null,
        startDate: data.startDate ? toDueDate(data.startDate) : null,
        plannedEndDate: data.plannedEndDate ? toDueDate(data.plannedEndDate) : null,
        showExpensesToClient: data.showExpensesToClient,
      },
    })
    await logActivity({ type: "construction", message: `Projet ${project.reference} modifié`, actorId: admin.id, entityType: "construction", entityId: projectId })
    revalidateProject(projectId)
    return ok(null, "Projet enregistré")
  })
}

export async function updateProjectNotes(projectId: string, notes: string): Promise<ActionResult<null>> {
  return run(async () => {
    await assertAdmin("ADMIN")
    await db.constructionProject.update({ where: { id: projectId }, data: { notes: notes.trim().slice(0, 4000) || null } })
    revalidateProject(projectId)
    return ok(null, "Notes enregistrées")
  })
}

/** Change l'étape du projet (étude, chantier en cours, livraison, sans suite…). */
export async function setProjectStatus(projectId: string, status: (typeof STATUSES)[number], reason?: string): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const next = z.enum(STATUSES).parse(status)
    const project = await db.constructionProject.findUnique({ where: { id: projectId }, select: { reference: true, status: true, startDate: true, contractAmount: true } })
    if (!project) return fail("Projet introuvable")
    if (project.status === next) return ok(null)
    if (isUnderContract(next) && !project.contractAmount) {
      return fail("Indiquez d'abord le montant du contrat (acceptez une offre ou saisissez-le dans « Modifier le projet »).")
    }
    const now = new Date()
    await db.constructionProject.update({
      where: { id: projectId },
      data: {
        status: next,
        ...(next === "IN_PROGRESS" && !project.startDate ? { startDate: toDueDate(now) } : {}),
        ...(next === "DELIVERED" ? { deliveredAt: now } : { deliveredAt: null }),
        ...(next === "CANCELLED" ? { cancelledAt: now, cancelReason: reason?.trim().slice(0, 500) || null } : { cancelledAt: null, cancelReason: null }),
      },
    })
    await logActivity({
      type: "construction",
      message: `Projet ${project.reference} : ${CONSTRUCTION_STATUS[project.status].label} → ${CONSTRUCTION_STATUS[next].label}`,
      actorId: admin.id,
      entityType: "construction",
      entityId: projectId,
    })
    revalidateProject(projectId)
    return ok(null, `Projet passé à « ${CONSTRUCTION_STATUS[next].label} »`)
  })
}

/** Rattache une demande à un client (existant par son téléphone, sinon créé) : il accède alors à son espace client. */
export async function attachBuyer(projectId: string, input: z.input<typeof newBuyerSchema>): Promise<ActionResult<{ buyerId: string }>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const buyer = await findOrCreateBuyer(newBuyerSchema.parse(input))
    const project = await db.constructionProject.update({
      where: { id: projectId },
      data: { buyerId: buyer.id, contactName: fullName(buyer), contactPhone: buyer.phone, contactEmail: buyer.email },
    })
    await logActivity({
      type: "construction",
      message: `Projet ${project.reference} rattaché au client ${fullName(buyer)}`,
      actorId: admin.id,
      entityType: "construction",
      entityId: projectId,
    })
    revalidateProject(projectId)
    return ok({ buyerId: buyer.id }, `${fullName(buyer)} peut maintenant suivre son projet dans l'espace client`)
  })
}

/** Supprime un projet sans mouvement d'argent (demande saisie par erreur). Les fichiers associés sont effacés. */
export async function deleteProject(projectId: string): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const project = await db.constructionProject.findUnique({
      where: { id: projectId },
      select: {
        reference: true,
        _count: { select: { payments: true, expenses: true } },
        documents: { select: { storageKey: true } },
        updates: { select: { media: { select: { storageKey: true } } } },
      },
    })
    if (!project) return fail("Projet introuvable")
    if (project._count.payments > 0 || project._count.expenses > 0) {
      return fail("Ce projet a des versements ou des dépenses : classez-le « sans suite » plutôt que de le supprimer.")
    }
    await db.constructionProject.delete({ where: { id: projectId } })
    const keys = [...project.documents.map((d) => d.storageKey), ...project.updates.flatMap((u) => u.media.map((m) => m.storageKey))]
    await Promise.all(keys.map((key) => deleteObject(key).catch(() => undefined)))
    await logActivity({ type: "construction", message: `Projet de construction ${project.reference} supprimé`, actorId: admin.id })
    revalidateProject()
    return ok(null, "Projet supprimé")
  })
}

// ─────────────────────────────────────────────────────────────
// Offres (devis)
// ─────────────────────────────────────────────────────────────

const quoteSchema = z.object({
  id: z.string().optional().nullable(),
  title: z.string().trim().min(3, "Intitulé requis").max(160),
  items: z.array(quoteItemSchema).min(1, "Ajoutez au moins une ligne").max(200),
  notes: optionalText(3000),
  validUntil: optionalDate,
})

export async function saveQuote(projectId: string, input: z.input<typeof quoteSchema>): Promise<ActionResult<{ quoteId: string }>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const data = quoteSchema.parse(input)
    const values = {
      title: data.title,
      items: data.items as Prisma.InputJsonValue,
      amount: quoteTotal(data.items),
      notes: data.notes || null,
      validUntil: data.validUntil ? toDueDate(data.validUntil) : null,
    }
    if (data.id) {
      const existing = await db.constructionQuote.findUnique({ where: { id: data.id }, select: { status: true, projectId: true } })
      if (!existing || existing.projectId !== projectId) return fail("Offre introuvable")
      if (existing.status === "ACCEPTED") return fail("Une offre acceptée ne se modifie plus : créez une nouvelle offre (avenant).")
      await db.constructionQuote.update({ where: { id: data.id }, data: values })
      revalidateProject(projectId)
      return ok({ quoteId: data.id }, "Offre enregistrée")
    }
    const attempt = () => db.$transaction(async (tx) => tx.constructionQuote.create({ data: { ...values, projectId, number: await nextQuoteNumber(tx) } }))
    let quote: Awaited<ReturnType<typeof attempt>>
    try {
      quote = await attempt()
    } catch (error) {
      if (!isUniqueError(error)) throw error
      quote = await attempt()
    }
    await logActivity({
      type: "construction",
      message: `Offre ${quote.number} préparée (${formatMoney(quote.amount)})`,
      actorId: admin.id,
      entityType: "construction",
      entityId: projectId,
    })
    revalidateProject(projectId)
    return ok({ quoteId: quote.id }, `Offre ${quote.number} enregistrée en brouillon`)
  })
}

/** Rend l'offre visible du client dans son espace (et le prévient par SMS si demandé). */
export async function sendQuote(quoteId: string, notify: boolean): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const quote = await db.constructionQuote.findUnique({
      where: { id: quoteId },
      include: { project: { select: { id: true, status: true, reference: true, buyerId: true, contactPhone: true } } },
    })
    if (!quote) return fail("Offre introuvable")
    if (quote.status !== "DRAFT") return fail("Cette offre a déjà été envoyée.")
    await db.$transaction([
      db.constructionQuote.update({ where: { id: quoteId }, data: { status: "SENT", sentAt: new Date() } }),
      db.constructionProject.updateMany({ where: { id: quote.projectId, status: { in: ["REQUESTED", "STUDY"] } }, data: { status: "OFFER_SENT" } }),
    ])
    let warning = ""
    if (notify) {
      const settings = await getSettings()
      const sms = await sendSms(
        quote.project.contactPhone,
        `${settings.companyName} : votre offre de construction ${quote.number} (${formatMoney(quote.amount, settings.currencyLabel)}) est disponible${quote.project.buyerId ? ` dans votre espace client : ${env.appUrl}/espace-client/construction` : ". Nous vous contactons pour vous la présenter."}`,
        "MANUAL",
      )
      if (!sms.ok) warning = " (SMS non envoyé)"
    }
    await logActivity({
      type: "construction",
      message: `Offre ${quote.number} envoyée au client (projet ${quote.project.reference})`,
      actorId: admin.id,
      entityType: "construction",
      entityId: quote.projectId,
    })
    revalidateProject(quote.projectId)
    return ok(null, `Offre envoyée${warning}`)
  })
}

/** Réponse du client saisie par l'administration (accord donné de vive voix, contrat signé sur papier…). */
export async function answerQuote(quoteId: string, accepted: boolean): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const quote = await respondToQuote(quoteId, accepted)
    await logActivity({
      type: "construction",
      message: `Offre ${quote.number} ${accepted ? `acceptée — contrat de ${formatMoney(quote.amount)}` : "refusée"} (projet ${quote.project.reference})`,
      actorId: admin.id,
      entityType: "construction",
      entityId: quote.projectId,
    })
    revalidateProject(quote.projectId)
    return ok(null, accepted ? "Offre acceptée : le montant du contrat est fixé" : "Offre classée refusée")
  })
}

export async function deleteQuote(quoteId: string): Promise<ActionResult<null>> {
  return run(async () => {
    await assertAdmin("ADMIN")
    const quote = await db.constructionQuote.findUnique({ where: { id: quoteId }, select: { status: true, projectId: true } })
    if (!quote) return fail("Offre introuvable")
    if (quote.status === "ACCEPTED") return fail("Une offre acceptée ne peut pas être supprimée.")
    await db.constructionQuote.delete({ where: { id: quoteId } })
    revalidateProject(quote.projectId)
    return ok(null, "Offre supprimée")
  })
}

// ─────────────────────────────────────────────────────────────
// Étapes du chantier
// ─────────────────────────────────────────────────────────────

export async function addDefaultPhases(projectId: string): Promise<ActionResult<null>> {
  return run(async () => {
    await assertAdmin("ADMIN")
    const count = await db.constructionPhase.count({ where: { projectId } })
    if (count > 0) return fail("Ce projet a déjà des étapes.")
    await db.constructionPhase.createMany({ data: DEFAULT_PHASES.map((p, i) => ({ projectId, title: p.title, weight: p.weight, sortOrder: i })) })
    revalidateProject(projectId)
    return ok(null, "Étapes types ajoutées")
  })
}

const phaseSchema = z.object({
  id: z.string().optional().nullable(),
  title: z.string().trim().min(2, "Intitulé requis").max(140),
  description: optionalText(1000),
  weight: z.number().int().min(0).max(100),
  progress: z.number().int().min(0).max(100),
  startDate: optionalDate,
  endDate: optionalDate,
})

function phaseStatus(progress: number) {
  return progress >= 100 ? ("DONE" as const) : progress > 0 ? ("IN_PROGRESS" as const) : ("PLANNED" as const)
}

export async function savePhase(projectId: string, input: z.input<typeof phaseSchema>): Promise<ActionResult<null>> {
  return run(async () => {
    await assertAdmin("ADMIN")
    const data = phaseSchema.parse(input)
    const values = {
      title: data.title,
      description: data.description || null,
      weight: data.weight,
      progress: data.progress,
      status: phaseStatus(data.progress),
      startDate: data.startDate ? toDueDate(data.startDate) : null,
      endDate: data.endDate ? toDueDate(data.endDate) : null,
    }
    if (data.id) {
      const updated = await db.constructionPhase.updateMany({ where: { id: data.id, projectId }, data: values })
      if (updated.count === 0) return fail("Étape introuvable")
    } else {
      const last = await db.constructionPhase.findFirst({ where: { projectId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } })
      await db.constructionPhase.create({ data: { ...values, projectId, sortOrder: (last?.sortOrder ?? -1) + 1 } })
    }
    revalidateProject(projectId)
    return ok(null, "Étape enregistrée")
  })
}

/** Met à jour l'avancement d'une étape (0 à 100 %) ; son statut en découle. */
export async function setPhaseProgress(phaseId: string, progress: number): Promise<ActionResult<null>> {
  return run(async () => {
    await assertAdmin("ADMIN")
    const value = z.number().int().min(0).max(100).parse(Math.round(progress))
    const phase = await db.constructionPhase.update({ where: { id: phaseId }, data: { progress: value, status: phaseStatus(value) }, select: { projectId: true } })
    revalidateProject(phase.projectId)
    return ok(null)
  })
}

/** Échange la position de deux étapes voisines. */
export async function movePhase(phaseId: string, direction: "up" | "down"): Promise<ActionResult<null>> {
  return run(async () => {
    await assertAdmin("ADMIN")
    const phase = await db.constructionPhase.findUnique({ where: { id: phaseId }, select: { projectId: true } })
    if (!phase) return fail("Étape introuvable")
    const phases = await db.constructionPhase.findMany({ where: { projectId: phase.projectId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } })
    const from = phases.findIndex((p) => p.id === phaseId)
    const to = direction === "up" ? from - 1 : from + 1
    if (to < 0 || to >= phases.length) return ok(null)
    const order = phases.map((p) => p.id)
    ;[order[from], order[to]] = [order[to], order[from]]
    // Une seule requête pour renuméroter toutes les étapes
    await db.$executeRaw`
      UPDATE "ConstructionPhase" AS p SET "sortOrder" = v.pos
      FROM (SELECT * FROM unnest(${order}::text[]) WITH ORDINALITY AS t(id, pos)) AS v
      WHERE p.id = v.id`
    revalidateProject(phase.projectId)
    return ok(null)
  })
}

export async function deletePhase(phaseId: string): Promise<ActionResult<null>> {
  return run(async () => {
    await assertAdmin("ADMIN")
    const phase = await db.constructionPhase.delete({ where: { id: phaseId }, select: { projectId: true } })
    revalidateProject(phase.projectId)
    return ok(null, "Étape supprimée")
  })
}

// ─────────────────────────────────────────────────────────────
// Appels de fonds (échéancier) et versements
// ─────────────────────────────────────────────────────────────

const scheduleSchema = z
  .array(
    z.object({
      label: z.string().trim().min(2, "Intitulé requis").max(120),
      dueDate: dateString,
      amount: z.number({ error: "Montant requis" }).finite().positive("Montant requis"),
    }),
  )
  .max(60)

/** Remplace l'échéancier des appels de fonds (les versements déjà reçus restent imputés dans l'ordre des échéances). */
export async function saveSchedule(projectId: string, input: z.input<typeof scheduleSchema>): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const lines = scheduleSchema.parse(input)
    const project = await db.constructionProject.findUnique({ where: { id: projectId }, select: { reference: true } })
    if (!project) return fail("Projet introuvable")
    await db.$transaction([
      db.constructionInstallment.deleteMany({ where: { projectId } }),
      db.constructionInstallment.createMany({
        data: lines.map((l, index) => ({ projectId, index, label: l.label, dueDate: toDueDate(l.dueDate), amount: Math.round(l.amount) })),
      }),
    ])
    await logActivity({
      type: "construction",
      message: `Échéancier du projet ${project.reference} mis à jour (${lines.length} appel${lines.length > 1 ? "s" : ""} de fonds)`,
      actorId: admin.id,
      entityType: "construction",
      entityId: projectId,
    })
    revalidateProject(projectId)
    return ok(null, "Échéancier enregistré")
  })
}

const paymentSchema = z.object({
  amount: z.number({ error: "Montant requis" }).finite().positive("Montant requis"),
  paidAt: dateString,
  method: z.enum(METHODS),
  reference: optionalText(80),
  note: optionalText(500),
})

export async function recordConstructionPayment(
  projectId: string,
  input: z.input<typeof paymentSchema> & { sendSms?: boolean },
): Promise<ActionResult<{ paymentId: string; receiptNumber: string }>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const data = paymentSchema.parse(input)
    const amountValue = Math.round(data.amount)

    const attempt = () =>
      db.$transaction(async (tx) => {
        const project = await tx.constructionProject.findUnique({
          where: { id: projectId },
          select: { reference: true, status: true, contractAmount: true, contactName: true, contactPhone: true, payments: { select: { amount: true } } },
        })
        if (!project) throw new UserError("Projet introuvable")
        if (!isUnderContract(project.status)) throw new UserError("Un versement ne peut être reçu qu'après l'acceptation de l'offre.")
        const paid = project.payments.reduce((s, p) => s + p.amount, 0)
        const remaining = Math.round((project.contractAmount ?? 0) - paid)
        if (project.contractAmount && amountValue > remaining) {
          throw new UserError(remaining <= 0 ? "Le contrat est déjà entièrement payé." : `Le montant dépasse le reste à payer (${formatMoney(remaining)}).`)
        }
        const payment = await tx.constructionPayment.create({
          data: {
            projectId,
            amount: amountValue,
            paidAt: toDueDate(data.paidAt),
            method: data.method,
            reference: data.reference || null,
            note: data.note || null,
            receiptNumber: await nextConstructionReceiptNumber(tx),
            recordedById: admin.id,
          },
        })
        return { payment, project, remaining: remaining - amountValue }
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
      message: `Versement de ${formatMoney(amountValue)} reçu de ${result.project.contactName} (construction ${result.project.reference})`,
      actorId: admin.id,
      entityType: "construction",
      entityId: projectId,
    })
    let warning = ""
    if (input.sendSms) {
      const settings = await getSettings()
      const sms = await sendSms(
        result.project.contactPhone,
        `${settings.companyName} : nous avons bien reçu ${formatMoney(amountValue, settings.currencyLabel)} pour votre construction (reçu ${result.payment.receiptNumber}).${result.project.contractAmount ? ` Reste à payer : ${formatMoney(Math.max(0, result.remaining), settings.currencyLabel)}.` : ""} Merci.`,
        "PAYMENT",
      )
      if (!sms.ok) warning = " (SMS non envoyé)"
    }
    revalidateProject(projectId)
    return ok({ paymentId: result.payment.id, receiptNumber: result.payment.receiptNumber }, `Versement enregistré — reçu ${result.payment.receiptNumber}${warning}`)
  })
}

export async function updateConstructionPayment(paymentId: string, input: z.input<typeof paymentSchema>): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const data = paymentSchema.parse(input)
    const amountValue = Math.round(data.amount)
    const current = await db.constructionPayment.findUnique({
      where: { id: paymentId },
      include: { project: { select: { contractAmount: true, payments: { select: { id: true, amount: true } } } } },
    })
    if (!current) return fail("Versement introuvable")
    const others = current.project.payments.filter((p) => p.id !== paymentId).reduce((s, p) => s + p.amount, 0)
    if (current.project.contractAmount && others + amountValue > Math.round(current.project.contractAmount)) {
      return fail(`Le total versé dépasserait le montant du contrat (${formatMoney(current.project.contractAmount)}).`)
    }
    await db.constructionPayment.update({
      where: { id: paymentId },
      data: { amount: amountValue, paidAt: toDueDate(data.paidAt), method: data.method, reference: data.reference || null, note: data.note || null },
    })
    await logActivity({
      type: "payment",
      message: `Versement ${current.receiptNumber} modifié (${formatMoney(amountValue)})`,
      actorId: admin.id,
      entityType: "construction",
      entityId: current.projectId,
    })
    revalidateProject(current.projectId)
    return ok(null, "Versement modifié")
  })
}

export async function deleteConstructionPayment(paymentId: string): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const payment = await db.constructionPayment.delete({ where: { id: paymentId } })
    await logActivity({
      type: "payment",
      message: `Versement supprimé : ${payment.receiptNumber} (${formatMoney(payment.amount)})`,
      actorId: admin.id,
      entityType: "construction",
      entityId: payment.projectId,
    })
    revalidateProject(payment.projectId)
    return ok(null, "Versement supprimé")
  })
}

// ─────────────────────────────────────────────────────────────
// Journal de chantier (texte, photos et vidéos)
// ─────────────────────────────────────────────────────────────

const mediaSchema = z.object({
  key: z.string().startsWith("private/"),
  mimeType: z.string().min(1),
  size: z.number().int().nonnegative(),
  caption: optionalText(160),
})

const updateEntrySchema = z.object({
  id: z.string().optional().nullable(),
  title: z.string().trim().min(2, "Titre requis").max(160),
  body: z.string().trim().max(4000).default(""),
  phaseId: z.string().optional().nullable(),
  visibleToClient: z.boolean().default(true),
  publishedAt: dateString,
  /** Nouveaux fichiers téléversés (les médias déjà enregistrés sont conservés) */
  media: z.array(mediaSchema).max(30).default([]),
})

export async function saveConstructionUpdate(projectId: string, input: z.input<typeof updateEntrySchema>): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const data = updateEntrySchema.parse(input)
    const values = {
      title: data.title,
      body: data.body,
      phaseId: data.phaseId || null,
      visibleToClient: data.visibleToClient,
      publishedAt: toDueDate(data.publishedAt),
    }
    let updateId = data.id ?? null
    if (updateId) {
      const updated = await db.constructionUpdate.updateMany({ where: { id: updateId, projectId }, data: values })
      if (updated.count === 0) return fail("Publication introuvable")
    } else {
      updateId = (await db.constructionUpdate.create({ data: { ...values, projectId }, select: { id: true } })).id
    }
    if (data.media.length) {
      const offset = await db.constructionMedia.count({ where: { updateId } })
      await db.constructionMedia.createMany({
        data: data.media.map((m, i) => ({
          updateId: updateId!,
          type: m.mimeType.startsWith("video/") ? ("VIDEO" as const) : ("IMAGE" as const),
          storageKey: m.key,
          mimeType: m.mimeType,
          size: m.size,
          caption: m.caption || null,
          sortOrder: offset + i,
        })),
      })
    }
    if (!data.id) {
      await logActivity({ type: "construction", message: `Journal de chantier : « ${data.title} »`, actorId: admin.id, entityType: "construction", entityId: projectId })
    }
    revalidateProject(projectId)
    return ok(null, data.id ? "Publication modifiée" : "Publication ajoutée au journal")
  })
}

export async function deleteConstructionUpdate(updateId: string): Promise<ActionResult<null>> {
  return run(async () => {
    await assertAdmin("ADMIN")
    const update = await db.constructionUpdate.findUnique({ where: { id: updateId }, select: { projectId: true, media: { select: { storageKey: true } } } })
    if (!update) return fail("Publication introuvable")
    await db.constructionUpdate.delete({ where: { id: updateId } })
    await Promise.all(update.media.map((m) => deleteObject(m.storageKey).catch(() => undefined)))
    revalidateProject(update.projectId)
    return ok(null, "Publication supprimée")
  })
}

export async function deleteConstructionMedia(mediaId: string): Promise<ActionResult<null>> {
  return run(async () => {
    await assertAdmin("ADMIN")
    const media = await db.constructionMedia.findUnique({ where: { id: mediaId }, select: { storageKey: true, update: { select: { projectId: true } } } })
    if (!media) return fail("Fichier introuvable")
    await db.constructionMedia.delete({ where: { id: mediaId } })
    await deleteObject(media.storageKey).catch(() => undefined)
    revalidateProject(media.update.projectId)
    return ok(null, "Fichier supprimé")
  })
}

// ─────────────────────────────────────────────────────────────
// Listes de choix du formulaire de projet
// ─────────────────────────────────────────────────────────────

/** Terrains du lotissement attribués à un client (ventes non annulées) : proposés en premier pour construire. */
export async function listBuyerLots(buyerId: string): Promise<ActionResult<{ id: string; number: string; block: string | null; areaM2: number }[]>> {
  return run(async () => {
    await assertAdmin("VIEWER")
    const sales = await db.sale.findMany({
      where: { buyerId, status: { not: "CANCELLED" } },
      select: { lot: { select: { id: true, number: true, block: true, areaM2: true } } },
    })
    return ok(sales.map((s) => s.lot))
  })
}
