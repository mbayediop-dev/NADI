// Construction : calculs et règles communes (module pur, utilisable côté serveur et client).
import { z } from "zod"
import type { ConstructionStatus, ExpenseCategory, LandOrigin } from "@/generated/prisma/enums"
import { summarizeSale, type SaleSummary } from "@/lib/finance"
import { formatArea } from "@/lib/format"

// ─────────────────────────────────────────────────────────────
// Offre (devis) : lignes regroupées par lot de travaux
// ─────────────────────────────────────────────────────────────

export const quoteItemSchema = z.object({
  section: z.string().trim().max(80).default(""),
  label: z.string().trim().min(1, "Désignation requise").max(200),
  quantity: z.number().finite().nonnegative().default(1),
  unit: z.string().trim().max(20).default(""),
  unitPrice: z.number().finite().nonnegative().default(0),
})

export type QuoteItem = z.output<typeof quoteItemSchema>

/** Lignes d'une offre lues depuis la base (JSON) : les entrées invalides sont ignorées. */
export function parseQuoteItems(value: unknown): QuoteItem[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const parsed = quoteItemSchema.safeParse(item)
    return parsed.success ? [parsed.data] : []
  })
}

export function quoteLineTotal(item: Pick<QuoteItem, "quantity" | "unitPrice">) {
  return Math.round(item.quantity * item.unitPrice)
}

export function quoteTotal(items: Pick<QuoteItem, "quantity" | "unitPrice">[]) {
  return items.reduce((sum, item) => sum + quoteLineTotal(item), 0)
}

/** Lignes regroupées par lot de travaux, dans l'ordre de première apparition. */
export function groupQuoteItems(items: QuoteItem[]) {
  const groups: { section: string; items: QuoteItem[]; total: number }[] = []
  for (const item of items) {
    const section = item.section || "Travaux"
    let group = groups.find((g) => g.section === section)
    if (!group) groups.push((group = { section, items: [], total: 0 }))
    group.items.push(item)
    group.total += quoteLineTotal(item)
  }
  return groups
}

// ─────────────────────────────────────────────────────────────
// Étapes du chantier
// ─────────────────────────────────────────────────────────────

/** Étapes proposées à la création d'un chantier ; « weight » = part de l'étape dans l'avancement global. */
export const DEFAULT_PHASES: { title: string; weight: number }[] = [
  { title: "Études, plans et permis de construire", weight: 5 },
  { title: "Terrassement et fondations", weight: 15 },
  { title: "Élévation des murs", weight: 20 },
  { title: "Dalles et planchers", weight: 15 },
  { title: "Toiture et étanchéité", weight: 10 },
  { title: "Menuiseries (portes, fenêtres)", weight: 8 },
  { title: "Électricité et plomberie", weight: 10 },
  { title: "Enduits, carrelage et peinture", weight: 12 },
  { title: "Finitions et remise des clés", weight: 5 },
]

/** Avancement global en % : moyenne des étapes pondérée par leur poids. */
export function overallProgress(phases: { progress: number; weight: number }[]) {
  const totalWeight = phases.reduce((sum, p) => sum + Math.max(0, p.weight), 0)
  if (totalWeight <= 0) return 0
  return Math.round(phases.reduce((sum, p) => sum + Math.max(0, Math.min(100, p.progress)) * Math.max(0, p.weight), 0) / totalWeight)
}

// ─────────────────────────────────────────────────────────────
// Statuts
// ─────────────────────────────────────────────────────────────

/** Demande ou étude : aucun engagement financier. */
export const PRE_CONTRACT: ConstructionStatus[] = ["REQUESTED", "STUDY", "OFFER_SENT"]
/** Offre acceptée : versements et dépenses possibles. */
export const UNDER_CONTRACT: ConstructionStatus[] = ["SIGNED", "IN_PROGRESS", "SUSPENDED", "DELIVERED"]

export function isUnderContract(status: ConstructionStatus) {
  return UNDER_CONTRACT.includes(status)
}

// ─────────────────────────────────────────────────────────────
// Situation d'un projet : versements, dépenses, avancement
// ─────────────────────────────────────────────────────────────

export type ProjectLike = {
  status: ConstructionStatus
  contractAmount: number | null
  installments: { id?: string; index: number; label: string; dueDate: Date | string; amount: number }[]
  payments: { amount: number; paidAt: Date | string }[]
  expenses: { amount: number; category: ExpenseCategory; visibleToClient?: boolean }[]
  phases: { progress: number; weight: number }[]
}

export type ProjectSummary = {
  /** Montant du contrat ; à défaut, total des appels de fonds */
  contract: number
  /** Situation des versements (même calcul que pour une vente : imputation dans l'ordre des échéances) */
  finance: SaleSummary
  spent: number
  /** Encaissé − dépensé : trésorerie du chantier à ce jour */
  balance: number
  /** Contrat − dépensé : marge prévisionnelle si le contrat est entièrement encaissé */
  margin: number
  progress: number
  byCategory: { category: ExpenseCategory; amount: number }[]
}

export function summarizeProject(project: ProjectLike, now: Date = new Date()): ProjectSummary {
  const scheduled = project.installments.reduce((sum, i) => sum + i.amount, 0)
  const contract = Math.round(project.contractAmount ?? scheduled)
  const finance = summarizeSale(
    {
      price: contract,
      status: project.status === "CANCELLED" ? "CANCELLED" : isUnderContract(project.status) ? "ACTIVE" : "COMPLETED",
      installments: project.installments,
      payments: project.payments,
    },
    now,
  )
  const spent = project.expenses.reduce((sum, e) => sum + e.amount, 0)
  const totals = new Map<ExpenseCategory, number>()
  for (const e of project.expenses) totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount)
  return {
    contract,
    finance,
    spent,
    balance: finance.totalPaid - spent,
    margin: contract - spent,
    progress: overallProgress(project.phases),
    byCategory: [...totals.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
  }
}

/** Total des dépenses par catégorie, de la plus élevée à la plus faible. */
export function expensesByCategory(expenses: { amount: number; category: ExpenseCategory }[]) {
  const totals = new Map<ExpenseCategory, number>()
  for (const e of expenses) totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount)
  return [...totals.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount)
}

// ─────────────────────────────────────────────────────────────
// Terrain
// ─────────────────────────────────────────────────────────────

/** Libellé court du terrain d'un projet : « Terrain n° B-05 », « Terrain à Thiès (300 m²) », « Sans terrain ». */
export function landLabel(project: {
  landOrigin: LandOrigin
  lot?: { number: string; block?: string | null } | null
  landAddress?: string | null
  landAreaM2?: number | null
}) {
  if (project.landOrigin === "COMPANY_LOT") return project.lot ? `Terrain n° ${project.lot.number}` : "Terrain du lotissement"
  if (project.landOrigin === "OWN_LAND") {
    const where = project.landAddress?.trim()
    const area = project.landAreaM2 ? formatArea(project.landAreaM2) : null
    return `Terrain du client${where ? ` — ${where}` : ""}${area ? ` (${area})` : ""}`
  }
  return "Sans terrain pour l'instant"
}
