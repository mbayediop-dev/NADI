import { db } from "@/lib/db"
import { getAdmin } from "@/lib/auth/admin"
import { getBuyer } from "@/lib/auth/client"
import { isSignatureKey } from "@/lib/signature"
import { getObject, objectResponse } from "@/lib/storage"

/**
 * Image du cachet et de la signature (reçus), avec contrôle d'accès :
 * - administrateurs : toute image du dossier (aperçu d'un envoi pas encore enregistré dans les paramètres) ;
 * - propriétaires connectés : uniquement l'image en vigueur, celle qui figure sur leurs reçus ;
 * - visiteurs : refus.
 */
export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key") ?? ""
  if (!isSignatureKey(key)) return new Response("Introuvable", { status: 404 })

  if (!(await getAdmin())) {
    const buyer = await getBuyer()
    const current = buyer ? (await db.settings.findUnique({ where: { id: 1 }, select: { signatureKey: true } }))?.signatureKey : null
    if (current !== key) return new Response("Accès refusé", { status: 403 })
  }

  const object = await getObject(key)
  if (!object) return new Response("Introuvable", { status: 404 })
  return objectResponse(object, { cache: "private, max-age=3600" })
}
