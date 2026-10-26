import "server-only"
import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import type { AdminRole } from "@/generated/prisma/enums"
import { UserError } from "@/lib/action"
import { db } from "@/lib/db"
import { ADMIN_COOKIE, ADMIN_SESSION_DAYS, signSession, verifySession } from "@/lib/auth/token"

const ROLE_RANK: Record<AdminRole, number> = { VIEWER: 0, ADMIN: 1, OWNER: 2 }

export type CurrentAdmin = { id: string; name: string; email: string; role: AdminRole; phone: string | null }

/** Administrateur connecté (ou null). Mis en cache pour la durée de la requête. */
export const getAdmin = cache(async (): Promise<CurrentAdmin | null> => {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value
  const session = await verifySession(token, "admin")
  if (!session) return null
  const admin = await db.adminUser.findUnique({
    where: { id: session.sub },
    select: { id: true, name: true, email: true, role: true, phone: true, active: true },
  })
  if (!admin || !admin.active) return null
  return { id: admin.id, name: admin.name, email: admin.email, role: admin.role, phone: admin.phone }
})

export function hasRole(admin: { role: AdminRole }, min: AdminRole) {
  return ROLE_RANK[admin.role] >= ROLE_RANK[min]
}

/** À utiliser dans les pages : redirige vers la connexion si nécessaire. */
export async function requireAdmin(min: AdminRole = "VIEWER") {
  const admin = await getAdmin()
  if (!admin) redirect("/admin/login")
  if (!hasRole(admin, min)) redirect("/admin?forbidden=1")
  return admin
}

export class AuthError extends UserError {}

/** À utiliser dans les actions serveur : lève une erreur si non autorisé. */
export async function assertAdmin(min: AdminRole = "ADMIN") {
  const admin = await getAdmin()
  if (!admin) throw new AuthError("Session expirée. Veuillez vous reconnecter.")
  if (!hasRole(admin, min)) throw new AuthError("Vous n'avez pas les droits nécessaires pour cette action.")
  return admin
}

export async function startAdminSession(adminId: string) {
  const token = await signSession({ sub: adminId, kind: "admin" }, ADMIN_SESSION_DAYS)
  ;(await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_DAYS * 24 * 3600,
  })
}

export async function endAdminSession() {
  ;(await cookies()).delete(ADMIN_COOKIE)
}
