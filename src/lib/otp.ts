import "server-only"
import { createHmac, randomInt, timingSafeEqual } from "node:crypto"
import { UserError } from "@/lib/action"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { maskPhone, normalizePhone } from "@/lib/phone"
import { sendSms, smsIsSimulated } from "@/lib/sms"

/**
 * Connexion des propriétaires par code à usage unique (OTP) envoyé par SMS.
 * - code à 6 chiffres, stocké sous forme d'empreinte HMAC-SHA256
 * - validité 5 minutes, 5 essais maximum
 * - 1 envoi par minute et 5 par heure pour un même numéro (+ limite par adresse IP)
 */

export const OTP_TTL_MS = 5 * 60 * 1000
export const OTP_RESEND_SECONDS = 60
const MAX_PER_HOUR = 5
const MAX_ATTEMPTS = 5
const IP_MAX_PER_HOUR = 15

const ipRequests = new Map<string, number[]>()

function hashCode(phone: string, code: string) {
  return createHmac("sha256", env.sessionSecret).update(`${phone}:${code}`).digest("hex")
}

function sameHash(a: string, b: string) {
  const left = Buffer.from(a, "hex")
  const right = Buffer.from(b, "hex")
  return left.length === right.length && timingSafeEqual(left, right)
}

function checkIp(ip: string | null) {
  if (!ip) return
  const now = Date.now()
  const recent = (ipRequests.get(ip) ?? []).filter((t) => now - t < 3600_000)
  if (recent.length >= IP_MAX_PER_HOUR) {
    throw new UserError("Trop de demandes depuis cet appareil. Réessayez dans une heure.")
  }
  recent.push(now)
  ipRequests.set(ip, recent)
}

/** Propriétaire autorisé à se connecter avec ce numéro (au moins une vente non annulée). */
export async function findOwnerByPhone(phone: string) {
  return db.buyer.findFirst({
    where: { phone, portalEnabled: true, sales: { some: { status: { not: "CANCELLED" } } } },
    select: { id: true, firstName: true, lastName: true, phone: true },
  })
}

export function parseOwnerPhone(input: string) {
  const phone = normalizePhone(input, env.defaultCountry)
  if (!phone) throw new UserError("Numéro de téléphone invalide. Vérifiez l'indicatif et le numéro.")
  return phone
}

export async function issueOtp(input: string, ip: string | null) {
  const phone = parseOwnerPhone(input)
  const owner = await findOwnerByPhone(phone)
  if (!owner) throw new UserError("Ce numéro n'est associé à aucun propriétaire. Contactez NADI Group.")

  const now = Date.now()
  const recent = await db.otpCode.findMany({
    where: { phone, createdAt: { gte: new Date(now - 3600_000) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  })
  const last = recent[0]
  if (last) {
    const elapsed = Math.floor((now - last.createdAt.getTime()) / 1000)
    if (elapsed < OTP_RESEND_SECONDS) {
      throw new UserError(`Un code vient d'être envoyé. Patientez ${OTP_RESEND_SECONDS - elapsed} s avant d'en demander un nouveau.`)
    }
  }
  if (recent.length >= MAX_PER_HOUR) {
    throw new UserError("Nombre maximal de codes atteint. Réessayez dans une heure ou contactez NADI Group.")
  }
  checkIp(ip)

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0")
  // Les codes précédents encore valides sont invalidés
  await db.otpCode.updateMany({ where: { phone, consumedAt: null }, data: { consumedAt: new Date(now) } })
  await db.otpCode.create({
    data: { phone, codeHash: hashCode(phone, code), expiresAt: new Date(now + OTP_TTL_MS), ip },
  })

  const sms = await sendSms(phone, `NADI Group : votre code de connexion est ${code}. Il expire dans 5 minutes.`, "OTP")
  if (!sms.ok) throw new UserError("L'envoi du SMS a échoué. Réessayez dans un instant.")

  const simulated = smsIsSimulated() && !env.isProduction
  return {
    phone,
    maskedPhone: maskPhone(phone),
    resendIn: OTP_RESEND_SECONDS,
    devCode: simulated ? code : undefined,
  }
}

export async function checkOtp(input: string, code: string) {
  const phone = parseOwnerPhone(input)
  if (!/^\d{6}$/.test(code)) throw new UserError("Le code doit comporter 6 chiffres.")

  const otp = await db.otpCode.findFirst({ where: { phone }, orderBy: { createdAt: "desc" } })
  if (!otp) throw new UserError("Aucun code en cours pour ce numéro. Demandez un nouveau code.")
  if (otp.attempts >= MAX_ATTEMPTS) throw new UserError("Trop d'essais incorrects. Demandez un nouveau code.")
  if (otp.consumedAt) throw new UserError("Ce code n'est plus valide. Demandez-en un nouveau.")
  if (otp.expiresAt.getTime() < Date.now()) throw new UserError("Ce code a expiré. Demandez-en un nouveau.")
  if (!sameHash(otp.codeHash, hashCode(phone, code))) {
    const attempts = otp.attempts + 1
    await db.otpCode.update({
      where: { id: otp.id },
      data: { attempts, ...(attempts >= MAX_ATTEMPTS ? { consumedAt: new Date() } : {}) },
    })
    const left = MAX_ATTEMPTS - attempts
    throw new UserError(
      left > 0
        ? `Code incorrect. Il vous reste ${left} essai${left > 1 ? "s" : ""}.`
        : "Trop d'essais incorrects. Demandez un nouveau code.",
    )
  }

  const consumed = await db.otpCode.updateMany({
    where: { id: otp.id, consumedAt: null },
    data: { consumedAt: new Date() },
  })
  if (consumed.count === 0) throw new UserError("Ce code a déjà été utilisé. Demandez-en un nouveau.")

  const owner = await findOwnerByPhone(phone)
  if (!owner) throw new UserError("Ce numéro n'est associé à aucun propriétaire. Contactez NADI Group.")
  return owner
}
