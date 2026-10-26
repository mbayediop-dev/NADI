import "server-only"
import { db } from "@/lib/db"
import { resolvePlan, summarizeSale } from "@/lib/finance"
import { compareLotNumbers, fullName } from "@/lib/format"
import { parsePolygon } from "@/lib/plan"
import { planDefaults, type AppSettings } from "@/lib/settings"

/** Terrains pour la liste d'administration (avec modalités effectives et acheteur éventuel). */
export async function getAdminLots(settings: AppSettings) {
  const lots = await db.lot.findMany({
    include: {
      sales: {
        where: { status: { not: "CANCELLED" } },
        select: { id: true, reference: true, status: true, buyer: { select: { id: true, firstName: true, lastName: true } } },
        take: 1,
        orderBy: { signedAt: "desc" },
      },
      _count: { select: { requests: { where: { status: { in: ["NEW", "CONTACTED"] } } } } },
    },
  })
  const defaults = planDefaults(settings)
  return lots
    .map((lot) => {
      const sale = lot.sales[0] ?? null
      const plan = resolvePlan(lot, defaults)
      return {
        id: lot.id,
        number: lot.number,
        block: lot.block,
        areaM2: lot.areaM2,
        price: lot.price,
        pricePerM2: lot.price && lot.areaM2 ? lot.price / lot.areaM2 : null,
        status: lot.status,
        depositAmount: lot.depositAmount,
        installmentsCount: lot.installmentsCount,
        frequency: lot.frequency,
        customIntervalDays: lot.customIntervalDays,
        installmentAmount: lot.installmentAmount,
        hasOwnPlan: lot.depositAmount != null || lot.installmentsCount != null || lot.frequency != null,
        soilType: lot.soilType,
        isFeatured: lot.isFeatured,
        hasGeometry: !!parsePolygon(lot.polygon),
        plan,
        sale: sale ? { id: sale.id, reference: sale.reference, status: sale.status, buyerId: sale.buyer.id, buyerName: fullName(sale.buyer) } : null,
        openRequests: lot._count.requests,
      }
    })
    .sort((a, b) => compareLotNumbers(a.number, b.number))
}

export type AdminLotRow = Awaited<ReturnType<typeof getAdminLots>>[number]

export async function getLotFields() {
  return db.lotField.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] })
}

/** Valeurs déjà utilisées (suggestions des formulaires). */
export async function getLotSuggestions() {
  const lots = await db.lot.findMany({ select: { soilType: true, block: true, orientation: true, features: true } })
  const uniq = (values: (string | null | undefined)[]) =>
    [...new Set(values.filter((v): v is string => !!v && v.trim().length > 0))].sort((a, b) => a.localeCompare(b, "fr"))
  return {
    soilTypes: uniq(lots.map((l) => l.soilType)),
    blocks: uniq(lots.map((l) => l.block)),
    orientations: uniq(["Nord", "Sud", "Est", "Ouest", "Nord-Est", "Nord-Ouest", "Sud-Est", "Sud-Ouest", ...lots.map((l) => l.orientation)]),
    features: uniq(lots.flatMap((l) => l.features)),
  }
}

/** Fiche complète d'un terrain (administration). */
export async function getAdminLotDetail(id: string) {
  const lot = await db.lot.findUnique({
    where: { id },
    include: {
      sales: {
        include: {
          buyer: true,
          installments: { select: { index: true, label: true, dueDate: true, amount: true } },
          payments: { select: { amount: true, paidAt: true } },
        },
        orderBy: { signedAt: "desc" },
      },
      requests: { orderBy: { createdAt: "desc" } },
    },
  })
  if (!lot) return null
  return {
    ...lot,
    polygon: parsePolygon(lot.polygon),
    sales: lot.sales.map((sale) => ({ ...sale, summary: summarizeSale(sale) })),
  }
}
