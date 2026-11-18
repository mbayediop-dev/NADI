import { Fragment } from "react"
import type { ExpenseCategory } from "@/generated/prisma/enums"
import { groupQuoteItems, quoteLineTotal, quoteTotal, type QuoteItem } from "@/lib/construction"
import { formatMoney, formatNumber } from "@/lib/format"
import { EXPENSE_CATEGORY } from "@/lib/labels"
import { cn } from "@/lib/utils"

// Éléments d'affichage de la construction communs à l'administration et à l'espace client.

/** Détail d'une offre : lignes regroupées par lot de travaux, sous-totaux et total. */
export function QuoteLines({ items, currency }: { items: QuoteItem[]; currency: string }) {
  const groups = groupQuoteItems(items)
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-y text-left text-xs text-muted-foreground">
            <th className="px-4 py-2 font-medium">Désignation</th>
            <th className="px-2 py-2 text-right font-medium">Quantité</th>
            <th className="px-2 py-2 text-right font-medium">Prix unitaire</th>
            <th className="px-4 py-2 text-right font-medium">Montant</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.section}>
              <tr className="bg-muted/30">
                <td colSpan={3} className="px-4 py-1.5 text-xs font-bold tracking-wide uppercase">
                  {group.section}
                </td>
                <td className="px-4 py-1.5 text-right text-xs font-bold tabular">{formatMoney(group.total, currency)}</td>
              </tr>
              {group.items.map((item, i) => (
                <tr key={i} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2">{item.label}</td>
                  <td className="px-2 py-2 text-right whitespace-nowrap tabular">
                    {formatNumber(item.quantity)}
                    {item.unit ? ` ${item.unit}` : ""}
                  </td>
                  <td className="px-2 py-2 text-right whitespace-nowrap tabular">{formatNumber(item.unitPrice)}</td>
                  <td className="px-4 py-2 text-right font-medium whitespace-nowrap tabular">{formatNumber(quoteLineTotal(item))}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2">
            <td colSpan={3} className="px-4 py-2.5 text-right font-semibold">
              Total
            </td>
            <td className="px-4 py-2.5 text-right text-base font-bold whitespace-nowrap tabular">{formatMoney(quoteTotal(items), currency)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

/** Répartition des dépenses par catégorie (barres horizontales). */
export function ExpenseBreakdown({ items, currency, className }: { items: { category: ExpenseCategory; amount: number }[]; currency: string; className?: string }) {
  const total = items.reduce((sum, i) => sum + i.amount, 0)
  if (total <= 0) return null
  return (
    <ul className={cn("space-y-2.5", className)}>
      {items.map((item) => (
        <li key={item.category}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: EXPENSE_CATEGORY[item.category].color }} />
              <span className="truncate">{EXPENSE_CATEGORY[item.category].label}</span>
            </span>
            <span className="shrink-0 tabular">
              <span className="font-semibold">{formatMoney(item.amount, currency)}</span>
              <span className="ml-1.5 text-xs text-muted-foreground">{Math.round((item.amount / total) * 100)} %</span>
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${(item.amount / total) * 100}%`, background: EXPENSE_CATEGORY[item.category].color }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
