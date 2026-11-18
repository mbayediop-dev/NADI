"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { assertAdmin } from "@/lib/auth/admin"
import { fail, ok, run, type ActionResult } from "@/lib/action"
import { logActivity } from "@/lib/activity"

const optionalInt = z.number().int().min(0).max(50).optional().nullable()
const optionalNumber = z.number().finite().nonnegative().optional().nullable()

const modelSchema = z.object({
  id: z.string().optional().nullable(),
  name: z.string().trim().min(2, "Nom requis").max(100),
  tagline: z.string().trim().max(160).default(""),
  description: z.string().trim().max(3000).default(""),
  levels: z.string().trim().max(40).optional().nullable(),
  bedrooms: optionalInt,
  bathrooms: optionalInt,
  livingAreaM2: optionalNumber,
  minLandM2: optionalNumber,
  basePrice: optionalNumber,
  images: z.array(z.string().max(500).refine((v) => v.startsWith("/"), "Image invalide")).max(12),
  features: z.array(z.string().trim().min(1).max(80)).max(20),
  published: z.boolean(),
})

export type HouseModelInput = z.input<typeof modelSchema>

function revalidateModels() {
  revalidatePath("/admin/modeles")
  revalidatePath("/construction")
  revalidatePath("/")
}

/** Crée ou modifie un modèle de maison du catalogue (plans proposés aux clients). */
export async function saveHouseModel(input: HouseModelInput): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const { id, ...data } = modelSchema.parse(input)
    const values = { ...data, levels: data.levels || null }
    if (id) {
      await db.houseModel.update({ where: { id }, data: values })
      revalidateModels()
      return ok({ id }, "Modèle enregistré")
    }
    const last = await db.houseModel.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } })
    const model = await db.houseModel.create({ data: { ...values, sortOrder: (last?.sortOrder ?? -1) + 1 }, select: { id: true } })
    await logActivity({ type: "construction", message: `Modèle de maison ajouté : « ${data.name} »`, actorId: admin.id })
    revalidateModels()
    return ok({ id: model.id }, "Modèle ajouté au catalogue")
  })
}

export async function setHouseModelPublished(id: string, published: boolean): Promise<ActionResult<null>> {
  return run(async () => {
    await assertAdmin("ADMIN")
    await db.houseModel.update({ where: { id }, data: { published } })
    revalidateModels()
    return ok(null, published ? "Modèle affiché sur le site" : "Modèle retiré du site")
  })
}

/** Supprime un modèle ; les projets qui l'utilisaient le perdent simplement comme référence. */
export async function deleteHouseModel(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const model = await db.houseModel.findUnique({ where: { id }, select: { name: true } })
    if (!model) return fail("Modèle introuvable")
    await db.houseModel.delete({ where: { id } })
    await logActivity({ type: "construction", message: `Modèle de maison supprimé : « ${model.name} »`, actorId: admin.id })
    revalidateModels()
    return ok(null, "Modèle supprimé")
  })
}
