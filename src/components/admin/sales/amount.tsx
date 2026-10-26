import { formatNumber } from "@/lib/format"

/** Montant pour les tuiles : chiffres en avant, unité discrète (évite les retours à la ligne sur mobile). */
export function Amount({ value, currency }: { value: number; currency: string }) {
  return (
    <>
      {formatNumber(value)}
      <span className="text-sm font-semibold text-muted-foreground"> {currency}</span>
    </>
  )
}
