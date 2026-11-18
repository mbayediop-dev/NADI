"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { fail, ok, run, UserError, type ActionResult } from "@/lib/action"
import { logActivity } from "@/lib/activity"
import { getBuyer } from "@/lib/auth/client"
import { createConstructionProject, respondToQuote } from "@/lib/construction-service"
import { formatMoney, fullName } from "@/lib/format"
import { getSettings } from "@/lib/settings"
import { sendSms } from "@/lib/sms"

const MAX_OPEN_REQUESTS = 3

async function requireSession() {
  const buyer = await getBuyer()
  if (!buyer) throw new UserError("Session expirée. Veuillez vous reconnecter.")
  return buyer
}

const requestSchema = z
  .object({
    landOrigin: z.enum(["COMPANY_LOT", "OWN_LAND", "NO_LAND"]),
    /** Vente du client dont le terrain accueillera la maison (terrain du lotissement) */
    saleId: z.string().optional().nullable(),
    landAddress: z.string().trim().max(200).optional().nullable(),
    landAreaM2: z.number().finite().positive().max(1_000_000).optional().nullable(),
    houseModelId: z.string().optional().nullable(),
    customPlan: z.boolean().default(false),
    requirements: z.string().trim().max(3000).optional().nullable(),
    budget: z.number().finite().nonnegative().optional().nullable(),
  })
  .refine((v) => v.landOrigin !== "COMPANY_LOT" || !!v.saleId, { path: ["saleId"], message: "Choisissez le terrain concerné" })
  .refine((v) => v.houseModelId || v.customPlan || (v.requirements && v.requirements.length >= 10), {
    path: ["requirements"],
    message: "Choisissez un modèle ou décrivez la maison souhaitée",
  })

export type ConstructionRequestInput = z.input<typeof requestSchema>

/** Demande de construction déposée par un client depuis son espace. */
export async function requestConstruction(input: ConstructionRequestInput): Promise<ActionResult<{ projectId: string }>> {
  return run(async () => {
    const buyer = await requireSession()
    const data = requestSchema.parse(input)

    const open = await db.constructionProject.count({ where: { buyerId: buyer.id, status: "REQUESTED" } })
    if (open >= MAX_OPEN_REQUESTS) return fail("Vous avez déjà plusieurs demandes en cours d'étude. Nous revenons vers vous très vite.")

    let lot: { id: string; number: string } | null = null
    if (data.landOrigin === "COMPANY_LOT") {
      const sale = await db.sale.findFirst({
        where: { id: data.saleId!, buyerId: buyer.id, status: { not: "CANCELLED" } },
        select: { lot: { select: { id: true, number: true } } },
      })
      if (!sale) return fail("Terrain introuvable dans votre espace.", { saleId: "Terrain introuvable" })
      lot = sale.lot
    }
    const model = data.houseModelId ? await db.houseModel.findFirst({ where: { id: data.houseModelId, published: true }, select: { id: true, name: true } }) : null

    const project = await createConstructionProject({
      title: `${model ? model.name : "Maison sur mesure"}${lot ? ` — terrain n° ${lot.number}` : ""}`,
      status: "REQUESTED",
      source: "PORTAL",
      buyerId: buyer.id,
      contactName: fullName(buyer),
      contactPhone: buyer.phone,
      contactEmail: buyer.email,
      landOrigin: data.landOrigin,
      lotId: lot?.id ?? null,
      landAddress: data.landOrigin === "OWN_LAND" ? data.landAddress || null : null,
      landAreaM2: data.landOrigin === "OWN_LAND" ? (data.landAreaM2 ?? null) : null,
      landReference: null,
      houseModelId: model?.id ?? null,
      customPlan: data.customPlan || !model,
      requirements: data.requirements || null,
      budget: data.budget ?? null,
    })

    await logActivity({
      type: "construction",
      message: `Demande de construction de ${fullName(buyer)} depuis l'espace client : « ${project.title} »`,
      entityType: "construction",
      entityId: project.id,
    })
    const settings = await getSettings()
    if (settings.alertPhone) {
      await sendSms(
        settings.alertPhone,
        `${settings.companyName} : demande de construction de ${fullName(buyer)} (${buyer.phone}). ${env.appUrl}/admin/construction/${project.id}`,
        "ALERT",
      )
    }
    revalidatePath("/espace-client/construction")
    revalidatePath("/admin/construction")
    return ok({ projectId: project.id }, "Votre demande est enregistrée. Nous vous contactons rapidement.")
  })
}

/** Réponse du client à une offre reçue : acceptation (le montant du contrat est fixé) ou refus. */
export async function answerMyQuote(quoteId: string, accepted: boolean): Promise<ActionResult<null>> {
  return run(async () => {
    const buyer = await requireSession()
    const quote = await respondToQuote(quoteId, !!accepted, { buyerId: buyer.id })
    await logActivity({
      type: "construction",
      message: `${fullName(buyer)} a ${accepted ? "accepté" : "refusé"} l'offre ${quote.number} (${formatMoney(quote.amount)}) — projet ${quote.project.reference}`,
      entityType: "construction",
      entityId: quote.projectId,
    })
    const settings = await getSettings()
    if (settings.alertPhone) {
      await sendSms(
        settings.alertPhone,
        `${settings.companyName} : ${fullName(buyer)} a ${accepted ? "ACCEPTÉ" : "refusé"} l'offre ${quote.number} (${formatMoney(quote.amount, settings.currencyLabel)}). ${env.appUrl}/admin/construction/${quote.projectId}`,
        "ALERT",
      )
    }
    revalidatePath("/espace-client/construction")
    revalidatePath(`/espace-client/construction/${quote.projectId}`)
    revalidatePath(`/admin/construction/${quote.projectId}`)
    return ok(null, accepted ? "Merci ! Votre accord est enregistré : nous vous contactons pour la suite." : "Votre réponse est enregistrée. Nous vous recontactons.")
  })
}
