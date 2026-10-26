// Jetons de session signés (JWT HS256). Sans dépendance serveur : utilisable dans proxy.ts.
import { jwtVerify, SignJWT } from "jose"

export const ADMIN_COOKIE = "nadi_admin"
export const CLIENT_COOKIE = "nadi_client"

export const ADMIN_SESSION_DAYS = 7
export const CLIENT_SESSION_DAYS = 30

export type SessionPayload = { sub: string; kind: "admin" | "client" }

function key() {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET manquant ou trop court")
  return new TextEncoder().encode(secret)
}

export async function signSession(payload: SessionPayload, days: number) {
  return new SignJWT({ kind: payload.kind })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(key())
}

export async function verifySession(token: string | undefined, kind: SessionPayload["kind"]) {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] })
    if (payload.kind !== kind || typeof payload.sub !== "string") return null
    return { sub: payload.sub, kind } satisfies SessionPayload
  } catch {
    return null
  }
}
