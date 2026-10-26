"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { assertAdmin } from "@/lib/auth/admin"
import { fail, ok, run, type ActionResult } from "@/lib/action"
import { logActivity } from "@/lib/activity"
import { polygonSchema } from "@/lib/plan"
import { Prisma } from "@/generated/prisma/client"

/** Enregistre (ou efface) la forme d'un terrain sur le plan. */
export async function saveLotPolygon(lotId: string, polygon: [number, number][] | null): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const lot = await db.lot.findUnique({ where: { id: lotId }, select: { number: true } })
    if (!lot) return fail("Terrain introuvable")
    const shape = polygon ? polygonSchema.parse(polygon.map(([x, y]) => [Number(x.toFixed(5)), Number(y.toFixed(5))])) : null
    await db.lot.update({ where: { id: lotId }, data: { polygon: shape ?? Prisma.DbNull } })
    await logActivity({
      type: "plan",
      message: shape ? `Forme du terrain n° ${lot.number} enregistrée sur le plan` : `Forme du terrain n° ${lot.number} effacée`,
      actorId: admin.id,
      entityType: "lot",
      entityId: lotId,
    })
    revalidatePath("/admin/plan")
    revalidatePath("/")
    return ok(null, shape ? `Terrain n° ${lot.number} dessiné` : `Forme du terrain n° ${lot.number} effacée`)
  })
}

const imageSchema = z.object({
  url: z.string().min(1).max(500).refine((u) => u.startsWith("/api/files/public/") || u.startsWith("/plan/"), "Image invalide"),
  width: z.number().int().min(100).max(20000),
  height: z.number().int().min(100).max(20000),
})

/** Remplace l'image de fond du plan (les formes restent positionnées en proportion). */
export async function updatePlanImage(input: z.input<typeof imageSchema>): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const data = imageSchema.parse(input)
    await db.settings.upsert({
      where: { id: 1 },
      create: { id: 1, planImageUrl: data.url, planWidth: data.width, planHeight: data.height },
      update: { planImageUrl: data.url, planWidth: data.width, planHeight: data.height },
    })
    await logActivity({ type: "plan", message: "Image du plan du site remplacée", actorId: admin.id })
    revalidatePath("/admin/plan")
    revalidatePath("/")
    return ok(null, "Image du plan mise à jour")
  })
}
