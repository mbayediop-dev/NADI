import "server-only"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { getProvider } from "@/lib/sms/providers"

export type SmsKind = "OTP" | "PAYMENT" | "REMINDER" | "ALERT" | "MANUAL"

/** Envoie un SMS et le trace dans le journal. Ne lève jamais d'erreur : renvoie le statut. */
export async function sendSms(to: string, body: string, kind: SmsKind) {
  const provider = getProvider(env.smsProvider)
  try {
    await provider.send(to, body)
    await db.smsLog.create({ data: { to, body: kind === "OTP" ? maskOtp(body) : body, kind, provider: provider.name, status: "SENT" } })
    return { ok: true as const }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[sms] échec d'envoi vers ${to} :`, message)
    await db.smsLog.create({
      data: { to, body: kind === "OTP" ? maskOtp(body) : body, kind, provider: provider.name, status: "FAILED", error: message.slice(0, 500) },
    })
    return { ok: false as const, error: message }
  }
}

function maskOtp(body: string) {
  return body.replace(/\b\d{6}\b/, "••••••")
}

export const smsIsSimulated = () => getProvider(env.smsProvider).name === "console"
