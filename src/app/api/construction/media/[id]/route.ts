import { db } from "@/lib/db"
import { getAdmin } from "@/lib/auth/admin"
import { getBuyer } from "@/lib/auth/client"
import { getObject, objectResponse } from "@/lib/storage"

/**
 * Photo ou vidéo du journal de chantier d'un projet (fichier privé) :
 * - administrateurs : toujours
 * - client du projet : si la publication lui est visible
 */
export async function GET(request: Request, ctx: RouteContext<"/api/construction/media/[id]">) {
  const { id } = await ctx.params
  const media = await db.constructionMedia.findUnique({
    where: { id },
    include: { update: { select: { visibleToClient: true, project: { select: { buyerId: true } } } } },
  })
  if (!media) return new Response("Introuvable", { status: 404 })

  let allowed = !!(await getAdmin())
  if (!allowed && media.update.visibleToClient) {
    const buyer = await getBuyer()
    allowed = !!buyer && media.update.project.buyerId === buyer.id
  }
  if (!allowed) return new Response("Accès refusé", { status: 403 })

  const object = await getObject(media.storageKey, request.headers.get("range"))
  if (!object) return new Response("Fichier introuvable", { status: 404 })
  return objectResponse({ ...object, contentType: media.mimeType || object.contentType }, { inline: true, cache: "private, max-age=3600" })
}
