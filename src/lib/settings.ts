import "server-only"
import { cache } from "react"
import { connection } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"

const amenitiesSchema = z.array(z.string()).catch([])
const highlightsSchema = z.array(z.object({ title: z.string(), text: z.string() })).catch([])
const faqSchema = z.array(z.object({ q: z.string(), a: z.string() })).catch([])
const imagesSchema = z.array(z.string().min(1)).catch([])

/** Paramètres globaux (créés à la volée s'ils n'existent pas). */
export const getSettings = cache(async () => {
  // Données lues à chaque requête : exclues du prérendu statique
  await connection()
  const row = (await db.settings.findUnique({ where: { id: 1 } })) ?? (await db.settings.create({ data: { id: 1 } }))
  return {
    ...row,
    amenities: amenitiesSchema.parse(row.amenities),
    highlights: highlightsSchema.parse(row.highlights),
    faq: faqSchema.parse(row.faq),
    lotImages: imagesSchema.parse(row.lotImages),
  }
})

export type AppSettings = Awaited<ReturnType<typeof getSettings>>

export function planDefaults(settings: AppSettings) {
  return {
    defaultDepositRate: settings.defaultDepositRate,
    defaultInstallments: settings.defaultInstallments,
    defaultFrequency: settings.defaultFrequency,
  }
}
