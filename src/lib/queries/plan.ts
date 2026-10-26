import "server-only"
import { connection } from "next/server"
import { db } from "@/lib/db"
import { parsePolygon } from "@/lib/plan"
import { compareLotNumbers } from "@/lib/format"
import type { PlanLot } from "@/components/plan/plan-viewer"
import type { AppSettings } from "@/lib/settings"

/** Terrains au format du plan interactif. Les prix sont masqués si le paramètre l'exige (et pour les lots non disponibles côté public). */
export async function getPlanLots(opts: { settings: AppSettings; audience: "public" | "client" | "admin" }): Promise<PlanLot[]> {
  await connection()
  const lots = await db.lot.findMany({
    select: { id: true, number: true, status: true, polygon: true, areaM2: true, price: true, block: true },
  })
  const showPrice = opts.audience === "admin" || opts.settings.showPricesPublicly
  return lots
    .map((lot) => ({
      id: lot.id,
      number: lot.number,
      status: lot.status,
      polygon: parsePolygon(lot.polygon),
      areaM2: lot.areaM2,
      price: showPrice && (opts.audience === "admin" || lot.status === "AVAILABLE") ? lot.price : null,
      block: lot.block,
    }))
    .sort((a, b) => compareLotNumbers(a.number, b.number))
}

export function planImage(settings: AppSettings) {
  return { imageUrl: settings.planImageUrl, width: settings.planWidth, height: settings.planHeight }
}
