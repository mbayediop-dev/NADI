import "server-only"

export type SmsProvider = {
  name: string
  send(to: string, body: string): Promise<void>
}

/** Développement : le SMS est simplement affiché dans la console du serveur. */
export const consoleProvider: SmsProvider = {
  name: "console",
  async send(to, body) {
    console.info(`\n📱 SMS → ${to}\n${body}\n`)
  },
}

/** Twilio — TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (numéro ou identifiant alphanumérique) */
export const twilioProvider: SmsProvider = {
  name: "twilio",
  async send(to, body) {
    const sid = process.env.TWILIO_ACCOUNT_SID
    const token = process.env.TWILIO_AUTH_TOKEN
    const from = process.env.TWILIO_FROM
    if (!sid || !token || !from) throw new Error("Configuration Twilio incomplète")
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    })
    if (!res.ok) throw new Error(`Twilio ${res.status} : ${await res.text()}`)
  },
}

/**
 * Orange SMS API (Sénégal, Côte d'Ivoire…) — ORANGE_CLIENT_ID, ORANGE_CLIENT_SECRET,
 * ORANGE_SENDER_ADDRESS (ex. +221770000000), ORANGE_SENDER_NAME (optionnel, nom validé par Orange)
 */
let orangeToken: { value: string; expiresAt: number } | null = null

async function getOrangeToken() {
  if (orangeToken && orangeToken.expiresAt > Date.now() + 60_000) return orangeToken.value
  const id = process.env.ORANGE_CLIENT_ID
  const secret = process.env.ORANGE_CLIENT_SECRET
  if (!id || !secret) throw new Error("Configuration Orange SMS incomplète")
  const res = await fetch("https://api.orange.com/oauth/v3/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
  })
  if (!res.ok) throw new Error(`Orange OAuth ${res.status} : ${await res.text()}`)
  const json = (await res.json()) as { access_token: string; expires_in: number }
  orangeToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 }
  return orangeToken.value
}

export const orangeProvider: SmsProvider = {
  name: "orange",
  async send(to, body) {
    const sender = process.env.ORANGE_SENDER_ADDRESS
    if (!sender) throw new Error("ORANGE_SENDER_ADDRESS manquant")
    const senderAddress = `tel:${sender.startsWith("+") ? sender : `+${sender}`}`
    const token = await getOrangeToken()
    const res = await fetch(
      `https://api.orange.com/smsmessaging/v1/outbound/${encodeURIComponent(senderAddress)}/requests`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          outboundSMSMessageRequest: {
            address: `tel:${to}`,
            senderAddress,
            ...(process.env.ORANGE_SENDER_NAME ? { senderName: process.env.ORANGE_SENDER_NAME } : {}),
            outboundSMSTextMessage: { message: body },
          },
        }),
      },
    )
    if (!res.ok) throw new Error(`Orange SMS ${res.status} : ${await res.text()}`)
  },
}

export function getProvider(name: string): SmsProvider {
  switch (name) {
    case "twilio":
      return twilioProvider
    case "orange":
      return orangeProvider
    default:
      return consoleProvider
  }
}
