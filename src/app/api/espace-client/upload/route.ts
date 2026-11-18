import { db } from "@/lib/db"
import { getBuyer } from "@/lib/auth/client"
import { logActivity } from "@/lib/activity"
import { fullName } from "@/lib/format"
import { saveUpload, StorageSetupError } from "@/lib/storage"

// Dépôt d'un document par un client dans son projet de construction (plan souhaité, titre de propriété, pièce d'identité…).
// Le fichier et sa fiche « Document » sont créés ensemble : le client ne peut donc jamais rattacher à son projet
// un fichier qu'il n'a pas lui-même envoyé.

const ALLOWED = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/
const MAX_BYTES = 15 * 1024 * 1024
const MAX_CLIENT_DOCUMENTS = 40

/** multipart/form-data : file, projectId, title (facultatif) → { id } */
export async function POST(request: Request) {
  const buyer = await getBuyer()
  if (!buyer) return Response.json({ error: "Session expirée. Reconnectez-vous." }, { status: 401 })

  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  const projectId = String(form?.get("projectId") ?? "")
  if (!(file instanceof File)) return Response.json({ error: "Aucun fichier reçu" }, { status: 400 })
  if (file.size === 0) return Response.json({ error: "Le fichier est vide" }, { status: 400 })
  if (file.size > MAX_BYTES) return Response.json({ error: "Fichier trop volumineux (15 Mo maximum)" }, { status: 413 })
  if (!ALLOWED.test(file.type)) return Response.json({ error: "Format non accepté : envoyez un PDF, une photo ou un document Word." }, { status: 415 })

  const project = await db.constructionProject.findFirst({
    where: { id: projectId, buyerId: buyer.id, status: { not: "CANCELLED" } },
    select: { id: true, reference: true, _count: { select: { documents: { where: { fromClient: true } } } } },
  })
  if (!project) return Response.json({ error: "Projet introuvable" }, { status: 404 })
  if (project._count.documents >= MAX_CLIENT_DOCUMENTS) {
    return Response.json({ error: "Vous avez atteint le nombre maximal de documents pour ce projet. Contactez-nous pour en ajouter." }, { status: 429 })
  }

  let stored
  try {
    stored = await saveUpload(file, "private", "clients")
  } catch (error) {
    console.error("[client-upload]", error)
    if (error instanceof StorageSetupError) return Response.json({ error: "Le dépôt de documents est momentanément indisponible. Contactez-nous." }, { status: 502 })
    return Response.json({ error: "Le fichier n'a pas pu être enregistré. Réessayez." }, { status: 502 })
  }

  const title = String(form?.get("title") ?? "").trim().slice(0, 160) || file.name.replace(/\.[^.]+$/, "").slice(0, 160) || "Document"
  const doc = await db.document.create({
    data: {
      title,
      category: "OTHER",
      visibility: "CLIENTS",
      constructionProjectId: project.id,
      fromClient: true,
      storageKey: stored.key,
      filename: file.name.slice(0, 200),
      mimeType: stored.contentType,
      size: stored.size,
    },
    select: { id: true },
  })
  await logActivity({
    type: "construction",
    message: `${fullName(buyer)} a déposé un document dans son projet ${project.reference} : « ${title} »`,
    entityType: "construction",
    entityId: project.id,
  })
  return Response.json({ id: doc.id })
}
