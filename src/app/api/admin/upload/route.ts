import { getAdmin, hasRole } from "@/lib/auth/admin"
import { saveUpload } from "@/lib/storage"

const MAX_BYTES = 250 * 1024 * 1024 // 250 Mo (vidéos)
const ALLOWED = /^(image\/|video\/|application\/pdf|application\/msword|application\/vnd\.openxmlformats|application\/vnd\.ms-excel|text\/csv)/

/**
 * Téléversement d'un fichier par un administrateur.
 * multipart/form-data : file, scope (public|private), folder
 * → { key, url, size, mimeType, filename }
 */
export async function POST(request: Request) {
  const admin = await getAdmin()
  if (!admin || !hasRole(admin, "ADMIN")) return Response.json({ error: "Non autorisé" }, { status: 401 })

  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) return Response.json({ error: "Aucun fichier reçu" }, { status: 400 })
  if (file.size > MAX_BYTES) return Response.json({ error: "Fichier trop volumineux (250 Mo maximum)" }, { status: 413 })
  if (file.type && !ALLOWED.test(file.type)) return Response.json({ error: "Type de fichier non pris en charge" }, { status: 415 })

  const scope = form?.get("scope") === "public" ? "public" : "private"
  const folder = String(form?.get("folder") ?? "divers").replace(/[^a-z0-9-]/gi, "").slice(0, 30) || "divers"
  const stored = await saveUpload(file, scope, folder)
  return Response.json({
    key: stored.key,
    url: scope === "public" ? `/api/files/${stored.key}` : null,
    size: stored.size,
    mimeType: stored.contentType,
    filename: file.name,
  })
}
