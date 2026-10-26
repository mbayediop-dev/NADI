"use server"

import bcrypt from "bcryptjs"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"
import { db } from "@/lib/db"
import { endAdminSession, startAdminSession } from "@/lib/auth/admin"
import { fail, run, type ActionResult } from "@/lib/action"
import { logActivity } from "@/lib/activity"

// Limitation simple des tentatives (en mémoire, par adresse IP + e-mail)
const attempts = new Map<string, { count: number; until: number }>()
const MAX_ATTEMPTS = 6
const LOCK_MS = 15 * 60 * 1000

async function clientIp() {
  const h = await headers()
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local"
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide"),
  password: z.string().min(1, "Mot de passe requis"),
})

export async function loginAdmin(input: z.input<typeof loginSchema>, next?: string): Promise<ActionResult<{ redirectTo: string }>> {
  return run(async () => {
    const { email, password } = loginSchema.parse(input)
    const key = `${await clientIp()}:${email}`
    const entry = attempts.get(key)
    if (entry && entry.count >= MAX_ATTEMPTS && entry.until > Date.now()) {
      return fail("Trop de tentatives. Réessayez dans quelques minutes.")
    }
    const admin = await db.adminUser.findUnique({ where: { email } })
    const valid = admin && admin.active && (await bcrypt.compare(password, admin.passwordHash))
    if (!valid) {
      const current = entry && entry.until > Date.now() ? entry.count : 0
      attempts.set(key, { count: current + 1, until: Date.now() + LOCK_MS })
      return fail("E-mail ou mot de passe incorrect.")
    }
    attempts.delete(key)
    await db.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } })
    await startAdminSession(admin.id)
    const safeNext = next && next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin"
    return { ok: true, data: { redirectTo: safeNext } }
  })
}

const setupSchema = z.object({
  name: z.string().trim().min(2, "Nom requis"),
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide"),
  password: z.string().min(8, "8 caractères minimum"),
})

/** Création du tout premier compte (uniquement si aucun administrateur n'existe). */
export async function setupFirstAdmin(input: z.input<typeof setupSchema>): Promise<ActionResult<{ redirectTo: string }>> {
  return run(async () => {
    const data = setupSchema.parse(input)
    if ((await db.adminUser.count()) > 0) return fail("Un compte administrateur existe déjà.")
    const admin = await db.adminUser.create({
      data: { name: data.name, email: data.email, role: "OWNER", passwordHash: await bcrypt.hash(data.password, 10) },
    })
    await logActivity({ type: "admin", message: `Compte responsable créé (${admin.email})`, actorId: admin.id })
    await startAdminSession(admin.id)
    return { ok: true, data: { redirectTo: "/admin" } }
  })
}

export async function logoutAdmin() {
  await endAdminSession()
  redirect("/admin/login")
}
