// Prix du m² du site (module pur, utilisable côté client et serveur).
// Un terrain « suit le prix du site » quand un prix du m² est défini (Settings.lotPricePerM2) et qu'il n'a pas de
// prix particulier (Lot.customPrice) : son prix vaut surface × prix du m², arrondi. Les terrains vendus ne changent
// jamais de prix (le prix convenu est porté par la vente).
import { z } from "zod"

export const PRICE_ROUNDINGS = [
  { value: 1, label: "Aucun arrondi" },
  { value: 1000, label: "Au millier (1 000)" },
  { value: 5000, label: "À 5 000" },
  { value: 10000, label: "À 10 000" },
  { value: 50000, label: "À 50 000" },
  { value: 100000, label: "À 100 000" },
] as const

export const roundingSchema = z.union([z.literal(1), z.literal(1000), z.literal(5000), z.literal(10000), z.literal(50000), z.literal(100000)])

export type SitePricing = { pricePerM2: number | null; rounding: number }

export function roundTo(value: number, step: number) {
  return Math.round(value / step) * step
}

export function sitePricing(settings: { lotPricePerM2: number | null; lotPriceRounding: number }): SitePricing {
  return { pricePerM2: settings.lotPricePerM2 && settings.lotPricePerM2 > 0 ? settings.lotPricePerM2 : null, rounding: settings.lotPriceRounding || 1 }
}

/** Prix d'un terrain au prix du site (null si aucun prix du m² n'est défini ou surface inconnue). */
export function siteLotPrice(areaM2: number | null | undefined, pricing: SitePricing): number | null {
  if (pricing.pricePerM2 == null || !areaM2 || areaM2 <= 0) return null
  return roundTo(areaM2 * pricing.pricePerM2, pricing.rounding)
}

/** Le terrain suit-il automatiquement le prix du site ? */
export function followsSitePrice(lot: { customPrice: boolean; status: string }, pricing: SitePricing) {
  return pricing.pricePerM2 != null && !lot.customPrice && lot.status !== "SOLD"
}

export function roundingLabel(step: number) {
  return PRICE_ROUNDINGS.find((r) => r.value === step)?.label.toLowerCase() ?? `à ${step}`
}
