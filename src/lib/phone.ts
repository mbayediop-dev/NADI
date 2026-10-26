// Normalisation des numéros de téléphone (format E.164) — serveur et client
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js"

export function normalizePhone(input: string, defaultCountry = "SN"): string | null {
  const cleaned = input.replace(/[^\d+]/g, "")
  if (!cleaned) return null
  const parsed = parsePhoneNumberFromString(
    cleaned.startsWith("00") ? `+${cleaned.slice(2)}` : cleaned,
    defaultCountry as CountryCode,
  )
  if (!parsed || !parsed.isValid()) return null
  return parsed.number
}

export function formatPhone(e164: string | null | undefined) {
  if (!e164) return "—"
  const parsed = parsePhoneNumberFromString(e164)
  return parsed ? parsed.formatInternational() : e164
}

/** Lien WhatsApp (wa.me) à partir d'un numéro E.164 */
export function whatsappLink(e164: string, text?: string) {
  const digits = e164.replace(/\D/g, "")
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`
}

export function maskPhone(e164: string) {
  const formatted = formatPhone(e164)
  return formatted.replace(/\d(?=(?:\D*\d){2})/g, (digit, offset: number) => (offset < 8 ? digit : "•"))
}
