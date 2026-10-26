"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { assertAdmin } from "@/lib/auth/admin"
import { fail, ok, run, UserError, type ActionResult } from "@/lib/action"
import { logActivity } from "@/lib/activity"
import { getSettings } from "@/lib/settings"
import { readFirstSheet } from "@/lib/excel"
import { analyzeImport, FREQUENCIES, importRowSchema, lotSchema, type ImportPreview, type LotInput } from "@/lib/lot-import"

function revalidateLots(id?: string) {
  revalidatePath("/admin/terrains")
  revalidatePath("/admin/plan")
  revalidatePath("/")
  if (id) revalidatePath(`/admin/terrains/${id}`)
}

function round(value: number) {
  return Math.round(value)
}

async function hasLiveSale(lotId: string) {
  return (await db.sale.count({ where: { lotId, status: { not: "CANCELLED" } } })) > 0
}

function uniqueError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new UserError("Ce numéro de terrain existe déjà.")
  }
  throw error
}

export async function createLot(input: LotInput): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const data = lotSchema.parse(input)
    const lot = await db.lot
      .create({
        data: {
          ...data,
          price: data.price == null ? null : round(data.price),
          depositAmount: data.depositAmount == null ? null : round(data.depositAmount),
          installmentAmount: data.installmentAmount == null ? null : round(data.installmentAmount),
          reservedNote: data.status === "RESERVED" ? data.reservedNote : null,
        },
      })
      .catch(uniqueError)
    await logActivity({ type: "lot", message: `Terrain n° ${lot.number} créé`, actorId: admin.id, entityType: "lot", entityId: lot.id })
    revalidateLots()
    return ok({ id: lot.id }, `Terrain n° ${lot.number} créé`)
  })
}

export async function updateLot(id: string, input: LotInput): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const data = lotSchema.parse(input)
    const current = await db.lot.findUnique({ where: { id } })
    if (!current) return fail("Terrain introuvable")
    const locked = await hasLiveSale(id)
    const lot = await db.lot
      .update({
        where: { id },
        data: {
          ...data,
          price: data.price == null ? null : round(data.price),
          depositAmount: data.depositAmount == null ? null : round(data.depositAmount),
          installmentAmount: data.installmentAmount == null ? null : round(data.installmentAmount),
          status: locked ? current.status : data.status,
          reservedNote: !locked && data.status === "RESERVED" ? data.reservedNote : locked ? current.reservedNote : null,
        },
      })
      .catch(uniqueError)
    await logActivity({ type: "lot", message: `Terrain n° ${lot.number} modifié`, actorId: admin.id, entityType: "lot", entityId: lot.id })
    revalidateLots(id)
    return ok({ id: lot.id }, "Terrain enregistré")
  })
}

export async function setLotReservation(id: string, reserved: boolean, note?: string | null): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const lot = await db.lot.findUnique({ where: { id } })
    if (!lot) return fail("Terrain introuvable")
    if (await hasLiveSale(id)) return fail("Ce terrain est déjà attribué à un acheteur.")
    if (reserved && lot.status === "UNAVAILABLE") return fail("Ce terrain n'est pas commercialisé.")
    await db.lot.update({
      where: { id },
      data: reserved ? { status: "RESERVED", reservedNote: note?.trim() || null } : { status: "AVAILABLE", reservedNote: null },
    })
    await logActivity({
      type: "lot",
      message: reserved ? `Option posée sur le terrain n° ${lot.number}` : `Option levée sur le terrain n° ${lot.number}`,
      actorId: admin.id,
      entityType: "lot",
      entityId: id,
    })
    revalidateLots(id)
    return ok(null, reserved ? "Option posée : le terrain apparaît comme réservé" : "Option levée : le terrain est de nouveau disponible")
  })
}

export async function deleteLot(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const lot = await db.lot.findUnique({ where: { id }, include: { _count: { select: { sales: true } } } })
    if (!lot) return fail("Terrain introuvable")
    if (lot._count.sales > 0) return fail("Impossible de supprimer un terrain ayant un historique de vente.")
    await db.lot.delete({ where: { id } })
    await logActivity({ type: "lot", message: `Terrain n° ${lot.number} supprimé`, actorId: admin.id })
    revalidateLots()
    return ok(null, `Terrain n° ${lot.number} supprimé`)
  })
}

// ─────────────────────────────────────────────────────────────
// Actions groupées
// ─────────────────────────────────────────────────────────────

const idsSchema = z.array(z.string().min(1)).min(1, "Aucun terrain sélectionné").max(2000)
const roundingSchema = z.union([z.literal(1), z.literal(1000), z.literal(5000), z.literal(10000), z.literal(50000), z.literal(100000)])

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step
}

const bulkPriceSchema = z.object({
  mode: z.enum(["fixed", "perM2"]),
  value: z.number().positive("Montant invalide"),
  rounding: roundingSchema.default(1000),
  adjustDeposit: z.boolean().default(false),
})

export async function bulkSetPrice(ids: string[], input: z.input<typeof bulkPriceSchema>): Promise<ActionResult<{ updated: number; skipped: number }>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const lotIds = idsSchema.parse(ids)
    const { mode, value, rounding, adjustDeposit } = bulkPriceSchema.parse(input)
    const settings = await getSettings()
    const lots = await db.lot.findMany({ where: { id: { in: lotIds } } })
    let updated = 0
    let skipped = 0
    await db.$transaction(async (tx) => {
      for (const lot of lots) {
        if (lot.status === "SOLD") {
          skipped++
          continue
        }
        const price = roundTo(mode === "fixed" ? value : value * lot.areaM2, rounding)
        let depositAmount = lot.depositAmount
        if (adjustDeposit) {
          const rate = lot.price && lot.depositAmount != null ? lot.depositAmount / lot.price : settings.defaultDepositRate / 100
          depositAmount = roundTo(price * rate, 1000)
        } else if (depositAmount != null && depositAmount > price) {
          depositAmount = price
        }
        await tx.lot.update({ where: { id: lot.id }, data: { price, depositAmount } })
        updated++
      }
    })
    await logActivity({
      type: "lot",
      message: `Prix mis à jour sur ${updated} terrain${updated > 1 ? "s" : ""} (${mode === "perM2" ? `${value} / m²` : `${value}`})`,
      actorId: admin.id,
    })
    revalidateLots()
    return ok(
      { updated, skipped },
      `${updated} terrain${updated > 1 ? "s" : ""} mis à jour${skipped ? ` · ${skipped} vendu${skipped > 1 ? "s" : ""} ignoré${skipped > 1 ? "s" : ""}` : ""}`,
    )
  })
}

const bulkDepositSchema = z.object({
  mode: z.enum(["fixed", "percent", "none"]),
  value: z.number().nonnegative().default(0),
  rounding: roundingSchema.default(1000),
})

export async function bulkSetDeposit(ids: string[], input: z.input<typeof bulkDepositSchema>): Promise<ActionResult<{ updated: number; skipped: number }>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const lotIds = idsSchema.parse(ids)
    const { mode, value, rounding } = bulkDepositSchema.parse(input)
    if (mode === "percent" && value > 100) return fail("Le pourcentage doit être compris entre 0 et 100")
    const lots = await db.lot.findMany({ where: { id: { in: lotIds } } })
    let updated = 0
    let skipped = 0
    await db.$transaction(async (tx) => {
      for (const lot of lots) {
        if (lot.status === "SOLD" || (mode === "percent" && !lot.price)) {
          skipped++
          continue
        }
        let deposit = mode === "none" ? 0 : mode === "fixed" ? value : roundTo(((lot.price ?? 0) * value) / 100, rounding)
        if (lot.price != null) deposit = Math.min(deposit, lot.price)
        await tx.lot.update({ where: { id: lot.id }, data: { depositAmount: Math.round(deposit) } })
        updated++
      }
    })
    await logActivity({ type: "lot", message: `Acompte mis à jour sur ${updated} terrain${updated > 1 ? "s" : ""}`, actorId: admin.id })
    revalidateLots()
    return ok({ updated, skipped }, `${updated} terrain${updated > 1 ? "s" : ""} mis à jour${skipped ? ` · ${skipped} ignoré${skipped > 1 ? "s" : ""}` : ""}`)
  })
}

const bulkPlanSchema = z
  .object({
    installmentsCount: z.number().int().min(0).max(600),
    frequency: z.enum(FREQUENCIES),
    customIntervalDays: z.number().int().min(1).max(730).nullish(),
    installmentAmount: z.number().positive().nullish(),
  })
  .refine((v) => v.frequency !== "CUSTOM" || v.customIntervalDays, { message: "Indiquez l'intervalle en jours", path: ["customIntervalDays"] })

export async function bulkSetPlan(ids: string[], input: z.input<typeof bulkPlanSchema>): Promise<ActionResult<{ updated: number; skipped: number }>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const lotIds = idsSchema.parse(ids)
    const plan = bulkPlanSchema.parse(input)
    const result = await db.lot.updateMany({
      where: { id: { in: lotIds }, status: { not: "SOLD" } },
      data: {
        installmentsCount: plan.installmentsCount,
        frequency: plan.frequency,
        customIntervalDays: plan.frequency === "CUSTOM" ? (plan.customIntervalDays ?? null) : null,
        installmentAmount: plan.installmentAmount ? Math.round(plan.installmentAmount) : null,
      },
    })
    const skipped = lotIds.length - result.count
    await logActivity({ type: "lot", message: `Modalités de paiement mises à jour sur ${result.count} terrain${result.count > 1 ? "s" : ""}`, actorId: admin.id })
    revalidateLots()
    return ok({ updated: result.count, skipped }, `${result.count} terrain${result.count > 1 ? "s" : ""} mis à jour${skipped ? ` · ${skipped} vendu${skipped > 1 ? "s" : ""} ignoré${skipped > 1 ? "s" : ""}` : ""}`)
  })
}

export async function bulkSetStatus(ids: string[], status: "AVAILABLE" | "RESERVED" | "UNAVAILABLE"): Promise<ActionResult<{ updated: number; skipped: number }>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const lotIds = idsSchema.parse(ids)
    const target = z.enum(["AVAILABLE", "RESERVED", "UNAVAILABLE"]).parse(status)
    const withSales = await db.sale.findMany({ where: { lotId: { in: lotIds }, status: { not: "CANCELLED" } }, select: { lotId: true } })
    const locked = new Set(withSales.map((s) => s.lotId))
    const eligible = lotIds.filter((id) => !locked.has(id))
    const result = await db.lot.updateMany({
      where: { id: { in: eligible }, status: { not: "SOLD" } },
      data: { status: target, ...(target !== "RESERVED" ? { reservedNote: null } : {}) },
    })
    const skipped = lotIds.length - result.count
    await logActivity({ type: "lot", message: `Statut modifié sur ${result.count} terrain${result.count > 1 ? "s" : ""}`, actorId: admin.id })
    revalidateLots()
    return ok({ updated: result.count, skipped }, `${result.count} terrain${result.count > 1 ? "s" : ""} mis à jour${skipped ? ` · ${skipped} vendu${skipped > 1 ? "s" : ""} ignoré${skipped > 1 ? "s" : ""}` : ""}`)
  })
}

export async function bulkSetSoilType(ids: string[], soilType: string): Promise<ActionResult<{ updated: number }>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const lotIds = idsSchema.parse(ids)
    const value = z.string().trim().max(80).parse(soilType)
    const result = await db.lot.updateMany({ where: { id: { in: lotIds } }, data: { soilType: value || null } })
    await logActivity({ type: "lot", message: `Type de sol mis à jour sur ${result.count} terrain${result.count > 1 ? "s" : ""}`, actorId: admin.id })
    revalidateLots()
    return ok({ updated: result.count }, `${result.count} terrain${result.count > 1 ? "s" : ""} mis à jour`)
  })
}

export async function bulkDeleteLots(ids: string[]): Promise<ActionResult<{ deleted: number; skipped: number }>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const lotIds = idsSchema.parse(ids)
    const withSales = await db.sale.findMany({ where: { lotId: { in: lotIds } }, select: { lotId: true } })
    const locked = new Set(withSales.map((s) => s.lotId))
    const result = await db.lot.deleteMany({ where: { id: { in: lotIds.filter((id) => !locked.has(id)) } } })
    const skipped = lotIds.length - result.count
    await logActivity({ type: "lot", message: `${result.count} terrain${result.count > 1 ? "s" : ""} supprimé${result.count > 1 ? "s" : ""}`, actorId: admin.id })
    revalidateLots()
    return ok(
      { deleted: result.count, skipped },
      `${result.count} terrain${result.count > 1 ? "s" : ""} supprimé${result.count > 1 ? "s" : ""}${skipped ? ` · ${skipped} conservé${skipped > 1 ? "s" : ""} (historique de vente)` : ""}`,
    )
  })
}

/** Applique les modalités par défaut (paramètres) aux terrains qui n'en ont pas. */
export async function applyDefaultPlanToLots(): Promise<ActionResult<{ updated: number }>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const settings = await getSettings()
    const lots = await db.lot.findMany({
      where: { status: { in: ["AVAILABLE", "RESERVED"] }, price: { not: null }, depositAmount: null, installmentsCount: null, frequency: null },
    })
    await db.$transaction(
      lots.map((lot) =>
        db.lot.update({
          where: { id: lot.id },
          data: {
            depositAmount: lot.price ? roundTo((lot.price * settings.defaultDepositRate) / 100, 1000) : null,
            installmentsCount: settings.defaultInstallments,
            frequency: settings.defaultFrequency,
          },
        }),
      ),
    )
    await logActivity({ type: "lot", message: `Modalités par défaut appliquées à ${lots.length} terrain${lots.length > 1 ? "s" : ""}`, actorId: admin.id })
    revalidateLots()
    return ok({ updated: lots.length }, lots.length ? `Modalités appliquées à ${lots.length} terrain${lots.length > 1 ? "s" : ""}` : "Tous les terrains ont déjà des modalités")
  })
}

// ─────────────────────────────────────────────────────────────
// Import Excel
// ─────────────────────────────────────────────────────────────

export async function previewLotImport(formData: FormData): Promise<ActionResult<ImportPreview>> {
  return run(async () => {
    await assertAdmin("ADMIN")
    const file = formData.get("file")
    if (!(file instanceof File) || file.size === 0) return fail("Sélectionnez un fichier Excel (.xlsx)")
    if (!/\.xlsx$/i.test(file.name)) return fail("Format non pris en charge : utilisez un fichier .xlsx")
    if (file.size > 5 * 1024 * 1024) return fail("Fichier trop volumineux (5 Mo maximum)")
    let sheet
    try {
      sheet = await readFirstSheet(await file.arrayBuffer())
    } catch {
      return fail("Impossible de lire ce fichier. Vérifiez qu'il s'agit bien d'un classeur Excel.")
    }
    if (sheet.rows.length === 0) return fail("Le fichier ne contient aucune ligne de données.")
    const [lots, fields, sales] = await Promise.all([
      db.lot.findMany(),
      db.lotField.findMany(),
      db.sale.findMany({ where: { status: { not: "CANCELLED" } }, select: { lotId: true } }),
    ])
    return ok(analyzeImport(sheet, { lots, fields, lockedLotIds: new Set(sales.map((s) => s.lotId)) }))
  })
}

export async function applyLotImport(rows: unknown[]): Promise<ActionResult<{ created: number; updated: number }>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const parsed = z.array(importRowSchema).max(5000).parse(rows)
    const [existing, sales] = await Promise.all([
      db.lot.findMany({ select: { id: true, number: true, attributes: true } }),
      db.sale.findMany({ where: { status: { not: "CANCELLED" } }, select: { lotId: true } }),
    ])
    const byNumber = new Map(existing.map((l) => [l.number.toLowerCase(), l]))
    const locked = new Set(sales.map((s) => s.lotId))
    let created = 0
    let updated = 0
    await db.$transaction(
      async (tx) => {
        for (const row of parsed) {
          const { number, status, attributes, ...rest } = row
          const current = byNumber.get(number.toLowerCase())
          if (current) {
            const mergedAttributes = { ...((current.attributes as Record<string, unknown>) ?? {}), ...attributes }
            await tx.lot.update({
              where: { id: current.id },
              data: {
                ...rest,
                attributes: mergedAttributes as Prisma.InputJsonValue,
                ...(status && !locked.has(current.id) ? { status, ...(status !== "RESERVED" ? { reservedNote: null } : {}) } : {}),
              },
            })
            updated++
          } else {
            await tx.lot.create({
              data: { number, ...rest, attributes: attributes as Prisma.InputJsonValue, areaM2: rest.areaM2 ?? 0, status: status ?? "AVAILABLE" },
            })
            created++
          }
        }
      },
      { timeout: 60_000 },
    )
    await logActivity({ type: "lot", message: `Import Excel : ${created} terrain${created > 1 ? "s" : ""} créé${created > 1 ? "s" : ""}, ${updated} mis à jour`, actorId: admin.id })
    revalidateLots()
    return ok({ created, updated }, `Import terminé : ${created} création${created > 1 ? "s" : ""}, ${updated} mise${updated > 1 ? "s" : ""} à jour`)
  })
}
