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
import { roundingSchema, roundTo, siteLotPrice, sitePricing, type SitePricing } from "@/lib/lot-pricing"
import { MONTHS_PER_PERIOD } from "@/lib/finance"
import { FREQUENCY } from "@/lib/labels"
import { applySitePricing, updateLotAmounts } from "@/lib/lot-prices"

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

/**
 * Prix enregistré pour un terrain : celui du site (surface × prix du m²) s'il le suit, sinon le prix saisi.
 * Un terrain vendu garde son prix (`keep`). L'acompte ne peut pas dépasser le prix retenu.
 */
function lotPrice(data: { areaM2: number; price: number | null; customPrice: boolean; depositAmount: number | null }, pricing: SitePricing, keep?: number | null) {
  const follows = pricing.pricePerM2 != null && !data.customPrice
  const price = follows ? (keep !== undefined ? keep : siteLotPrice(data.areaM2, pricing)) : data.price == null ? null : round(data.price)
  if (price != null && data.depositAmount != null && data.depositAmount > price) throw new UserError("L'acompte ne peut pas dépasser le prix du terrain.")
  return price
}

export async function createLot(input: LotInput): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const data = lotSchema.parse(input)
    const pricing = sitePricing(await getSettings())
    const lot = await db.lot
      .create({
        data: {
          ...data,
          price: lotPrice(data, pricing),
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
    const pricing = sitePricing(await getSettings())
    const lot = await db.lot
      .update({
        where: { id },
        data: {
          ...data,
          // Terrain vendu : le prix du site ne s'applique plus (le prix convenu est dans la vente)
          price: lotPrice(data, pricing, locked || current.status === "SOLD" ? current.price : undefined),
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
// Conditions de vente du site : prix du m², caution par défaut, durée du paiement du solde
// ─────────────────────────────────────────────────────────────

const siteTermsSchema = z.object({
  pricePerM2: z.number().positive("Indiquez un prix du m²").max(100_000_000, "Montant trop élevé").nullable(),
  rounding: roundingSchema.default(1000),
  depositRate: z.number({ error: "Indiquez la caution" }).min(0, "La caution ne peut pas être négative").max(100, "La caution ne peut pas dépasser 100 %"),
  durationMonths: z.number({ error: "Indiquez la durée" }).int("Durée en mois entiers").min(1, "Au moins 1 mois").max(600, "Durée trop longue"),
  frequency: z.enum(["MONTHLY", "BIMONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"]),
})

export type SiteTermsInput = z.input<typeof siteTermsSchema>

/**
 * Enregistre les conditions de vente du site et recalcule aussitôt le prix des terrains qui suivent le prix du site
 * (ni prix particulier, ni vendus). Caution et durée sont les modalités par défaut (Settings.defaultDepositRate,
 * defaultInstallments, defaultFrequency) : elles s'appliquent d'elles-mêmes aux terrains sans modalités propres.
 * Retirer le prix du m² (`null`) laisse les prix actuels en place.
 */
export async function setSiteTerms(input: SiteTermsInput): Promise<ActionResult<{ updated: number }>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const { pricePerM2, rounding, depositRate, durationMonths, frequency } = siteTermsSchema.parse(input)
    const months = MONTHS_PER_PERIOD[frequency] ?? 1
    if (durationMonths % months !== 0) {
      return fail(`Avec des versements ${FREQUENCY[frequency].label.toLowerCase()}s, la durée doit être un multiple de ${months} mois.`)
    }
    const pricing = { pricePerM2: pricePerM2 == null ? null : Math.round(pricePerM2), rounding }
    const data = {
      lotPricePerM2: pricing.pricePerM2,
      lotPriceRounding: rounding,
      defaultDepositRate: Math.round(depositRate * 100) / 100,
      defaultInstallments: durationMonths / months,
      defaultFrequency: frequency,
    }
    const updated = await db.$transaction(async (tx) => {
      await tx.settings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data })
      return applySitePricing(pricing, { client: tx })
    })
    const settings = await getSettings()
    const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n)
    await logActivity({
      type: "settings",
      message: `Conditions de vente du site : ${
        pricing.pricePerM2 == null ? "sans prix du m²" : `${fmt(pricing.pricePerM2)} ${settings.currencyLabel}/m² (${updated} terrain${updated > 1 ? "s" : ""} recalculé${updated > 1 ? "s" : ""})`
      }, caution ${fmt(data.defaultDepositRate)} %, solde sur ${durationMonths} mois`,
      actorId: admin.id,
    })
    revalidateLots()
    revalidatePath("/admin/parametres")
    return ok(
      { updated },
      pricing.pricePerM2 != null && updated > 0
        ? `Conditions enregistrées : ${updated} prix de terrain mis à jour`
        : "Conditions de vente enregistrées",
    )
  })
}

// ─────────────────────────────────────────────────────────────
// Actions groupées
// ─────────────────────────────────────────────────────────────

const idsSchema = z.array(z.string().min(1)).min(1, "Aucun terrain sélectionné").max(2000)

/** Remet des terrains au prix du site (retire leur prix particulier) et recalcule leur prix. */
export async function bulkUseSitePrice(ids: string[]): Promise<ActionResult<{ updated: number; skipped: number }>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const lotIds = idsSchema.parse(ids)
    const pricing = sitePricing(await getSettings())
    if (pricing.pricePerM2 == null) return fail("Définissez d'abord le prix du m² du site.")
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.lot.updateMany({ where: { id: { in: lotIds }, status: { not: "SOLD" } }, data: { customPrice: false } })
      await applySitePricing(pricing, { lotIds, client: tx })
      return result.count
    })
    const skipped = lotIds.length - updated
    await logActivity({ type: "lot", message: `${updated} terrain${updated > 1 ? "s" : ""} remis au prix du site`, actorId: admin.id })
    revalidateLots()
    return ok(
      { updated, skipped },
      `${updated} terrain${updated > 1 ? "s" : ""} au prix du site${skipped ? ` · ${skipped} vendu${skipped > 1 ? "s" : ""} ignoré${skipped > 1 ? "s" : ""}` : ""}`,
    )
  })
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
    const lots = await db.lot.findMany({ where: { id: { in: lotIds } }, select: { id: true, status: true, areaM2: true, price: true, depositAmount: true } })
    const rows: { id: string; price: number; depositAmount: number | null }[] = []
    let skipped = 0
    for (const lot of lots) {
      if (lot.status === "SOLD") {
        skipped++
        continue
      }
      const price = roundTo(mode === "fixed" ? value : value * lot.areaM2, rounding)
      let depositAmount = lot.depositAmount
      if (adjustDeposit) {
        const rate = lot.price && lot.depositAmount != null ? lot.depositAmount / lot.price : settings.defaultDepositRate / 100
        depositAmount = Math.min(price, roundTo(price * rate, 1000))
      } else if (depositAmount != null && depositAmount > price) {
        depositAmount = price
      }
      rows.push({ id: lot.id, price, depositAmount })
    }
    // Avec un prix du m² du site, un prix posé à la main devient un prix particulier (sinon le prochain recalcul l'écraserait)
    const custom = sitePricing(settings).pricePerM2 != null
    if (rows.length > 0) {
      await db.$transaction([
        updateLotAmounts(rows),
        ...(custom ? [db.lot.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { customPrice: true } })] : []),
      ])
    }
    const updated = rows.length
    await logActivity({
      type: "lot",
      message: `Prix mis à jour sur ${updated} terrain${updated > 1 ? "s" : ""} (${mode === "perM2" ? `${value} / m²` : `${value}`})${custom ? " — prix particuliers" : ""}`,
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
    const lots = await db.lot.findMany({ where: { id: { in: lotIds } }, select: { id: true, status: true, price: true } })
    const rows: { id: string; price: number | null; depositAmount: number }[] = []
    let skipped = 0
    for (const lot of lots) {
      if (lot.status === "SOLD" || (mode === "percent" && !lot.price)) {
        skipped++
        continue
      }
      let deposit = mode === "none" ? 0 : mode === "fixed" ? value : roundTo(((lot.price ?? 0) * value) / 100, rounding)
      if (lot.price != null) deposit = Math.min(deposit, lot.price)
      rows.push({ id: lot.id, price: lot.price, depositAmount: Math.round(deposit) })
    }
    if (rows.length > 0) await updateLotAmounts(rows)
    const updated = rows.length
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
    const [existing, sales, settings] = await Promise.all([
      db.lot.findMany({ select: { id: true, number: true, attributes: true } }),
      db.sale.findMany({ where: { status: { not: "CANCELLED" } }, select: { lotId: true } }),
      getSettings(),
    ])
    // Avec un prix du m² du site : un prix donné dans le fichier devient un prix particulier ; les autres terrains
    // (nouveaux sans prix, surfaces modifiées) sont recalculés au prix du site à la fin de l'import.
    const pricing = sitePricing(settings)
    const customOf = (price: number | null | undefined) => (pricing.pricePerM2 != null && typeof price === "number" ? { customPrice: true } : {})
    const byNumber = new Map(existing.map((l) => [l.number.toLowerCase(), l]))
    const locked = new Set(sales.map((s) => s.lotId))
    const creates: Prisma.LotCreateManyInput[] = []
    const updates: Prisma.LotUpdateArgs[] = []
    const seen = new Set<string>()
    for (const row of parsed) {
      const { number, status, attributes, ...rest } = row
      const key = number.toLowerCase()
      if (seen.has(key)) throw new UserError(`Le terrain n° ${number} figure plusieurs fois dans le fichier.`)
      seen.add(key)
      const current = byNumber.get(key)
      if (current) {
        const mergedAttributes = { ...((current.attributes as Record<string, unknown>) ?? {}), ...attributes }
        updates.push({
          where: { id: current.id },
          data: {
            ...rest,
            ...customOf(rest.price),
            attributes: mergedAttributes as Prisma.InputJsonValue,
            ...(status && !locked.has(current.id) ? { status, ...(status !== "RESERVED" ? { reservedNote: null } : {}) } : {}),
          },
        })
      } else {
        creates.push({ number, ...rest, ...customOf(rest.price), attributes: attributes as Prisma.InputJsonValue, areaM2: rest.areaM2 ?? 0, status: status ?? "AVAILABLE" })
      }
    }
    const created = creates.length
    const updated = updates.length
    await db.$transaction(
      async (tx) => {
        // Créations en une seule requête ; les mises à jour (valeurs propres à chaque ligne) restent unitaires
        if (creates.length > 0) await tx.lot.createMany({ data: creates })
        for (const update of updates) await tx.lot.update(update)
        await applySitePricing(pricing, { client: tx })
      },
      { timeout: 60_000 + updates.length * 500 },
    )
    await logActivity({ type: "lot", message: `Import Excel : ${created} terrain${created > 1 ? "s" : ""} créé${created > 1 ? "s" : ""}, ${updated} mis à jour`, actorId: admin.id })
    revalidateLots()
    return ok({ created, updated }, `Import terminé : ${created} création${created > 1 ? "s" : ""}, ${updated} mise${updated > 1 ? "s" : ""} à jour`)
  })
}
