// Validation des terrains et import/export Excel (module pur, sans accès BD).
import { z } from "zod"
import type { FieldType, LotStatus, PaymentFrequency } from "@/generated/prisma/enums"
import { FREQUENCY, LOT_STATUS } from "@/lib/labels"
import { formatArea, formatMoney, formatNumber } from "@/lib/format"

export const FREQUENCIES = ["WEEKLY", "BIWEEKLY", "MONTHLY", "BIMONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "CUSTOM"] as const

const optText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null))
const optNumber = z
  .number()
  .nonnegative()
  .nullish()
  .transform((v) => (v == null || Number.isNaN(v) ? null : v))

/** Données d'un terrain (formulaire d'administration). */
export const lotSchema = z
  .object({
    number: z.string().trim().min(1, "Numéro requis").max(20, "Numéro trop long"),
    block: optText(20),
    areaM2: z.number({ error: "Surface requise" }).positive("La surface doit être positive"),
    frontageM: optNumber,
    depthM: optNumber,
    price: optNumber,
    depositAmount: optNumber,
    installmentsCount: z
      .number()
      .int()
      .min(0)
      .max(600)
      .nullish()
      .transform((v) => v ?? null),
    frequency: z
      .enum(FREQUENCIES)
      .nullish()
      .transform((v) => v ?? null),
    customIntervalDays: z
      .number()
      .int()
      .min(1)
      .max(730)
      .nullish()
      .transform((v) => v ?? null),
    installmentAmount: optNumber,
    status: z.enum(["AVAILABLE", "RESERVED", "UNAVAILABLE"]),
    reservedNote: optText(300),
    soilType: optText(80),
    position: optText(200),
    orientation: optText(40),
    description: optText(2000),
    features: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    isFeatured: z.boolean().default(false),
    attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
  })
  .refine((v) => v.price == null || v.depositAmount == null || v.depositAmount <= v.price, {
    message: "L'acompte ne peut pas dépasser le prix",
    path: ["depositAmount"],
  })
  .refine((v) => v.frequency !== "CUSTOM" || v.customIntervalDays, {
    message: "Indiquez l'intervalle en jours",
    path: ["customIntervalDays"],
  })

export type LotInput = z.input<typeof lotSchema>

// ─────────────────────────────────────────────────────────────
// Colonnes Excel
// ─────────────────────────────────────────────────────────────

export type ImportKey =
  | "number"
  | "block"
  | "areaM2"
  | "price"
  | "depositAmount"
  | "installmentsCount"
  | "frequency"
  | "installmentAmount"
  | "status"
  | "soilType"
  | "position"
  | "orientation"
  | "frontageM"
  | "depthM"
  | "description"

/** En-têtes officiels (ordre du modèle) */
export const IMPORT_COLUMNS: { key: ImportKey; header: string; width: number }[] = [
  { key: "number", header: "Numéro", width: 10 },
  { key: "block", header: "Îlot", width: 8 },
  { key: "areaM2", header: "Superficie (m²)", width: 15 },
  { key: "price", header: "Prix", width: 16 },
  { key: "depositAmount", header: "Acompte", width: 14 },
  { key: "installmentsCount", header: "Nombre de versements", width: 20 },
  { key: "frequency", header: "Périodicité", width: 20 },
  { key: "installmentAmount", header: "Montant versement", width: 18 },
  { key: "status", header: "Statut", width: 18 },
  { key: "soilType", header: "Type de sol", width: 26 },
  { key: "position", header: "Position", width: 40 },
  { key: "orientation", header: "Orientation", width: 12 },
  { key: "frontageM", header: "Façade (m)", width: 11 },
  { key: "depthM", header: "Profondeur (m)", width: 14 },
  { key: "description", header: "Description", width: 60 },
]

const ALIASES: Record<string, ImportKey> = {
  numero: "number", n: "number", no: "number", num: "number", lot: "number", numerolot: "number", numerodeterrain: "number", numeroterrain: "number", terrain: "number",
  ilot: "block", bloc: "block", zone: "block",
  superficie: "areaM2", superficiem2: "areaM2", surface: "areaM2", surfacem2: "areaM2", contenance: "areaM2",
  prix: "price", prixfcfa: "price", prixtotal: "price", prixdevente: "price",
  acompte: "depositAmount", apport: "depositAmount", acomptefcfa: "depositAmount",
  nombredeversements: "installmentsCount", nbversements: "installmentsCount", nbdeversements: "installmentsCount", versements: "installmentsCount", nombreecheances: "installmentsCount", nombredecheances: "installmentsCount", echeances: "installmentsCount",
  periodicite: "frequency", frequence: "frequency", periode: "frequency",
  montantversement: "installmentAmount", montantdeversement: "installmentAmount", montantdesversements: "installmentAmount", montantecheance: "installmentAmount", mensualite: "installmentAmount",
  statut: "status", etat: "status",
  typedesol: "soilType", typesol: "soilType", sol: "soilType", naturedusol: "soilType",
  position: "position", emplacement: "position", situation: "position",
  orientation: "orientation",
  facade: "frontageM", facadem: "frontageM", largeur: "frontageM", largeurm: "frontageM",
  profondeur: "depthM", profondeurm: "depthM", longueur: "depthM", longueurm: "depthM",
  description: "description", commentaire: "description",
}

/** Colonnes calculées de l'export, ignorées à l'import */
const IGNORED = new Set(["prixm2", "prixaum2", "acheteur", "vente", "geometrie", "plan", "modalites", "versementsprevus", "duree", "dateajout"])

export function normalizeHeader(value: string) {
  return value
    .replace(/²/g, "2")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

// ─────────────────────────────────────────────────────────────
// Conversion des valeurs
// ─────────────────────────────────────────────────────────────

export function parseNumberCell(value: unknown): number | null | "invalid" {
  if (value == null || value === "") return null
  if (typeof value === "number") return Number.isFinite(value) ? value : "invalid"
  const text = String(value)
    .replace(/fcfa|xof|cfa|m²|m2|\s| | /gi, "")
    .replace(/,/g, ".")
  if (!text) return null
  const n = Number(text)
  return Number.isFinite(n) ? n : "invalid"
}

export function parseFrequency(value: unknown): { frequency: PaymentFrequency; days?: number } | null | "invalid" {
  if (value == null || value === "") return null
  const raw = String(value).trim()
  if ((FREQUENCIES as readonly string[]).includes(raw.toUpperCase())) return { frequency: raw.toUpperCase() as PaymentFrequency }
  const t = normalizeHeader(raw)
  const days = raw.match(/(\d+)\s*j/i)
  if (days) return { frequency: "CUSTOM", days: Number(days[1]) }
  if (/^(hebdo|hebdomadaire|semaine|chaquesemaine|parsemaine)$/.test(t)) return { frequency: "WEEKLY" }
  if (/(2semaines|deuxsemaines|quinzaine|quinzomadaire|bihebdomadaire)/.test(t)) return { frequency: "BIWEEKLY" }
  if (/^(mensuel|mensuelle|mois|parmois|chaquemois)$/.test(t)) return { frequency: "MONTHLY" }
  if (/(bimestriel|bimestre|2mois|deuxmois)/.test(t)) return { frequency: "BIMONTHLY" }
  if (/(trimestriel|trimestre|3mois)/.test(t)) return { frequency: "QUARTERLY" }
  if (/(semestriel|semestre|6mois)/.test(t)) return { frequency: "SEMIANNUAL" }
  if (/^(annuel|annuelle|an|annee|parannee|paran|12mois)$/.test(t)) return { frequency: "ANNUAL" }
  return "invalid"
}

export function parseStatus(value: unknown): LotStatus | null | "invalid" {
  if (value == null || value === "") return null
  const t = normalizeHeader(String(value))
  if (["available", "disponible", "libre", "dispo"].includes(t)) return "AVAILABLE"
  if (["reserved", "reserve", "option", "reservee"].includes(t)) return "RESERVED"
  if (["unavailable", "noncommercialise", "horsvente", "indisponible", "noncommercialisee"].includes(t)) return "UNAVAILABLE"
  if (["sold", "vendu", "vendue", "attribue"].includes(t)) return "SOLD"
  return "invalid"
}

function parseBoolean(value: unknown): boolean | null | "invalid" {
  if (value == null || value === "") return null
  if (typeof value === "boolean") return value
  const t = normalizeHeader(String(value))
  if (["oui", "o", "yes", "y", "vrai", "true", "1", "x"].includes(t)) return true
  if (["non", "n", "no", "faux", "false", "0"].includes(t)) return false
  return "invalid"
}

export function frequencyLabel(frequency: PaymentFrequency | null, days?: number | null) {
  if (!frequency) return ""
  if (frequency === "CUSTOM") return `Tous les ${days ?? 30} jours`
  return FREQUENCY[frequency].label
}

// ─────────────────────────────────────────────────────────────
// Analyse d'un fichier
// ─────────────────────────────────────────────────────────────

export const importRowSchema = z.object({
  number: z.string().min(1).max(20),
  block: z.string().max(20).nullable().optional(),
  areaM2: z.number().positive().optional(),
  price: z.number().nonnegative().nullable().optional(),
  depositAmount: z.number().nonnegative().nullable().optional(),
  installmentsCount: z.number().int().min(0).max(600).nullable().optional(),
  frequency: z.enum(FREQUENCIES).nullable().optional(),
  customIntervalDays: z.number().int().min(1).max(730).nullable().optional(),
  installmentAmount: z.number().nonnegative().nullable().optional(),
  status: z.enum(["AVAILABLE", "RESERVED", "UNAVAILABLE"]).optional(),
  soilType: z.string().max(80).nullable().optional(),
  position: z.string().max(200).nullable().optional(),
  orientation: z.string().max(40).nullable().optional(),
  frontageM: z.number().nonnegative().nullable().optional(),
  depthM: z.number().nonnegative().nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
})

export type ImportRow = z.infer<typeof importRowSchema>

export type PreviewRow = {
  line: number
  number: string
  action: "create" | "update" | "unchanged" | "error"
  errors: string[]
  warnings: string[]
  changes: { label: string; from: string; to: string }[]
  data: ImportRow | null
}

export type ImportPreview = {
  rows: PreviewRow[]
  counts: { create: number; update: number; unchanged: number; error: number }
  recognized: string[]
  unknownHeaders: string[]
}

type ExistingLot = {
  id: string
  number: string
  block: string | null
  areaM2: number
  price: number | null
  depositAmount: number | null
  installmentsCount: number | null
  frequency: PaymentFrequency | null
  customIntervalDays: number | null
  installmentAmount: number | null
  status: LotStatus
  soilType: string | null
  position: string | null
  orientation: string | null
  frontageM: number | null
  depthM: number | null
  description: string | null
  attributes: unknown
}

type FieldDef = { key: string; label: string; type: FieldType; options: string[] }

const LABELS: Record<ImportKey, string> = Object.fromEntries(IMPORT_COLUMNS.map((c) => [c.key, c.header])) as Record<ImportKey, string>

function display(key: ImportKey | "customIntervalDays", value: unknown, row?: { customIntervalDays?: number | null }): string {
  if (value == null || value === "") return "—"
  switch (key) {
    case "price":
    case "depositAmount":
    case "installmentAmount":
      return formatMoney(value as number)
    case "areaM2":
      return formatArea(value as number)
    case "frequency":
      return frequencyLabel(value as PaymentFrequency, row?.customIntervalDays)
    case "status":
      return LOT_STATUS[value as LotStatus].label
    case "installmentsCount":
    case "frontageM":
    case "depthM":
    case "customIntervalDays":
      return formatNumber(value as number)
    default:
      return String(value)
  }
}

export function analyzeImport(
  sheet: { headers: string[]; rows: Record<string, unknown>[] },
  ctx: { lots: ExistingLot[]; fields: FieldDef[]; lockedLotIds: Set<string> },
): ImportPreview {
  const mapping = new Map<string, { kind: "core"; key: ImportKey } | { kind: "field"; field: FieldDef }>()
  const recognized: string[] = []
  const unknownHeaders: string[] = []
  const fieldByName = new Map<string, FieldDef>()
  for (const f of ctx.fields) {
    fieldByName.set(normalizeHeader(f.label), f)
    fieldByName.set(normalizeHeader(f.key), f)
  }
  for (const header of sheet.headers) {
    if (!header) continue
    const norm = normalizeHeader(header)
    const core = ALIASES[norm]
    const field = fieldByName.get(norm)
    if (core && ![...mapping.values()].some((m) => m.kind === "core" && m.key === core)) {
      mapping.set(header, { kind: "core", key: core })
      recognized.push(header)
    } else if (field) {
      mapping.set(header, { kind: "field", field })
      recognized.push(header)
    } else if (!IGNORED.has(norm)) {
      unknownHeaders.push(header)
    }
  }

  const byNumber = new Map(ctx.lots.map((l) => [l.number.toLowerCase(), l]))
  const seen = new Set<string>()
  const rows: PreviewRow[] = []

  sheet.rows.forEach((raw, i) => {
    const line = i + 2
    const errors: string[] = []
    const warnings: string[] = []
    const data: Record<string, unknown> & { attributes: Record<string, string | number | boolean | null> } = { attributes: {} }

    for (const [header, target] of mapping) {
      const value = raw[header]
      if (target.kind === "field") {
        const f = target.field
        if (value == null || value === "") continue
        if (f.type === "NUMBER") {
          const n = parseNumberCell(value)
          if (n === "invalid") warnings.push(`« ${f.label} » : nombre invalide, ignoré`)
          else data.attributes[f.key] = n
        } else if (f.type === "BOOLEAN") {
          const b = parseBoolean(value)
          if (b === "invalid") warnings.push(`« ${f.label} » : utilisez Oui ou Non`)
          else data.attributes[f.key] = b
        } else if (f.type === "SELECT") {
          const text = String(value).trim()
          const option = f.options.find((o) => normalizeHeader(o) === normalizeHeader(text))
          if (!option) warnings.push(`« ${f.label} » : valeur « ${text} » hors liste`)
          data.attributes[f.key] = option ?? text
        } else {
          data.attributes[f.key] = String(value instanceof Date ? value.toLocaleDateString("fr-FR") : value).trim()
        }
        continue
      }
      const key = target.key
      if (["areaM2", "price", "depositAmount", "installmentsCount", "installmentAmount", "frontageM", "depthM"].includes(key)) {
        const n = parseNumberCell(value)
        if (n === "invalid") errors.push(`${LABELS[key]} : valeur numérique invalide (« ${String(value)} »)`)
        else if (n != null && n < 0) errors.push(`${LABELS[key]} : la valeur doit être positive`)
        else if (n != null) {
          if (key === "installmentsCount" && !Number.isInteger(n)) errors.push(`${LABELS[key]} : nombre entier attendu`)
          data[key] = key === "areaM2" || key === "frontageM" || key === "depthM" ? n : Math.round(n)
        }
      } else if (key === "frequency") {
        const f = parseFrequency(value)
        if (f === "invalid") errors.push(`Périodicité inconnue : « ${String(value)} »`)
        else if (f) {
          data.frequency = f.frequency
          data.customIntervalDays = f.days ?? null
        }
      } else if (key === "status") {
        const s = parseStatus(value)
        if (s === "invalid") errors.push(`Statut inconnu : « ${String(value)} »`)
        else if (s === "SOLD") {
          // « Vendu » n'est posé que par une vente : ignoré
        } else if (s) data.status = s
      } else if (key === "number") {
        const text = value == null ? "" : String(value).trim()
        if (text) data.number = text.replace(/\.0+$/, "")
      } else {
        const text = value == null ? "" : String(value).trim()
        if (text) data[key] = text
      }
    }

    const number = typeof data.number === "string" ? data.number : ""
    if (!number) errors.push("Numéro manquant")
    else if (number.length > 20) errors.push("Numéro trop long (20 caractères max.)")
    else if (seen.has(number.toLowerCase())) errors.push("Numéro en double dans le fichier")
    if (number) seen.add(number.toLowerCase())

    const existing = number ? byNumber.get(number.toLowerCase()) : undefined
    if (!existing && number && data.areaM2 == null) errors.push("Superficie obligatoire pour un nouveau terrain")
    if (data.areaM2 === 0) errors.push("La superficie doit être supérieure à 0")

    const price = (data.price as number | null | undefined) ?? existing?.price ?? null
    const deposit = (data.depositAmount as number | null | undefined) ?? existing?.depositAmount ?? null
    if (price != null && deposit != null && deposit > price) errors.push("L'acompte dépasse le prix")

    if (existing && ctx.lockedLotIds.has(existing.id) && data.status) {
      warnings.push("Terrain attribué : statut conservé")
      delete data.status
    }
    if (existing?.status === "SOLD" && data.status) delete data.status

    if (errors.length) {
      rows.push({ line, number: number || "—", action: "error", errors, warnings, changes: [], data: null })
      return
    }

    const parsed = importRowSchema.safeParse(data)
    if (!parsed.success) {
      rows.push({ line, number, action: "error", errors: parsed.error.issues.map((e) => e.message), warnings, changes: [], data: null })
      return
    }

    const changes: PreviewRow["changes"] = []
    if (existing) {
      for (const key of Object.keys(LABELS) as ImportKey[]) {
        if (key === "number" || !(key in parsed.data)) continue
        const next = (parsed.data as Record<string, unknown>)[key]
        const prev = (existing as unknown as Record<string, unknown>)[key]
        const same = (next ?? null) === (prev ?? null) && (key !== "frequency" || (parsed.data.customIntervalDays ?? null) === existing.customIntervalDays)
        if (!same) changes.push({ label: LABELS[key], from: display(key, prev, existing), to: display(key, next, parsed.data) })
      }
      const currentAttrs = (existing.attributes ?? {}) as Record<string, unknown>
      for (const [k, v] of Object.entries(parsed.data.attributes)) {
        if ((currentAttrs[k] ?? null) !== v) {
          const label = ctx.fields.find((f) => f.key === k)?.label ?? k
          changes.push({ label, from: currentAttrs[k] == null ? "—" : String(currentAttrs[k]), to: v == null ? "—" : typeof v === "boolean" ? (v ? "Oui" : "Non") : String(v) })
        }
      }
    }

    rows.push({
      line,
      number,
      action: existing ? (changes.length ? "update" : "unchanged") : "create",
      errors: [],
      warnings,
      changes,
      data: parsed.data,
    })
  })

  const counts = { create: 0, update: 0, unchanged: 0, error: 0 }
  for (const r of rows) counts[r.action]++
  return { rows, counts, recognized, unknownHeaders }
}
