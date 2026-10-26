"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { assertAdmin } from "@/lib/auth/admin"
import { fail, ok, run, type ActionResult } from "@/lib/action"
import { logActivity } from "@/lib/activity"
import { sendSms } from "@/lib/sms"

function refresh() {
  revalidatePath("/admin/demandes")
  revalidatePath("/admin", "layout")
}

export async function setRequestStatus(id: string, status: "NEW" | "CONTACTED" | "DECLINED"): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const target = z.enum(["NEW", "CONTACTED", "DECLINED"]).parse(status)
    const request = await db.reservationRequest.findUnique({ where: { id } })
    if (!request) return fail("Demande introuvable")
    if (request.status === "CONVERTED") return fail("Cette demande a déjà été convertie en vente.")
    await db.reservationRequest.update({
      where: { id },
      data: { status: target, handledAt: target === "NEW" ? null : (request.handledAt ?? new Date()) },
    })
    const label = { NEW: "remise en « Nouvelle »", CONTACTED: "marquée « Contacté »", DECLINED: "classée sans suite" }[target]
    await logActivity({ type: "request", message: `Demande de ${request.fullName} ${label}`, actorId: admin.id, entityType: "request", entityId: id })
    refresh()
    return ok(null, target === "CONTACTED" ? "Marquée comme contactée" : target === "DECLINED" ? "Demande classée sans suite" : "Demande remise en attente")
  })
}

export async function saveRequestNotes(id: string, notes: string): Promise<ActionResult<null>> {
  return run(async () => {
    await assertAdmin("ADMIN")
    const value = z.string().max(2000).parse(notes).trim()
    await db.reservationRequest.update({ where: { id }, data: { adminNotes: value || null } })
    refresh()
    return ok(null, "Notes enregistrées")
  })
}

const proposeSchema = z.object({
  lotId: z.string().min(1, "Choisissez un terrain"),
  sms: z.string().trim().max(640).optional(),
})

/** Propose un autre terrain (et envoie éventuellement le message par SMS). */
export async function proposeAlternativeLot(id: string, input: z.input<typeof proposeSchema>): Promise<ActionResult<{ smsSent: boolean }>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const data = proposeSchema.parse(input)
    const [request, lot] = await Promise.all([
      db.reservationRequest.findUnique({ where: { id } }),
      db.lot.findUnique({ where: { id: data.lotId }, select: { number: true, status: true } }),
    ])
    if (!request) return fail("Demande introuvable")
    if (!lot) return fail("Terrain introuvable")
    if (lot.status !== "AVAILABLE") return fail(`Le terrain n° ${lot.number} n'est plus disponible.`)
    await db.reservationRequest.update({
      where: { id },
      data: { proposedLotId: data.lotId, status: "ALTERNATIVE_PROPOSED", handledAt: request.handledAt ?? new Date() },
    })
    let smsSent = false
    if (data.sms) {
      const result = await sendSms(request.phone, data.sms, "MANUAL")
      if (!result.ok) return fail(`Proposition enregistrée, mais l'envoi du SMS a échoué : ${result.error}`)
      smsSent = true
    }
    await logActivity({
      type: "request",
      message: `Terrain n° ${lot.number} proposé à ${request.fullName}${smsSent ? " (SMS envoyé)" : ""}`,
      actorId: admin.id,
      entityType: "request",
      entityId: id,
    })
    refresh()
    return ok({ smsSent }, smsSent ? "Proposition envoyée par SMS" : "Proposition enregistrée")
  })
}

/** Pose une option sur le terrain demandé (statut « Réservé »). */
export async function reserveRequestedLot(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const request = await db.reservationRequest.findUnique({ where: { id }, include: { lot: true } })
    if (!request) return fail("Demande introuvable")
    const lot = request.proposedLotId ? await db.lot.findUnique({ where: { id: request.proposedLotId } }) : request.lot
    if (!lot) return fail("Aucun terrain associé à cette demande")
    if (lot.status !== "AVAILABLE") return fail(`Le terrain n° ${lot.number} n'est pas disponible.`)
    await db.$transaction([
      db.lot.update({
        where: { id: lot.id },
        data: { status: "RESERVED", reservedNote: `Option pour ${request.fullName} (${request.phone}) — demande du ${request.createdAt.toLocaleDateString("fr-FR")}` },
      }),
      db.reservationRequest.update({
        where: { id },
        data: { status: request.status === "NEW" ? "CONTACTED" : request.status, handledAt: request.handledAt ?? new Date() },
      }),
    ])
    await logActivity({ type: "request", message: `Option posée sur le terrain n° ${lot.number} pour ${request.fullName}`, actorId: admin.id, entityType: "lot", entityId: lot.id })
    refresh()
    revalidatePath("/admin/terrains")
    revalidatePath("/")
    return ok(null, `Terrain n° ${lot.number} réservé pour ${request.fullName}`)
  })
}

export async function deleteRequest(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const request = await db.reservationRequest.findUnique({ where: { id } })
    if (!request) return fail("Demande introuvable")
    if (request.status === "CONVERTED") return fail("Une demande convertie en vente ne peut pas être supprimée.")
    await db.reservationRequest.delete({ where: { id } })
    await logActivity({ type: "request", message: `Demande de ${request.fullName} supprimée`, actorId: admin.id })
    refresh()
    return ok(null, "Demande supprimée")
  })
}
