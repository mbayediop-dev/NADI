// Vérifie la connexion à la base (DATABASE_URL puis DIRECT_URL) avec le même client que l'application.
// Usage : npm run db:check
import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import { databaseSsl } from "../src/lib/db-ssl"

function describe(url: string) {
  try {
    const u = new URL(url)
    return `${u.hostname}:${u.port || "5432"}${u.search}`
  } catch {
    return "(URL invalide)"
  }
}

async function check(label: string, url: string | undefined) {
  if (!url) {
    console.log(`– ${label} : non définie`)
    return true
  }
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, ssl: databaseSsl(url) }) })
  try {
    const [settings, lots, version] = await Promise.all([
      db.settings.findUnique({ where: { id: 1 }, select: { companyName: true, siteName: true } }),
      db.lot.count(),
      db.$queryRaw<{ v: string }[]>`select split_part(version(), ' on ', 1) as v`,
    ])
    console.log(`✓ ${label} (${describe(url)}) : ${version[0]?.v} — ${settings?.companyName ?? "paramètres absents"}, ${lots} terrains`)
    return true
  } catch (error) {
    console.error(`✗ ${label} (${describe(url)}) :`, error instanceof Error ? error.message.split("\n").filter(Boolean).slice(-6).join("\n  ") : error)
    return false
  } finally {
    await db.$disconnect()
  }
}

// DIRECT_URL porte « sslmode=require » pour la CLI Prisma ; ici le TLS est géré par databaseSsl(), on retire donc ses paramètres.
function withoutParams(url: string | undefined) {
  return url?.replace(/\?.*$/, "")
}

async function main() {
  const ok = await check("DATABASE_URL (application)", process.env.DATABASE_URL)
  const ok2 = await check("DIRECT_URL (CLI Prisma)", withoutParams(process.env.DIRECT_URL))
  process.exit(ok && ok2 ? 0 : 1)
}
main()
