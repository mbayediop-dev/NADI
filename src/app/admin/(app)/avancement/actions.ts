"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { assertAdmin } from "@/lib/auth/admin"
import { fail, ok, run, type ActionResult } from "@/lib/action"
import { logActivity } from "@/lib/activity"
import { deleteObject } from "@/lib/storage"
import { toDueDate } from "@/lib/finance"

function refresh() {
  revalidatePath("/admin/avancement")
  revalidatePath("/")
  revalidatePath("/espace-client", "layout")
}

const dateInput = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullish()
  .transform((v) => (v ? toDueDate(new Date(`${v}T12:00:00`)) : null))

// ─────────────────────────────────────────────────────────────
// Étapes
// ─────────────────────────────────────────────────────────────

const milestoneSchema = z.object({
  title: z.string().trim().min(2, "Titre requis").max(120),
  description: z.string().trim().max(600).nullish().transform((v) => v || null),
  progress: z.number().int().min(0).max(100),
  status: z.enum(["PLANNED", "IN_PROGRESS", "DONE"]),
  startDate: dateInput,
  endDate: dateInput,
})

export type MilestoneInput = z.input<typeof milestoneSchema>

export async function saveMilestone(id: string | null, input: MilestoneInput): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const data = milestoneSchema.parse(input)
    if (data.startDate && data.endDate && data.endDate < data.startDate) return fail("La date de fin précède la date de début", { endDate: "Date invalide" })
    let milestone
    if (id) {
      milestone = await db.milestone.update({ where: { id }, data })
    } else {
      const last = await db.milestone.aggregate({ _max: { sortOrder: true } })
      milestone = await db.milestone.create({ data: { ...data, sortOrder: (last._max.sortOrder ?? -1) + 1 } })
    }
    await logActivity({
      type: "milestone",
      message: id ? `Étape « ${milestone.title} » mise à jour (${milestone.progress} %)` : `Étape « ${milestone.title} » ajoutée`,
      actorId: admin.id,
      entityType: "milestone",
      entityId: milestone.id,
    })
    refresh()
    return ok({ id: milestone.id }, id ? "Étape mise à jour" : "Étape ajoutée")
  })
}

export async function deleteMilestone(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const milestone = await db.milestone.delete({ where: { id } })
    await logActivity({ type: "milestone", message: `Étape « ${milestone.title} » supprimée`, actorId: admin.id })
    refresh()
    return ok(null, "Étape supprimée")
  })
}

export async function moveMilestone(id: string, direction: -1 | 1): Promise<ActionResult<null>> {
  return run(async () => {
    await assertAdmin("ADMIN")
    const all = await db.milestone.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } })
    const index = all.findIndex((m) => m.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= all.length) return ok(null)
    const order = all.map((m) => m.id)
    ;[order[index], order[target]] = [order[target], order[index]]
    await db.$transaction(order.map((mid, i) => db.milestone.update({ where: { id: mid }, data: { sortOrder: i } })))
    refresh()
    return ok(null)
  })
}

// ─────────────────────────────────────────────────────────────
// Actualités
// ─────────────────────────────────────────────────────────────

const updateSchema = z.object({
  title: z.string().trim().min(3, "Titre requis").max(160),
  body: z.string().trim().min(1, "Rédigez le contenu de l'actualité").max(8000),
  visibility: z.enum(["PUBLIC", "CLIENTS", "PRIVATE"]),
  milestoneId: z.string().nullish().transform((v) => v || null),
  pinned: z.boolean().default(false),
  publishedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .transform((v) => new Date(`${v}T09:00:00`)),
})

export type SiteUpdateInput = z.input<typeof updateSchema>

export async function saveSiteUpdate(id: string | null, input: SiteUpdateInput): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const data = updateSchema.parse(input)
    const update = id ? await db.siteUpdate.update({ where: { id }, data }) : await db.siteUpdate.create({ data })
    if (data.pinned) await db.siteUpdate.updateMany({ where: { id: { not: update.id }, pinned: true }, data: { pinned: false } })
    await logActivity({
      type: "update",
      message: id ? `Actualité modifiée : « ${update.title} »` : `Actualité publiée : « ${update.title} »`,
      actorId: admin.id,
      entityType: "update",
      entityId: update.id,
    })
    refresh()
    return ok({ id: update.id }, id ? "Actualité enregistrée" : "Actualité créée — ajoutez maintenant photos et vidéos")
  })
}

export async function deleteSiteUpdate(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const update = await db.siteUpdate.findUnique({ where: { id }, include: { media: true } })
    if (!update) return fail("Actualité introuvable")
    await db.siteUpdate.delete({ where: { id } })
    await Promise.all(update.media.map((m) => deleteObject(m.storageKey)))
    await logActivity({ type: "update", message: `Actualité supprimée : « ${update.title} »`, actorId: admin.id })
    refresh()
    return ok(null, "Actualité supprimée")
  })
}

// ─────────────────────────────────────────────────────────────
// Médias
// ─────────────────────────────────────────────────────────────

/** Convertit un lien YouTube / Vimeo en adresse intégrable. */
function toEmbedUrl(raw: string): string | null {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\.|^m\./, "")
  if (host === "youtu.be") return `https://www.youtube.com/embed/${url.pathname.slice(1).split("/")[0]}`
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const id = url.searchParams.get("v") ?? url.pathname.match(/\/(?:embed|shorts|live)\/([\w-]+)/)?.[1]
    return id ? `https://www.youtube.com/embed/${id}` : null
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.match(/(\d{5,})/)?.[1]
    return id ? `https://player.vimeo.com/video/${id}` : null
  }
  return null
}

const uploadedSchema = z.object({
  key: z.string().startsWith("public/"),
  url: z.string().startsWith("/api/files/public/"),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
})

export async function addUploadedMedia(updateId: string, file: z.input<typeof uploadedSchema>): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    await assertAdmin("ADMIN")
    const data = uploadedSchema.parse(file)
    const type = data.mimeType.startsWith("video/") ? "VIDEO" : data.mimeType.startsWith("image/") ? "IMAGE" : null
    if (!type) return fail("Seules les images et les vidéos sont acceptées")
    const last = await db.media.aggregate({ where: { updateId }, _max: { sortOrder: true } })
    const media = await db.media.create({
      data: { updateId, type, url: data.url, storageKey: data.key, mimeType: data.mimeType, size: data.size, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    })
    refresh()
    return ok({ id: media.id })
  })
}

export async function addEmbedMedia(updateId: string, link: string): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    await assertAdmin("ADMIN")
    const url = toEmbedUrl(z.string().max(500).parse(link))
    if (!url) return fail("Lien non reconnu : collez l'adresse d'une vidéo YouTube ou Vimeo.")
    const last = await db.media.aggregate({ where: { updateId }, _max: { sortOrder: true } })
    const media = await db.media.create({ data: { updateId, type: "EMBED", url, sortOrder: (last._max.sortOrder ?? -1) + 1 } })
    refresh()
    return ok({ id: media.id }, "Vidéo ajoutée")
  })
}

export async function updateMediaCaption(id: string, caption: string): Promise<ActionResult<null>> {
  return run(async () => {
    await assertAdmin("ADMIN")
    await db.media.update({ where: { id }, data: { caption: z.string().trim().max(200).parse(caption) || null } })
    refresh()
    return ok(null)
  })
}

export async function moveMedia(id: string, direction: -1 | 1): Promise<ActionResult<null>> {
  return run(async () => {
    await assertAdmin("ADMIN")
    const media = await db.media.findUnique({ where: { id } })
    if (!media) return fail("Média introuvable")
    const all = await db.media.findMany({ where: { updateId: media.updateId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } })
    const order = all.map((m) => m.id)
    const index = order.indexOf(id)
    const target = index + direction
    if (target < 0 || target >= order.length) return ok(null)
    ;[order[index], order[target]] = [order[target], order[index]]
    await db.$transaction(order.map((mid, i) => db.media.update({ where: { id: mid }, data: { sortOrder: i } })))
    refresh()
    return ok(null)
  })
}

export async function deleteMedia(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    await assertAdmin("ADMIN")
    const media = await db.media.delete({ where: { id } })
    await deleteObject(media.storageKey)
    refresh()
    return ok(null, "Média supprimé")
  })
}
