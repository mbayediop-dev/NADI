import type { LotStatus } from "@/generated/prisma/enums"
import { LOT_STATUS } from "@/lib/labels"
import { cn } from "@/lib/utils"

/** Pastille de statut générique (le « tone » provient de lib/labels) */
export function ToneBadge({ tone, children, className, dot = false }: { tone: string; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset",
        tone,
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

export function LotStatusBadge({ status, className }: { status: LotStatus; className?: string }) {
  return (
    <ToneBadge tone={LOT_STATUS[status].tone} className={className} dot>
      {LOT_STATUS[status].label}
    </ToneBadge>
  )
}
