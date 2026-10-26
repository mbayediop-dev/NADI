import "server-only"
import { db } from "@/lib/db"

export async function logActivity(entry: {
  type: string
  message: string
  actorId?: string | null
  entityType?: string
  entityId?: string
}) {
  try {
    await db.activity.create({ data: { ...entry, actorId: entry.actorId ?? null } })
  } catch (error) {
    console.error("[activity]", error)
  }
}
