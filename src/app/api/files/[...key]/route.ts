import { getObject, objectResponse } from "@/lib/storage"

/** Fichiers publics (photos, vidéos, plan, logo). Les documents privés passent par /api/documents/[id]. */
export async function GET(request: Request, ctx: RouteContext<"/api/files/[...key]">) {
  const { key: parts } = await ctx.params
  const key = parts.map(decodeURIComponent).join("/")
  if (!key.startsWith("public/") || key.includes("..")) {
    return new Response("Introuvable", { status: 404 })
  }
  const object = await getObject(key, request.headers.get("range"))
  if (!object) return new Response("Introuvable", { status: 404 })
  return objectResponse(object)
}
