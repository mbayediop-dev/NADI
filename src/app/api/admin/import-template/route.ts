import { db } from "@/lib/db"
import { getAdmin } from "@/lib/auth/admin"
import { buildWorkbook, MONEY_FMT, xlsxResponse, type SheetColumn } from "@/lib/excel"
import { compareLotNumbers } from "@/lib/format"
import { LOT_STATUS } from "@/lib/labels"
import { frequencyLabel, IMPORT_COLUMNS, type ImportKey } from "@/lib/lot-import"

type Row = Record<string, string | number | null>

const HELP: [string, string][] = [
  ["Numéro", "Obligatoire. Identifie le terrain : une ligne avec un numéro existant met ce terrain à jour, sinon un nouveau terrain est créé."],
  ["Superficie (m²)", "Obligatoire pour un nouveau terrain. Nombre (ex. 300)."],
  ["Prix, Acompte, Montant versement", "Montants en FCFA (ex. 8500000 ou 8 500 000). Montant versement vide = calcul automatique."],
  ["Nombre de versements", "Nombre d'échéances après l'acompte (0 = paiement comptant)."],
  ["Périodicité", "Hebdomadaire, Toutes les 2 semaines, Mensuel, Bimestriel, Trimestriel, Semestriel, Annuel, ou « Tous les 45 jours »."],
  ["Statut", "Disponible, Réservé ou Non commercialisé. Le statut des terrains vendus n'est jamais modifié."],
  ["Cellules vides", "Une cellule vide laisse la valeur actuelle inchangée lors d'une mise à jour."],
  ["Colonnes supplémentaires", "Les champs personnalisés (Paramètres › Champs personnalisés) peuvent être ajoutés avec leur libellé comme en-tête."],
]

/** Modèle Excel d'import des terrains (pré-rempli avec les terrains existants). */
export async function GET() {
  const admin = await getAdmin()
  if (!admin) return new Response("Non autorisé", { status: 401 })
  const [lots, fields] = await Promise.all([db.lot.findMany(), db.lotField.findMany({ orderBy: { sortOrder: "asc" } })])

  let rows: Row[] = lots
    .sort((a, b) => compareLotNumbers(a.number, b.number))
    .map((lot) => {
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
      }
      for (const f of fields) {
        const v = attrs[f.key]
        row[`attr_${f.key}`] = v == null ? null : typeof v === "boolean" ? (v ? "Oui" : "Non") : (v as string | number)
      }
      return row
    })

  if (rows.length === 0) {
    rows = [
      { number: "1", block: "A", areaM2: 300, price: 7500000, depositAmount: 2250000, installmentsCount: 12, frequency: "Mensuel", installmentAmount: null, status: "Disponible", soilType: "Sableux (dior)", position: "Façade sur rue principale", orientation: "Nord", frontageM: 15, depthM: 20, description: null },
      { number: "2", block: "A", areaM2: 300, price: 7500000, depositAmount: 2250000, installmentsCount: 4, frequency: "Trimestriel", installmentAmount: null, status: "Disponible", soilType: "Sableux (dior)", position: null, orientation: "Nord", frontageM: 15, depthM: 20, description: null },
      { number: "3", block: "B", areaM2: 400, price: 11000000, depositAmount: 0, installmentsCount: 24, frequency: "Mensuel", installmentAmount: 460000, status: "Disponible", soilType: null, position: "Angle de rue", orientation: "Sud", frontageM: 20, depthM: 20, description: "Lot d'angle" },
    ]
  }

  const money = new Set<ImportKey>(["price", "depositAmount", "installmentAmount"])
  const columns: SheetColumn<Row>[] = [
    ...IMPORT_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width, value: (r: Row) => r[c.key], numFmt: money.has(c.key) ? MONEY_FMT : undefined })),
    ...fields.map((f) => ({ header: f.label, key: `attr_${f.key}`, width: Math.max(14, f.label.length + 4), value: (r: Row) => r[`attr_${f.key}`] })),
  ]
  const help: Row[] = HELP.map(([a, b]) => ({ a, b }))
  const buffer = await buildWorkbook([
    { name: "Terrains", columns, rows },
    {
      name: "Mode d'emploi",
      columns: [
        { header: "Colonne", key: "a", width: 32, value: (r) => r.a },
        { header: "Explication", key: "b", width: 110, value: (r) => r.b },
      ],
      rows: help,
    },
  ])
  return xlsxResponse(buffer, "modele-import-terrains.xlsx")
}
