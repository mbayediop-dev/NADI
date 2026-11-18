// Renomme la marque dans les DONNÉES : « NADI Group » → « FUTURIA GROUP », « NADI » isolé → « FUTURIA »
// (paramètres du site : nom, textes, FAQ… et position / description des terrains, ex. « Avenue NADI »).
// Les adresses e-mail, les liens et les identifiants techniques (en minuscules) ne sont pas modifiés.
// À lancer une seule fois, au moment de la mise en ligne de la nouvelle identité.
// Usage : npx tsx scripts/rename-brand.ts           (simulation : affiche les changements, n'écrit rien)
//         npx tsx scripts/rename-brand.ts --apply   (écrit les changements, en une transaction de deux requêtes)
import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import { databaseSsl } from "../src/lib/db-ssl"

const apply = process.argv.includes("--apply")

const TEXT_FIELDS = [
  "companyName",
  "companyTagline",
  "companyAbout",
  "companyAddress",
  "siteName",
  "siteLocation",
  "siteDescription",
  "heroEyebrow",
  "heroTitle",
  "heroSubtitle",
  "businessHours",
  "legalNotice",
  "privacyPolicy",
] as const
const JSON_FIELDS = ["amenities", "highlights", "faq"] as const

function rename(text: string) {
  return text.replace(/NADI\s+Group/gi, "FUTURIA GROUP").replace(/\bNADI\b/g, "FUTURIA")
}

function renameDeep(value: unknown): unknown {
  if (typeof value === "string") return rename(value)
  if (Array.isArray(value)) return value.map(renameDeep)
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, renameDeep(v)]))
  return value
}

/** Extraits « avant → après » autour de chaque mention, pour relire la simulation. */
function excerpts(before: string) {
  return [...before.matchAll(/.{0,30}(?:NADI\s+Group|\bNADI\b).{0,30}/gi)]
    .filter((m) => rename(m[0]) !== m[0])
    .map((m) => `      « ${m[0].replace(/\s+/g, " ")} » → « ${rename(m[0]).replace(/\s+/g, " ")} »`)
}

async function main() {
  const url = process.env.DATABASE_URL
  let host = "?"
  try {
    host = new URL(url ?? "").host
  } catch {}
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, ssl: databaseSsl(url) }) })
  console.log(`Base : ${host} — ${apply ? "ÉCRITURE" : "simulation (ajoutez --apply pour écrire)"}\n`)

  try {
    const settings = await db.settings.findUnique({ where: { id: 1 } })
    const data: Record<string, unknown> = {}
    if (settings) {
      for (const field of TEXT_FIELDS) {
        const before = settings[field]
        if (rename(before) !== before) {
          data[field] = rename(before)
          console.log(`  Paramètres · ${field}`)
          console.log(excerpts(before).join("\n"))
        }
      }
      for (const field of JSON_FIELDS) {
        const before = JSON.stringify(settings[field])
        const after = renameDeep(settings[field])
        if (JSON.stringify(after) !== before) {
          data[field] = after
          console.log(`  Paramètres · ${field}`)
          console.log(excerpts(before).join("\n"))
        }
      }
    }

    const lots = await db.lot.findMany({ select: { number: true, position: true, description: true }, orderBy: { number: "asc" } })
    const changedLots = lots.filter((l) => rename(l.position ?? "") !== (l.position ?? "") || rename(l.description ?? "") !== (l.description ?? ""))
    if (changedLots.length) {
      console.log(`  Terrains · position / description : ${changedLots.length} terrain(s) — ${changedLots.map((l) => l.number).join(", ")}`)
      const sample = changedLots[0]
      console.log(excerpts(`${sample.position ?? ""} | ${sample.description ?? ""}`).slice(0, 2).join("\n"))
    }

    const settingsCount = Object.keys(data).length
    if (!settingsCount && !changedLots.length) {
      console.log("Rien à renommer : aucune mention de l'ancienne marque dans les paramètres ni dans les terrains.")
      return
    }
    console.log(`\n${settingsCount} champ(s) des paramètres et ${changedLots.length} terrain(s) concernés.`)
    if (!apply) {
      console.log("Simulation terminée : rien n'a été écrit.")
      return
    }

    const [lotRows] = await db.$transaction([
      db.$executeRaw`
        UPDATE "Lot" SET
          "position" = regexp_replace(regexp_replace("position", 'NADI\\s+Group', 'FUTURIA GROUP', 'gi'), '\\mNADI\\M', 'FUTURIA', 'g'),
          "description" = regexp_replace(regexp_replace("description", 'NADI\\s+Group', 'FUTURIA GROUP', 'gi'), '\\mNADI\\M', 'FUTURIA', 'g'),
          "updatedAt" = now()
        WHERE "position" ~ '\\mNADI\\M' OR "description" ~ '\\mNADI\\M' OR "position" ~* 'NADI\\s+Group' OR "description" ~* 'NADI\\s+Group'`,
      ...(settingsCount ? [db.settings.update({ where: { id: 1 }, data })] : []),
    ])
    console.log(`Écrit : ${settingsCount} champ(s) des paramètres, ${lotRows} terrain(s).`)
  } finally {
    await db.$disconnect()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
