// Vérifie que chaque fichier référencé en base (documents, médias, images des paramètres) existe dans le stockage
// configuré (STORAGE_DRIVER) et y envoie ceux qui manquent depuis le dossier local (STORAGE_LOCAL_DIR, ./storage par défaut).
// Utile après un passage de « local » à « supabase » / « s3 ». N'écrase ni ne supprime aucun fichier existant.
// Usage : npm run storage:sync            (envoi des fichiers manquants)
//         npm run storage:sync -- --check (simple contrôle, aucun envoi)
import "dotenv/config"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import { databaseSsl } from "../src/lib/db-ssl"
import { getObject, guessMime, putObject } from "../src/lib/storage"

const checkOnly = process.argv.includes("--check")
const localRoot = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR ?? "./storage")

async function exists(key: string) {
  const object = await getObject(key, "bytes=0-0")
  await object?.body.cancel().catch(() => undefined)
  return !!object
}

async function main() {
  const url = process.env.DATABASE_URL
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, ssl: databaseSsl(url) }) })
  const [documents, media, settings] = await Promise.all([
    db.document.findMany({ select: { storageKey: true, mimeType: true } }),
    db.media.findMany({ where: { storageKey: { not: null } }, select: { storageKey: true, mimeType: true } }),
    db.settings.findUnique({ where: { id: 1 } }),
  ])
  await db.$disconnect()

  const refs = new Map<string, string | null>()
  for (const d of documents) refs.set(d.storageKey, d.mimeType)
  for (const m of media) if (m.storageKey) refs.set(m.storageKey, m.mimeType)
  if (settings?.signatureKey) refs.set(settings.signatureKey, "image/png") // cachet et signature des reçus
  const images = [settings?.logoUrl, settings?.heroImageUrl, settings?.processImageUrl, settings?.contactImageUrl, settings?.planImageUrl, settings?.aboutVideoUrl]
  const lotImages = Array.isArray(settings?.lotImages) ? (settings.lotImages as unknown[]) : []
  for (const value of [...images, ...lotImages]) {
    if (typeof value === "string" && value.startsWith("/api/files/")) refs.set(decodeURI(value.slice("/api/files/".length)), null)
  }

  console.log(`→ Pilote « ${process.env.STORAGE_DRIVER ?? "local"} » : ${refs.size} fichier(s) référencé(s) en base`)
  let present = 0
  let sent = 0
  const missing: string[] = []
  for (const [key, mimeType] of refs) {
    if (await exists(key)) {
      present++
      continue
    }
    const data = checkOnly ? null : await readFile(path.join(localRoot, key)).catch(() => null)
    if (!data) {
      missing.push(key)
      continue
    }
    await putObject(key, data, mimeType || guessMime(key))
    sent++
    console.log(`  ↑ ${key}`)
  }
  console.log(`✓ ${present} déjà présent(s) · ${sent} envoyé(s) · ${missing.length} manquant(s)`)
  if (missing.length > 0) {
    console.log(checkOnly ? "Fichiers absents du stockage :" : `Introuvables aussi dans ${localRoot} (à téléverser de nouveau depuis l'administration) :`)
    for (const key of missing) console.log(`  ✗ ${key}`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error("✗", error instanceof Error ? error.message : error)
  process.exit(1)
})
