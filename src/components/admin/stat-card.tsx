import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
  children,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: LucideIcon
  tone?: "default" | "primary" | "gold" | "success" | "danger" | "warning"
  className?: string
  children?: React.ReactNode
}) {
  const toneClass = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary/10 text-primary",
    gold: "bg-gold/20 text-gold-strong",
    success: "bg-status-available/12 text-status-available-strong",
    danger: "bg-status-sold/12 text-status-sold-strong",
    warning: "bg-status-reserved/15 text-status-reserved-strong",
  }[tone]
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border bg-card p-4 shadow-xs md:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", toneClass)}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight tabular md:text-[1.65rem]">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  )
}
