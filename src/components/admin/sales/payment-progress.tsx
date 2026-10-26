import { cn } from "@/lib/utils"

/** Barre de progression du paiement (part payée / part en retard). */
export function PaymentProgress({
  progress,
  overdueRatio = 0,
  className,
  size = "sm",
}: {
  progress: number
  overdueRatio?: number
  className?: string
  size?: "sm" | "lg"
}) {
  const paid = Math.max(0, Math.min(1, progress))
  const late = Math.max(0, Math.min(1 - paid, overdueRatio))
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(paid * 100)}
      className={cn("flex w-full overflow-hidden rounded-full bg-muted", size === "lg" ? "h-3 gap-[2px]" : "h-1.5 gap-px", className)}
    >
      <div className={cn("h-full rounded-full", paid >= 1 ? "bg-status-available" : "bg-primary")} style={{ width: `${paid * 100}%` }} />
      {late > 0 && <div className="h-full rounded-full bg-status-sold/80" style={{ width: `${late * 100}%` }} />}
    </div>
  )
}
