// Utilitaires purs sur les terrains publics (utilisables côté serveur et client)
import type { LotStatus, PaymentFrequency } from "@/generated/prisma/enums"
import type { PaymentPlan } from "@/lib/finance"
import type { PlanLot } from "@/components/plan/plan-viewer"
import { formatArea, formatMoneyCompact } from "@/lib/format"

/** Champ personnalisé affiché publiquement, avec sa valeur pour un terrain */
export type PublicField = { key: string; label: string; value: string }

export type PublicLot = PlanLot & {
  depositAmount: number | null
  installmentsCount: number | null
  frequency: PaymentFrequency | null
  customIntervalDays: number | null
  installmentAmount: number | null
  soilType: string | null
  position: string | null
  orientation: string | null
  frontageM: number | null
  depthM: number | null
  description: string | null
  features: string[]
  fields: PublicField[]
  isFeatured: boolean
  /** Modalités résolues (null si prix masqué ou terrain non disponible) */
  plan: PaymentPlan | null
}

const MONTHS_PER: Partial<Record<PaymentFrequency, number>> = {
  WEEKLY: 12 / 52,
  BIWEEKLY: 12 / 26,
  MONTHLY: 1,
  BIMONTHLY: 2,
  QUARTERLY: 3,
  SEMIANNUAL: 6,
  ANNUAL: 12,
}

/** Équivalent mensuel d'un versement (pour l'accroche « dès X FCFA/mois ») */
export function monthlyEquivalent(plan: PaymentPlan) {
  if (plan.count === 0) return null
  const months = plan.frequency === "CUSTOM" ? (plan.customIntervalDays ?? 30) / 30 : (MONTHS_PER[plan.frequency] ?? 1)
  return plan.perInstallment / months
}

export type LotStats = {
  total: number
  byStatus: Record<LotStatus, number>
  forSale: number
  takenRatio: number
  minPrice: number | null
  minMonthly: number | null
  minArea: number | null
  maxArea: number | null
  blocks: string[]
}

export function computeLotStats(lots: PublicLot[]): LotStats {
  const byStatus: Record<LotStatus, number> = { AVAILABLE: 0, RESERVED: 0, SOLD: 0, UNAVAILABLE: 0 }
  for (const lot of lots) byStatus[lot.status]++
  const forSale = lots.length - byStatus.UNAVAILABLE
  const available = lots.filter((l) => l.status === "AVAILABLE")
  const prices = available.map((l) => l.price).filter((p): p is number => p != null)
  const monthly = available
    .map((l) => (l.plan ? monthlyEquivalent(l.plan) : null))
    .filter((m): m is number => m != null && m > 0)
  const areas = lots.filter((l) => l.status !== "UNAVAILABLE").map((l) => l.areaM2)
  return {
    total: lots.length,
    byStatus,
    forSale,
    takenRatio: forSale > 0 ? (byStatus.SOLD + byStatus.RESERVED) / forSale : 0,
    minPrice: prices.length ? Math.min(...prices) : null,
    minMonthly: monthly.length ? Math.min(...monthly) : null,
    minArea: areas.length ? Math.min(...areas) : null,
    maxArea: areas.length ? Math.max(...areas) : null,
    blocks: [...new Set(lots.map((l) => l.block).filter((b): b is string => !!b))].sort((a, b) => a.localeCompare(b, "fr")),
  }
}

/** Terrains disponibles les plus proches (surface puis prix) d'un terrain donné */
export function similarLots(target: PublicLot, lots: PublicLot[], count = 3) {
  return lots
    .filter((l) => l.id !== target.id && l.status === "AVAILABLE")
    .map((l) => ({
      lot: l,
      score:
        Math.abs(l.areaM2 - target.areaM2) / Math.max(target.areaM2, 1) +
        (target.block && l.block === target.block ? -0.15 : 0) +
        (target.price && l.price ? Math.abs(l.price - target.price) / target.price / 2 : 0),
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, count)
    .map((s) => s.lot)
}

// Tranches de surface et de budget (filtres)
export type Range = { id: string; label: string; min: number; max: number }

export function areaRanges(lots: PublicLot[]): Range[] {
  const values = [...new Set(lots.filter((l) => l.status !== "UNAVAILABLE").map((l) => l.areaM2))].sort((a, b) => a - b)
  if (values.length === 0) return []
  if (values.length <= 6) return values.map((v) => ({ id: `a${v}`, label: formatArea(v), min: v, max: v }))
  const t1 = values[Math.floor(values.length / 3)]
  const t2 = values[Math.floor((2 * values.length) / 3)]
  return [
    { id: "a1", label: `Moins de ${formatArea(t1)}`, min: 0, max: t1 - 0.01 },
    { id: "a2", label: `${formatArea(t1)} à ${formatArea(t2)}`, min: t1, max: t2 - 0.01 },
    { id: "a3", label: `${formatArea(t2)} et plus`, min: t2, max: Infinity },
  ]
}

export function budgetRanges(lots: PublicLot[], currency: string): Range[] {
  const prices = lots.map((l) => l.price).filter((p): p is number => p != null).sort((a, b) => a - b)
  if (prices.length < 3) return []
  const round = (v: number) => Math.round(v / 500_000) * 500_000
  const t1 = round(prices[Math.floor(prices.length / 3)])
  const t2 = round(prices[Math.floor((2 * prices.length) / 3)])
  if (t1 >= t2) return []
  return [
    { id: "b1", label: `Jusqu'à ${formatMoneyCompact(t1, currency)}`, min: 0, max: t1 },
    { id: "b2", label: `${formatMoneyCompact(t1, currency)} à ${formatMoneyCompact(t2, currency)}`, min: t1 + 1, max: t2 },
    { id: "b3", label: `Plus de ${formatMoneyCompact(t2, currency)}`, min: t2 + 1, max: Infinity },
  ]
}

