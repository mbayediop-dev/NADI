"use server"

import { headers } from "next/headers"
import { z } from "zod"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { fail, ok, run, type ActionResult } from "@/lib/action"
import { logActivity } from "@/lib/activity"
import { normalizePhone } from "@/lib/phone"
import { getSettings } from "@/lib/settings"
import { sendSms } from "@/lib/sms"

// Limitation simple des envois (mémoire du processus) : 3 demandes / 10 min par IP et par téléphone
const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 3
const hits = new Map<string, number[]>()

function rateLimited(key: string) {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent)
    return true
  }
  recent.push(now)
  hits.set(key, recent)
  return false
}

const requestSchema = z.object({
  lotId: z.string().trim().min(1).optional().nullable(),
  fullName: z.string().trim().min(2, "Indiquez votre nom complet").max(120),
  phone: z.string().trim().min(6, "Indiquez votre numéro de téléphone").max(30),
  email: z
    .string()
    .trim()
    .max(160)
    .optional()
    .nullable()
    .refine((v) => !v || z.email().safeParse(v).success, "Adresse e-mail invalide"),
  preferredContact: z.enum(["CALL", "WHATSAPP", "EMAIL"]).default("CALL"),
  message: z.string().trim().max(1000).optional().nullable(),
  /** Champ piège anti-robots : doit rester vide */
  website: z.string().optional().nullable(),
})

export type ReservationInput = z.input<typeof requestSchema>

/** Demande de réservation (ou de rappel si aucun terrain) déposée depuis le site public. */
export async function createReservationRequest(input: ReservationInput): Promise<ActionResult<{ lotNumber: string | null }>> {
  return run(async () => {
    const data = requestSchema.parse(input)
    if (data.website) return ok({ lotNumber: null }) // robot : on ignore silencieusement

    const phone = normalizePhone(data.phone, env.defaultCountry)
    if (!phone) return fail("Numéro de téléphone invalide. Vérifiez l'indicatif et le numéro.", { phone: "Numéro invalide" })
    if (data.preferredContact === "EMAIL" && !data.email) {
      return fail("Indiquez votre adresse e-mail pour être contacté par e-mail.", { email: "Adresse e-mail requise" })
    }

    const h = await headers()
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local"
    if (rateLimited(`ip:${ip}`) || rateLimited(`phone:${phone}`)) {
      return fail("Vous avez déjà envoyé plusieurs demandes. Merci de patienter quelques minutes : nous vous rappelons très vite.")
    }

    const settings = await getSettings()
    let lot: { id: string; number: string } | null = null
    if (data.lotId) {
      const found = await db.lot.findUnique({ where: { id: data.lotId }, select: { id: true, number: true, status: true } })
      if (!found) return fail("Ce terrain n'existe plus.")
      if (!settings.reservationsOpen) return fail("Les réservations en ligne sont momentanément fermées. Contactez-nous directement.")
      if (found.status !== "AVAILABLE") return fail(`Le terrain n° ${found.number} n'est plus disponible. Choisissez un autre terrain sur le plan.`)
      lot = { id: found.id, number: found.number }
    }

    // Évite les doublons : même téléphone, même terrain, demande encore ouverte de moins de 24 h
    const since = new Date(Date.now() - 24 * 3600 * 1000)
    const duplicate = await db.reservationRequest.findFirst({
      where: { phone, lotId: lot?.id ?? null, status: { in: ["NEW", "CONTACTED"] }, createdAt: { gte: since } },
      select: { id: true },
    })
    if (duplicate) return ok({ lotNumber: lot?.number ?? null })

    const existingBuyer = await db.buyer.findUnique({ where: { phone }, select: { id: true } })
    const request = await db.reservationRequest.create({
      data: {
        lotId: lot?.id ?? null,
        fullName: data.fullName,
        phone,
        email: data.email || null,
        message: data.message || null,
        preferredContact: data.preferredContact,
        buyerId: existingBuyer?.id ?? null,
      },
    })

    await logActivity({
      type: "request",
      message: lot
        ? `Nouvelle demande de réservation de ${data.fullName} pour le terrain n° ${lot.number}`
        : `Nouvelle demande de rappel de ${data.fullName}`,
      entityType: "request",
      entityId: request.id,
    })

    if (settings.alertPhone) {
      await sendSms(
        settings.alertPhone,
        lot
          ? `${settings.companyName} : nouvelle demande pour le lot n°${lot.number} — ${data.fullName} (${phone}). ${env.appUrl}/admin/demandes`
          : `${settings.companyName} : demande de rappel — ${data.fullName} (${phone}). ${env.appUrl}/admin/demandes`,
        "ALERT",
      )
    }

    return ok({ lotNumber: lot?.number ?? null })
  })
}
