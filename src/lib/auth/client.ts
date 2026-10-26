import "server-only"
import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { CLIENT_COOKIE, CLIENT_SESSION_DAYS, signSession, verifySession } from "@/lib/auth/token"

/** Propriétaire connecté à l'espace client (ou null). */
export const getBuyer = cache(async () => {
  const token = (await cookies()).get(CLIENT_COOKIE)?.value
  const session = await verifySession(token, "client")
  if (!session) return null
  const buyer = await db.buyer.findUnique({ where: { id: session.sub } })
  if (!buyer || !buyer.portalEnabled) return null
  return buyer
})

export async function requireBuyer() {
  const buyer = await getBuyer()
  if (!buyer) redirect("/espace-client/connexion")
  return buyer
}

export async function startClientSession(buyerId: string) {
  const token = await signSession({ sub: buyerId, kind: "client" }, CLIENT_SESSION_DAYS)
  ;(await cookies()).set(CLIENT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CLIENT_SESSION_DAYS * 24 * 3600,
  })
}

export async function endClientSession() {
  ;(await cookies()).delete(CLIENT_COOKIE)
}
