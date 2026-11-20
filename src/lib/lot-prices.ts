import "server-only"
import type { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { siteLotPrice, type SitePricing } from "@/lib/lot-pricing"

type Client = Prisma.TransactionClient

/**
 * Applique prix et acompte à plusieurs terrains en une seule requête (atomique, un seul aller-retour).
 * Une mise à jour par terrain dans une transaction dépasse le délai autorisé dès que la base est distante.
 */
export function updateLotAmounts(rows: { id: string; price: number | null; depositAmount: number | null }[], client: Client = db) {
  return client.$executeRaw`
    UPDATE "Lot" AS l
    SET "price" = v."price", "depositAmount" = v."depositAmount", "updatedAt" = (now() AT TIME ZONE 'UTC')
    FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS v("id" text, "price" double precision, "depositAmount" double precision)
    WHERE l."id" = v."id"`
}

/**
 * Recalcule le prix des terrains qui suivent le prix du site (sans prix particulier, non vendus), éventuellement
 * limité à certains terrains. Un acompte propre au terrain est ramené au prix s'il le dépasse.
 * Deux requêtes quel que soit le nombre de terrains. Renvoie le nombre de prix modifiés.
 */
export async function applySitePricing(pricing: SitePricing, options: { lotIds?: string[]; client?: Client } = {}) {
  if (pricing.pricePerM2 == null) return 0
  const client = options.client ?? db
  const lots = await client.lot.findMany({
    where: { customPrice: false, status: { not: "SOLD" }, ...(options.lotIds ? { id: { in: options.lotIds } } : {}) },
    select: { id: true, areaM2: true, price: true, depositAmount: true },
  })
  const rows = lots.flatMap((lot) => {
    const price = siteLotPrice(lot.areaM2, pricing)
    if (price == null) return []
    const depositAmount = lot.depositAmount != null ? Math.min(lot.depositAmount, price) : null
    return price === lot.price && depositAmount === lot.depositAmount ? [] : [{ id: lot.id, price, depositAmount }]
  })
  if (rows.length > 0) await updateLotAmounts(rows, client)
  return rows.length
}
