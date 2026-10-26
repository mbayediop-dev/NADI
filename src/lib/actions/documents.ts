"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { assertAdmin } from "@/lib/auth/admin"
import { fail, ok, run, type ActionResult } from "@/lib/action"
import { deleteObject } from "@/lib/storage"
import { logActivity } from "@/lib/activity"

const documentSchema = z.object({
  title: z.string().trim().min(2, "Titre requis").max(160),
  description: z.string().trim().max(500).optional().nullable(),
  category: z.enum(["PLAN", "ADMINISTRATIVE", "CONTRACT", "RECEIPT", "TECHNICAL", "OTHER"]),
  visibility: z.enum(["PUBLIC", "CLIENTS", "PRIVATE"]),
  saleId: z.string().optional().nullable(),
  file: z.object({
    key: z.string().startsWith("private/"),
    filename: z.string().min(1),
    mimeType: z.string().min(1),
    size: z.number().int().nonnegative(),
  }),
})

/** Enregistre un document après téléversement (fichier stocké en « private/ »). */
export async function createDocument(input: z.input<typeof documentSchema>): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const data = documentSchema.parse(input)
    const doc = await db.document.create({
      data: {
        title: data.title,
        description: data.description || null,
        category: data.category,
        visibility: data.saleId ? "CLIENTS" : data.visibility,
        saleId: data.saleId || null,
        storageKey: data.file.key,
        filename: data.file.filename,
        mimeType: data.file.mimeType,
        size: data.file.size,
      },
    })
    await logActivity({ type: "document", message: `Document ajouté : « ${doc.title} »`, actorId: admin.id, entityType: "document", entityId: doc.id })
    revalidatePath("/admin/documents")
    if (doc.saleId) revalidatePath(`/admin/ventes/${doc.saleId}`)
    return ok({ id: doc.id }, "Document ajouté")
  })
}

const updateSchema = documentSchema.omit({ file: true, saleId: true }).partial()

export async function updateDocument(id: string, input: z.input<typeof updateSchema>): Promise<ActionResult<null>> {
  return run(async () => {
    await assertAdmin("ADMIN")
    const data = updateSchema.parse(input)
    const doc = await db.document.update({ where: { id }, data })
    revalidatePath("/admin/documents")
    if (doc.saleId) revalidatePath(`/admin/ventes/${doc.saleId}`)
    return ok(null, "Document mis à jour")
  })
}

export async function deleteDocument(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const doc = await db.document.findUnique({ where: { id } })
    if (!doc) return fail("Document introuvable")
    await db.document.delete({ where: { id } })
    await deleteObject(doc.storageKey)
    await logActivity({ type: "document", message: `Document supprimé : « ${doc.title} »`, actorId: admin.id })
    revalidatePath("/admin/documents")
    if (doc.saleId) revalidatePath(`/admin/ventes/${doc.saleId}`)
    return ok(null, "Document supprimé")
  })
}
