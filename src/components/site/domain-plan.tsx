"use client"

import { useRouter } from "next/navigation"
import { Map } from "lucide-react"
import { formatArea, formatMoney } from "@/lib/format"
import { LOT_STATUS } from "@/lib/labels"
import { PlanViewer, type PlanLot } from "@/components/plan/plan-viewer"

const STATUSES = ["AVAILABLE", "RESERVED", "SOLD"] as const

// Couleurs du fond de plan de démonstration (public/plan/site-plan.svg)
const DEMO_PLAN_LEGEND = [
  { label: "Espaces verts", color: "#b9d49d" },
  { label: "Voiries", color: "#cfd3d1" },
]

/** Plan interactif de la section « Le domaine » : un clic ouvre la fiche du terrain. */
export function DomainPlan({
  imageUrl,
  width,
  height,
  lots,
  currency,
  caption,
}: {
  imageUrl: string | null
  width: number
  height: number
  lots: PlanLot[]
  currency: string
  /** Sous-titre de l'étiquette (ex. « 4 ha – 120 terrains ») */
  caption: string
}) {
  const router = useRouter()
  const legend = [
    ...STATUSES.map((status) => ({ label: LOT_STATUS[status].label, color: LOT_STATUS[status].color })),
    ...(imageUrl?.endsWith("/plan/site-plan.svg") ? DEMO_PLAN_LEGEND : []),
  ]
  return (
    <div className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-[0_30px_70px_-35px_rgb(0_0_0/0.45)]">
      <PlanViewer
        imageUrl={imageUrl}
        width={width}
        height={height}
        lots={lots}
        onSelect={(lot) => router.push(`/terrains?lot=${encodeURIComponent(lot.number)}`)}
        tooltip={(lot) => (
          <div className="space-y-0.5">
            <p className="font-semibold">Lot {lot.number}</p>
            <p className="text-xs text-muted-foreground">
              {LOT_STATUS[lot.status].label} · {formatArea(lot.areaM2)}
            </p>
            {lot.price != null && <p className="text-xs font-semibold tabular">{formatMoney(lot.price, currency)}</p>}
          </div>
        )}
        className="h-[380px] sm:h-[470px] lg:h-[560px]"
      >
        <div className="pointer-events-none absolute top-3 left-3 z-10 flex items-center gap-2.5 rounded-md bg-pine-deep/92 py-2 pr-4 pl-2 text-white shadow-md backdrop-blur sm:top-4 sm:left-4">
          <span className="grid size-9 place-items-center rounded-md bg-white/12">
            <Map className="size-4" />
          </span>
          <span>
            <span className="block text-[0.8rem] leading-tight font-semibold">Plan général du domaine</span>
            <span className="block text-[0.7rem] text-white/70">{caption}</span>
          </span>
        </div>
        <ul className="pointer-events-none absolute bottom-3 left-3 z-10 flex max-w-[calc(100%-5.5rem)] flex-wrap gap-x-3 gap-y-1 rounded-md bg-background/95 px-3 py-2 text-xs font-medium shadow-md backdrop-blur sm:top-4 sm:right-4 sm:bottom-auto sm:left-auto sm:max-w-none sm:flex-col sm:gap-1.5 sm:px-3.5 sm:py-3 sm:text-[0.8rem]">
          {legend.map((item) => (
            <li key={item.label} className="flex items-center gap-2">
              <span className="size-3 rounded-full sm:size-3.5" style={{ background: item.color }} />
              {item.label}
            </li>
          ))}
        </ul>
      </PlanViewer>
    </div>
  )
}
