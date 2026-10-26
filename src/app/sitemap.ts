import type { MetadataRoute } from "next"
import { connection } from "next/server"
import { db } from "@/lib/db"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection()
  const base = process.env.APP_URL ?? "http://localhost:3000"
  const lots = await db.lot.findMany({ where: { status: { not: "UNAVAILABLE" } }, select: { number: true, updatedAt: true } })
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/terrains`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/avancement`, changeFrequency: "weekly", priority: 0.7 },
    ...lots.map((lot) => ({
      url: `${base}/terrains/${encodeURIComponent(lot.number)}`,
      lastModified: lot.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ]
}
