import { env } from "@/lib/env"
import { runAutomaticReminders } from "@/lib/notifications"

/**
 * Relances SMS automatiques — à appeler une fois par jour (cron du serveur, Vercel Cron…) :
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://…/api/cron/reminders
 * ou https://…/api/cron/reminders?key=$CRON_SECRET
 */
export async function GET(request: Request) {
  const secret = env.cronSecret
  if (!secret) return Response.json({ error: "CRON_SECRET non configuré" }, { status: 503 })
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  const key = new URL(request.url).searchParams.get("key")
  if (bearer !== secret && key !== secret) return Response.json({ error: "Non autorisé" }, { status: 401 })
  const result = await runAutomaticReminders()
  return Response.json({ ok: true, ...result })
}
