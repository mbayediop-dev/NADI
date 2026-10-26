"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { assertAdmin } from "@/lib/auth/admin"
import { fail, ok, run, type ActionResult } from "@/lib/action"
import { logActivity } from "@/lib/activity"
import { fullName } from "@/lib/format"
import { normalizePhone } from "@/lib/phone"
import { sendSms } from "@/lib/sms"

const optional = (max: number) => z.string().trim().max(max).optional().or(z.literal(""))

const buyerSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis").max(80),
  lastName: z.string().trim().min(1, "Nom requis").max(80),
  phone: z.string().trim().min(6, "Téléphone requis"),
  phoneAlt: optional(30),
  email: z.string().trim().email("E-mail invalide").max(120).optional().or(z.literal("")),
  address: optional(200),
  city: optional(80),
  country: optional(80),
  profession: optional(80),
  idType: optional(40),
  idNumber: optional(60),
  notes: optional(2000),
})

export type BuyerInput = z.input<typeof buyerSchema>

function toData(data: z.output<typeof buyerSchema>, phone: string, phoneAlt: string | null) {
  return {
    firstName: data.firstName,
    lastName: data.lastName,
    phone,
    phoneAlt,
    email: data.email || null,
    address: data.address || null,
    city: data.city || null,
    country: data.country || null,
    profession: data.profession || null,
    idType: data.idType || null,
    idNumber: data.idNumber || null,
    notes: data.notes || null,
  }
}

function parsePhones(data: z.output<typeof buyerSchema>) {
  const phone = normalizePhone(data.phone, env.defaultCountry)
  const phoneAlt = data.phoneAlt ? normalizePhone(data.phoneAlt, env.defaultCountry) : null
  return { phone, phoneAlt }
}

const duplicatePhone = () => fail("Ce numéro est déjà attribué à un autre acheteur.", { phone: "Numéro déjà utilisé" })

export async function createBuyer(input: BuyerInput): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const data = buyerSchema.parse(input)
    const { phone, phoneAlt } = parsePhones(data)
    if (!phone) return fail("Numéro de téléphone invalide", { phone: "Numéro invalide" })
    if (data.phoneAlt && !phoneAlt) return fail("Second numéro invalide", { phoneAlt: "Numéro invalide" })
    try {
      const buyer = await db.buyer.create({ data: toData(data, phone, phoneAlt) })
      await logActivity({ type: "buyer", message: `Acheteur ajouté : ${fullName(buyer)}`, actorId: admin.id, entityType: "buyer", entityId: buyer.id })
      revalidatePath("/admin/acheteurs")
      return ok({ id: buyer.id }, "Acheteur enregistré")
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return duplicatePhone()
      throw error
    }
  })
}

export async function updateBuyer(id: string, input: BuyerInput): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const data = buyerSchema.parse(input)
    const { phone, phoneAlt } = parsePhones(data)
    if (!phone) return fail("Numéro de téléphone invalide", { phone: "Numéro invalide" })
    if (data.phoneAlt && !phoneAlt) return fail("Second numéro invalide", { phoneAlt: "Numéro invalide" })
    try {
      const buyer = await db.buyer.update({ where: { id }, data: toData(data, phone, phoneAlt) })
      await logActivity({ type: "buyer", message: `Fiche acheteur mise à jour : ${fullName(buyer)}`, actorId: admin.id, entityType: "buyer", entityId: id })
      revalidatePath("/admin/acheteurs")
      revalidatePath(`/admin/acheteurs/${id}`)
      return ok({ id }, "Fiche mise à jour")
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return duplicatePhone()
      throw error
    }
  })
}

export async function deleteBuyer(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const buyer = await db.buyer.findUnique({ where: { id }, include: { _count: { select: { sales: true } } } })
    if (!buyer) return fail("Acheteur introuvable")
    if (buyer._count.sales > 0) return fail("Impossible de supprimer un acheteur lié à des ventes.")
    await db.buyer.delete({ where: { id } })
    await logActivity({ type: "buyer", message: `Acheteur supprimé : ${fullName(buyer)}`, actorId: admin.id })
    revalidatePath("/admin/acheteurs")
    return ok(null, "Acheteur supprimé")
  })
}

export async function setPortalAccess(id: string, enabled: boolean): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const buyer = await db.buyer.update({ where: { id }, data: { portalEnabled: enabled } })
    await logActivity({
      type: "buyer",
      message: `Accès à l'espace client ${enabled ? "activé" : "désactivé"} pour ${fullName(buyer)}`,
      actorId: admin.id,
      entityType: "buyer",
      entityId: id,
    })
    revalidatePath(`/admin/acheteurs/${id}`)
    return ok(null, enabled ? "Accès à l'espace client activé" : "Accès à l'espace client désactivé")
  })
}

export async function sendBuyerSms(id: string, message: string): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const body = z.string().trim().min(2, "Message vide").max(640, "Message trop long (640 caractères max.)").parse(message)
    const buyer = await db.buyer.findUnique({ where: { id } })
    if (!buyer) return fail("Acheteur introuvable")
    const result = await sendSms(buyer.phone, body, "MANUAL")
    if (!result.ok) return fail("L'envoi du SMS a échoué. Vérifiez la configuration SMS.")
    await logActivity({ type: "sms", message: `SMS envoyé à ${fullName(buyer)}`, actorId: admin.id, entityType: "buyer", entityId: id })
    return ok(null, "SMS envoyé")
  })
}

/** Recherche d'acheteurs (nom, téléphone) pour les sélecteurs. */
export async function searchBuyers(query: string): Promise<ActionResult<{ id: string; name: string; phone: string; lots: number }[]>> {
  return run(async () => {
    await assertAdmin("VIEWER")
    const q = query.trim()
    const digits = q.replace(/\D/g, "")
    const buyers = await db.buyer.findMany({
      where: q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
            ],
          }
        : undefined,
      include: { _count: { select: { sales: { where: { status: { not: "CANCELLED" } } } } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 30,
    })
    return ok(buyers.map((b) => ({ id: b.id, name: fullName(b), phone: b.phone, lots: b._count.sales })))
  })
}
