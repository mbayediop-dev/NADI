import { Maximize2, Star } from "lucide-react"
import { formatArea, formatMoney, formatMoneyCompact } from "@/lib/format"
import { cn } from "@/lib/utils"
import { LotStatusBadge } from "@/components/shared/badges"
import { monthlyEquivalent, type PublicLot } from "@/components/site/lot-utils"

/** Carte compacte d'un terrain (liste, suggestions). */
export function LotCard({
  lot,
  currency,
  selected,
  onSelect,
  compact = false,
  className,
}: {
  lot: PublicLot
  currency: string
  selected?: boolean
  onSelect?: () => void
  compact?: boolean
  className?: string
}) {
  const monthly = lot.plan ? monthlyEquivalent(lot.plan) : null
  const taken = lot.status !== "AVAILABLE"
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative flex w-full flex-col rounded-lg border bg-card p-4 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        selected && "border-primary ring-2 ring-primary/20",
        taken && "bg-muted/40",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-md font-display text-lg font-semibold tabular",
            taken ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground",
          )}
        >
          {lot.number}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-bold">
            <span className="truncate">Terrain n° {lot.number}</span>
            {lot.isFeatured && !taken && <Star className="size-3.5 shrink-0 fill-gold text-gold" aria-label="Coup de cœur" />}
          </p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {lot.block ? `Îlot ${lot.block} · ` : ""}
            <Maximize2 className="size-3" />
            {formatArea(lot.areaM2)}
          </p>
        </div>
        <LotStatusBadge status={lot.status} className="h-5 px-2 text-[0.68rem]" />
      </div>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-dashed pt-3">
        {lot.price != null ? (
          <p className="text-base font-extrabold whitespace-nowrap tabular">
            {compact ? formatMoneyCompact(lot.price, currency) : formatMoney(lot.price, currency)}
          </p>
        ) : (
          <p className="text-sm font-semibold text-muted-foreground">{taken ? "Indisponible" : "Prix sur demande"}</p>
        )}
        {monthly && (
          <p className="text-xs font-semibold whitespace-nowrap text-primary tabular">
            dès {formatMoney(Math.round(monthly / 1000) * 1000, currency)} / mois
          </p>
        )}
      </div>
    </button>
  )
}
