// Remplace les terrains par ceux d'un plan de morcellement extrait (JSON + fond SVG, voir prisma/data/).
// Avec --reset, supprime d'abord les ventes (échéances, versements, documents de vente), les clients et les terrains.
//
// Usage :
//   npx tsx --conditions=react-server scripts/import-plan.ts prisma/data/plan-kayar.json --reset [options]   (simulation)
//   … --apply                                                                                                 (écriture)
// Options :
//   --price-per-m2=42000      prix = surface × prix au m², arrondi au millier (sinon « Prix sur demande ») ; devient le prix du m² du site
//   --delete-requests         supprime aussi les demandes de réservation
//   --site-location="…"       met à jour la localisation affichée du site (la superficie vient du JSON)
//   --backup-dir=<dossier>    sauvegarde JSON des données supprimées (obligatoire avec --reset --apply)
//
// Tout tient en une transaction de quelques requêtes (base distante : jamais de boucle de requêtes).
import "dotenv/config"
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { PrismaPg } from "@prisma/adapter-pg"
import { Prisma, PrismaClient } from "../src/generated/prisma/client"
import { databaseSsl } from "../src/lib/db-ssl"
import { polygonSchema } from "../src/lib/plan"
import { deleteObject, putObject, publicUrl } from "../src/lib/storage"

type PlanLot = { number: string; block: string; areaM2: number; frontageM: number | null; depthM: number | null; polygon: [number, number][] }
type PlanFile = { source: string; width: number; height: number; siteAreaM2: number; lots: PlanLot[] }

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith("--"))
const flag = (name: string) => args.includes(`--${name}`)
const option = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
if (!file) throw new Error("Indiquez le fichier JSON du plan")

const apply = flag("apply")
const reset = flag("reset")
const deleteRequests = flag("delete-requests")
const pricePerM2 = option("price-per-m2") ? Number(option("price-per-m2")) : null
const siteLocation = option("site-location") ?? null
const backupDir = option("backup-dir") ?? null
if (pricePerM2 != null && !(pricePerM2 > 0)) throw new Error("--price-per-m2 invalide")
if (apply && reset && !backupDir) throw new Error("--backup-dir est obligatoire pour une réinitialisation")

const plan = JSON.parse(readFileSync(file, "utf8")) as PlanFile
const svgPath = file.replace(/\.json$/, ".svg")
const svg = readFileSync(svgPath)

// Contrôles du plan avant toute écriture
const numbers = new Set(plan.lots.map((l) => l.number))
if (numbers.size !== plan.lots.length) throw new Error("numéros de terrain en double dans le plan")
for (const lot of plan.lots) {
  polygonSchema.parse(lot.polygon)
  if (!(lot.areaM2 > 0)) throw new Error(`surface invalide pour le terrain ${lot.number}`)
}
const priceOf = (area: number) => (pricePerM2 ? Math.round((area * pricePerM2) / 1000) * 1000 : null)

async function main() {
  const url = process.env.DATABASE_URL
  const host = (() => {
    try {
      return new URL(url ?? "").host
    } catch {
      return "?"
    }
  })()
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, ssl: databaseSsl(url) }) })
  try {
    console.log(`Base : ${host} — stockage : ${process.env.STORAGE_DRIVER ?? "local"} — ${apply ? "ÉCRITURE" : "simulation (ajoutez --apply pour écrire)"}`)
    console.log(`Plan : ${plan.source} — ${plan.lots.length} terrains, ${plan.lots.reduce((s, l) => s + l.areaM2, 0).toFixed(2)} m²`)
    if (pricePerM2) {
      const total = plan.lots.reduce((s, l) => s + (priceOf(l.areaM2) ?? 0), 0)
      console.log(`Prix : ${pricePerM2} FCFA/m² → de ${Math.min(...plan.lots.map((l) => priceOf(l.areaM2)!))} à ${Math.max(...plan.lots.map((l) => priceOf(l.areaM2)!))} FCFA (total ${total} FCFA)`)
    } else console.log("Prix : aucun (« Prix sur demande »)")

    const counts = {
      terrains: await db.lot.count(),
      ventes: await db.sale.count(),
      echeances: await db.installment.count(),
      versements: await db.payment.count(),
      documentsDeVente: await db.document.count({ where: { saleId: { not: null } } }),
      clients: await db.buyer.count(),
      demandes: await db.reservationRequest.count(),
      projetsDeConstruction: await db.constructionProject.count(),
    }
    console.log("Actuellement :", counts)
    if (!reset && counts.terrains > 0) throw new Error("La base contient déjà des terrains : utilisez --reset pour les remplacer.")
    if (counts.projetsDeConstruction > 0) {
      console.log("⚠️ Des projets de construction existent : ils sont conservés, sans lien vers leur ancien terrain ni leur client s'ils sont supprimés.")
    }
    if (!apply) {
      console.log(`Simulation : ${reset ? "suppression des terrains, ventes et clients" + (deleteRequests ? " et des demandes" : "") + ", puis " : ""}création de ${plan.lots.length} terrains.`)
      return
    }

    // 1. Sauvegarde de tout ce qui va être supprimé
    let backupFile: string | null = null
    if (reset) {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-")
      mkdirSync(backupDir!, { recursive: true })
      backupFile = path.join(backupDir!, `sauvegarde-avant-reinitialisation-${stamp}.json`)
      const [lots, sales, installments, payments, documents, buyers, requests] = await Promise.all([
        db.lot.findMany(),
        db.sale.findMany(),
        db.installment.findMany(),
        db.payment.findMany(),
        db.document.findMany({ where: { saleId: { not: null } } }),
        db.buyer.findMany(),
        db.reservationRequest.findMany(),
      ])
      writeFileSync(backupFile, JSON.stringify({ date: new Date().toISOString(), host, counts, lots, sales, installments, payments, documents, buyers, requests }, null, 1))
      console.log(`Sauvegarde : ${backupFile}`)
    }

    // 2. Fond du plan dans le stockage (servi par /api/files/public/…)
    const hash = createHash("sha256").update(svg).digest("hex").slice(0, 10)
    const key = `public/plan/${path.basename(svgPath, ".svg")}-${hash}.svg`
    await putObject(key, svg, "image/svg+xml")
    const planImageUrl = publicUrl(key)
    console.log(`Fond du plan : ${planImageUrl}`)

    // 3. Réinitialisation et import, en une transaction
    const docKeys = reset ? (await db.document.findMany({ where: { saleId: { not: null } }, select: { storageKey: true } })).map((d) => d.storageKey) : []
    const ops = []
    if (reset) {
      ops.push(
        db.payment.deleteMany(),
        db.installment.deleteMany(),
        db.document.deleteMany({ where: { saleId: { not: null } } }),
        ...(deleteRequests ? [db.reservationRequest.deleteMany()] : []),
        db.otpCode.deleteMany(),
        db.sale.deleteMany(),
        db.buyer.deleteMany(),
        db.lot.deleteMany(),
      )
    }
    ops.push(
      db.lot.createMany({
        data: plan.lots.map((l) => ({
          number: l.number,
          block: l.block,
          areaM2: l.areaM2,
          price: priceOf(l.areaM2),
          status: "AVAILABLE" as const,
          frontageM: l.frontageM,
          depthM: l.depthM,
          polygon: l.polygon,
        })),
      }),
      db.settings.update({
        where: { id: 1 },
        data: {
          planImageUrl,
          planWidth: plan.width,
          planHeight: plan.height,
          siteAreaM2: plan.siteAreaM2,
          ...(siteLocation ? { siteLocation } : {}),
          // Le prix au m² devient celui du site : les terrains le suivront (Admin → Terrains → Conditions de vente)
          ...(pricePerM2 ? { lotPricePerM2: pricePerM2, lotPriceRounding: 1000 } : {}),
        },
      }),
      db.activity.create({
        data: {
          type: "lot",
          message: `${reset ? "Terrains, ventes et clients réinitialisés — " : ""}${plan.lots.length} terrains importés du plan « ${plan.source} »`,
        },
      }),
    )
    const results = await db.$transaction(ops)
    console.log(`Transaction : ${results.length} opérations validées`)

    // 4. Fichiers des documents de vente supprimés
    let removed = 0
    for (const k of docKeys) {
      await deleteObject(k).then(() => removed++).catch(() => undefined)
    }
    if (docKeys.length) console.log(`Fichiers de documents de vente supprimés du stockage : ${removed}/${docKeys.length}`)

    const after = {
      terrains: await db.lot.count(),
      disponibles: await db.lot.count({ where: { status: "AVAILABLE" } }),
      avecForme: await db.lot.count({ where: { polygon: { not: Prisma.DbNull } } }),
      ventes: await db.sale.count(),
      versements: await db.payment.count(),
      clients: await db.buyer.count(),
      demandes: await db.reservationRequest.count(),
    }
    console.log("Après :", after)
  } finally {
    await db.$disconnect()
  }
}

main().catch((error) => {
  console.error("ÉCHEC — ", error instanceof Error ? error.message : error)
  process.exit(1)
})
