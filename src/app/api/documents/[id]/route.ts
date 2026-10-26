import { db } from "@/lib/db"
import { getAdmin } from "@/lib/auth/admin"
import { getBuyer } from "@/lib/auth/client"
import { getObject, objectResponse } from "@/lib/storage"

/**
 * Téléchargement d'un document avec contrôle d'accès :
 * - PUBLIC : tout le monde
 * - CLIENTS : propriétaires connectés (et administrateurs)
 * - document lié à une vente : l'acheteur concerné (et administrateurs)
 * - PRIVATE : administrateurs uniquement
 */
export async function GET(request: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const { id } = await ctx.params
  const doc = await db.document.findUnique({ where: { id }, include: { sale: { select: { buyerId: true } } } })
  if (!doc) return new Response("Introuvable", { status: 404 })

  let allowed = doc.visibility === "PUBLIC" && !doc.saleId
  if (!allowed) {
    const admin = await getAdmin()
    if (admin) allowed = true
    else if (doc.visibility !== "PRIVATE") {
      const buyer = await getBuyer()
      if (buyer) {
        allowed = doc.sale
          ? doc.sale.buyerId === buyer.id
          : (await db.sale.count({ where: { buyerId: buyer.id, status: { not: "CANCELLED" } } })) > 0
      }
    }
  }
  if (!allowed) return new Response("Accès refusé", { status: 403 })

  const object = await getObject(doc.storageKey, request.headers.get("range"))
  if (!object) return new Response("Fichier introuvable", { status: 404 })
  const download = new URL(request.url).searchParams.has("download")
  return objectResponse(
    { ...object, contentType: doc.mimeType || object.contentType },
    { filename: doc.filename, inline: !download, cache: "private, max-age=300" },
  )
}
