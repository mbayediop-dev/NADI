"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { ok, run, type ActionResult } from "@/lib/action"
import { endClientSession, startClientSession } from "@/lib/auth/client"
import { logActivity } from "@/lib/activity"
import { checkOtp, issueOtp } from "@/lib/otp"
import { fullName } from "@/lib/format"

async function clientIp() {
  const h = await headers()
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null
}

export async function requestOtp(
  phone: string,
): Promise<ActionResult<{ phone: string; maskedPhone: string; resendIn: number; devCode?: string }>> {
  return run(async () => ok(await issueOtp(phone, await clientIp())))
}

export async function verifyOtp(phone: string, code: string, next?: string): Promise<ActionResult<{ redirectTo: string }>> {
  return run(async () => {
    const owner = await checkOtp(phone, code.trim())
    await startClientSession(owner.id)
    await db.buyer.update({ where: { id: owner.id }, data: { lastLoginAt: new Date() } })
    await logActivity({
      type: "client-login",
      message: `${fullName(owner)} s'est connecté(e) à l'espace client`,
      entityType: "buyer",
      entityId: owner.id,
    })
    const safeNext = next && next.startsWith("/espace-client") && !next.startsWith("/espace-client/connexion") && !next.includes("//") ? next : "/espace-client"
    return ok({ redirectTo: safeNext })
  })
}

export async function logoutClient() {
  await endClientSession()
  redirect("/espace-client/connexion")
}
