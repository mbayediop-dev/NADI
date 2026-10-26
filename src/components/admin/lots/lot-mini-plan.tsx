"use client"

import Link from "next/link"
import { Map } from "lucide-react"
import { PlanViewer, type PlanLot } from "@/components/plan/plan-viewer"
import { Button } from "@/components/ui/button"

/** Plan centré sur un terrain (fiche terrain) */
export function LotMiniPlan({
  lotId,
  lots,
  imageUrl,
  width,
  height,
  hasGeometry,
}: {
  lotId: string
  lots: PlanLot[]
  imageUrl: string | null
  width: number
  height: number
  hasGeometry: boolean
}) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Map className="size-4 text-primary" />
          Emplacement
        </p>
        <Button variant="ghost" size="sm" asChild>
          <Link href={hasGeometry ? `/admin/plan?lot=${lotId}` : `/admin/plan?edit=1&lot=${lotId}`}>{hasGeometry ? "Ouvrir le plan" : "Dessiner"}</Link>
        </Button>
      </div>
      {hasGeometry ? (
        <PlanViewer
          imageUrl={imageUrl}
          width={width}
          height={height}
          lots={lots}
          selectedId={lotId}
          focusSelected
          isDimmed={(l) => l.id !== lotId}
          className="h-72 rounded-none"
        />
      ) : (
        <div className="grid h-48 place-items-center px-6 text-center text-sm text-muted-foreground">
          Ce terrain n&apos;est pas encore dessiné sur le plan du site.
        </div>
      )}
    </div>
  )
}
