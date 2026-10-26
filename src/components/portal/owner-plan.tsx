"use client"

import { LOT_STATUS } from "@/lib/labels"
import { formatArea } from "@/lib/format"
import { PlanLegend, PlanViewer, type PlanLot } from "@/components/plan/plan-viewer"

/** Plan du lotissement avec les terrains du propriétaire mis en évidence. */
export function OwnerPlan({
  imageUrl,
  width,
  height,
  lots,
  ownedIds,
  selectedId,
}: {
  imageUrl: string | null
  width: number
  height: number
  lots: PlanLot[]
  ownedIds: string[]
  selectedId?: string
}) {
  const owned = new Set(ownedIds)
  return (
    <div className="space-y-3">
      <PlanViewer
        imageUrl={imageUrl}
        width={width}
        height={height}
        lots={lots}
        highlightIds={ownedIds}
        selectedId={selectedId}
        isDimmed={(lot) => !owned.has(lot.id)}
        tooltip={(lot) => (
          <div>
            <p className="font-semibold">
              Terrain n° {lot.number}
              {owned.has(lot.id) && <span className="ml-1.5 text-gold-strong">· le vôtre</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatArea(lot.areaM2)} · {LOT_STATUS[lot.status].label}
            </p>
          </div>
        )}
        className="h-[280px] border sm:h-[360px]"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-xs font-semibold">
          <span className="size-3 rounded-[4px] ring-2 ring-gold" />
          Votre terrain
        </span>
        <PlanLegend className="text-muted-foreground" />
      </div>
    </div>
  )
}
