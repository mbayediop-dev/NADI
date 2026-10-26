import { db } from "@/lib/db"
import { getAdmin } from "@/lib/auth/admin"
import { getSettings, planDefaults } from "@/lib/settings"
import { buildWorkbook, MONEY_FMT, xlsxResponse, type SheetColumn } from "@/lib/excel"
import { resolvePlan } from "@/lib/finance"
import { compareLotNumbers, fullName } from "@/lib/format"
import { LOT_STATUS } from "@/lib/labels"
import { frequencyLabel, IMPORT_COLUMNS, type ImportKey } from "@/lib/lot-import"
import { parsePolygon } from "@/lib/plan"

type Row = Record<string, string | number | null>

/** Export Excel de tous les terrains (colonnes réimportables + colonnes calculées). */
export async function GET() {
  const admin = await getAdmin()
  if (!admin) return new Response("Non autorisé", { status: 401 })
  const [settings, lots, fields] = await Promise.all([
    getSettings(),
    db.lot.findMany({
      include: { sales: { where: { status: { not: "CANCELLED" } }, include: { buyer: true }, take: 1, orderBy: { signedAt: "desc" } } },
    }),
    db.lotField.findMany({ orderBy: { sortOrder: "asc" } }),
  ])
  const defaults = planDefaults(settings)
  const rows: Row[] = lots
    .sort((a, b) => compareLotNumbers(a.number, b.number))
    .map((lot) => {
      const plan = resolvePlan(lot, defaults)
      const sale = lot.sales[0]
      const attrs = (lot.attributes ?? {}) as Record<string, unknown>
      const row: Row = {
        number: lot.number,
        block: lot.block,
        areaM2: lot.areaM2,
        price: lot.price,
        depositAmount: lot.depositAmount,
        installmentsCount: lot.installmentsCount,
        frequency: frequencyLabel(lot.frequency, lot.customIntervalDays) || null,
        installmentAmount: lot.installmentAmount,
        status: LOT_STATUS[lot.status].label,
        soilType: lot.soilType,
        position: lot.position,
        orientation: lot.orientation,
        frontageM: lot.frontageM,
        depthM: lot.depthM,
        description: lot.description,
        ppm2: lot.price ? Math.round(lot.price / lot.areaM2) : null,
        planDeposit: plan?.deposit ?? null,
        planPer: plan && plan.count > 0 ? `${plan.count} × ${plan.perInstallment} ${plan.per}` : plan ? "Comptant" : null,
        buyer: sale ? fullName(sale.buyer) : null,
        sale: sale?.reference ?? null,
        geometry: parsePolygon(lot.polygon) ? "Oui" : "Non",
      }
      for (const f of fields) {
        const v = attrs[f.key]
        row[`attr_${f.key}`] = v == null ? null : typeof v === "boolean" ? (v ? "Oui" : "Non") : (v as string | number)
      }
      return row
    })

  const money = new Set<ImportKey>(["price", "depositAmount", "installmentAmount"])
  const columns: SheetColumn<Row>[] = [
    ...IMPORT_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width, value: (r: Row) => r[c.key], numFmt: money.has(c.key) ? MONEY_FMT : undefined })),
    ...fields.map((f) => ({ header: f.label, key: `attr_${f.key}`, width: Math.max(14, f.label.length + 4), value: (r: Row) => r[`attr_${f.key}`] })),
    { header: "Prix / m²", key: "ppm2", width: 12, value: (r) => r.ppm2, numFmt: MONEY_FMT },
    { header: "Modalités", key: "planPer", width: 34, value: (r) => r.planPer },
    { header: "Acheteur", key: "buyer", width: 24, value: (r) => r.buyer },
    { header: "Vente", key: "sale", width: 16, value: (r) => r.sale },
    { header: "Géométrie", key: "geometry", width: 11, value: (r) => r.geometry },
  ]
  const buffer = await buildWorkbook([{ name: "Terrains", columns, rows }])
  const stamp = new Date().toISOString().slice(0, 10)
  return xlsxResponse(buffer, `terrains-${stamp}.xlsx`)
}
