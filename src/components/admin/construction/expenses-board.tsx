"use client"

import * as React from "react"
import { Search } from "lucide-react"
import type { ExpenseCategory } from "@/generated/prisma/enums"
import { expensesByCategory } from "@/lib/construction"
import { formatMoney } from "@/lib/format"
import { EXPENSE_CATEGORY, EXPENSE_CATEGORY_ORDER } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/admin/sales/card"
import { ExpenseBreakdown, ExpenseList, type ExpenseContext, type ExpenseRow } from "@/components/admin/construction/expenses"

export type ExpensesFilter = "all" | "site" | "projects"

const FILTER_LABELS: Record<ExpensesFilter, string> = { all: "Toutes", site: "Lotissement", projects: "Chantiers des clients" }
const ALL = "all"

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()

/** Toutes les dépenses (lotissement et chantiers) : filtres, recherche, total et répartition de la sélection. */
export function ExpensesBoard({
  expenses,
  context,
  canEdit,
  initialFilter,
}: {
  expenses: ExpenseRow[]
  context: ExpenseContext
  canEdit: boolean
  initialFilter: ExpensesFilter
}) {
  const [filter, setFilter] = React.useState<ExpensesFilter>(initialFilter)
  const [category, setCategory] = React.useState<ExpenseCategory | typeof ALL>(ALL)
  const [month, setMonth] = React.useState(ALL)
  const [query, setQuery] = React.useState("")

  const months = React.useMemo(() => [...new Set(expenses.map((e) => e.spentAt.slice(0, 7)))].sort().reverse(), [expenses])
  const monthLabel = (m: string) => new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-15T12:00:00Z`))

  const data = React.useMemo(() => {
    const q = norm(query.trim())
    return expenses.filter(
      (e) =>
        (filter === "all" || (filter === "site" ? e.scope === "SITE" : e.scope === "PROJECT")) &&
        (category === ALL || e.category === category) &&
        (month === ALL || e.spentAt.startsWith(month)) &&
        (!q || norm(`${e.label} ${e.supplier ?? ""} ${e.reference ?? ""} ${e.projectLabel ?? ""} ${e.note ?? ""}`).includes(q)),
    )
  }, [expenses, filter, category, month, query])

  const total = data.reduce((sum, e) => sum + e.amount, 0)
  const breakdown = React.useMemo(() => expensesByCategory(data), [data])

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          {(Object.keys(FILTER_LABELS) as ExpensesFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-sm font-medium transition-colors",
                filter === f ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
              )}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_200px_190px]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Désignation, fournisseur, chantier…" className="pl-9" aria-label="Rechercher une dépense" />
          </div>
          <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory | typeof ALL)}>
            <SelectTrigger className="w-full" aria-label="Catégorie">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toutes les catégories</SelectItem>
              {EXPENSE_CATEGORY_ORDER.map((c) => (
                <SelectItem key={c} value={c}>
                  {EXPENSE_CATEGORY[c].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-full first-letter:uppercase" aria-label="Période">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toute la période</SelectItem>
              {months.map((m) => (
                <SelectItem key={m} value={m} className="first-letter:uppercase">
                  {monthLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <section className="overflow-hidden rounded-2xl border bg-card shadow-xs">
          <header className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3.5">
            <p className="text-sm text-muted-foreground">
              {data.length} dépense{data.length > 1 ? "s" : ""}
            </p>
            <p className="text-sm">
              Total : <strong className="text-base tabular">{formatMoney(total, context.currency)}</strong>
            </p>
          </header>
          <div className="border-t">
            <ExpenseList expenses={data} context={context} canEdit={canEdit} showProject empty="Aucune dépense ne correspond à ces critères." />
          </div>
        </section>
      </div>

      <Card title="Répartition" description="Sur la sélection affichée">
        <div className="px-5 pb-5">
          {breakdown.length ? <ExpenseBreakdown items={breakdown} currency={context.currency} /> : <p className="text-sm text-muted-foreground">Aucune dépense à répartir.</p>}
        </div>
      </Card>
    </div>
  )
}
