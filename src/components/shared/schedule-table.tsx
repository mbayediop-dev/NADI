import type { ScheduleRow } from "@/lib/finance"
import { formatDate, formatMoney } from "@/lib/format"
import { INSTALLMENT_STATUS } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { ToneBadge } from "@/components/shared/badges"

/** Échéancier d'une vente (tableau sur grand écran, liste compacte sur mobile). */
export function ScheduleTable({ rows, currency, className }: { rows: ScheduleRow[]; currency?: string; className?: string }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Aucune échéance.</p>
  }
  return (
    <div className={cn("overflow-hidden rounded-xl border", className)}>
      <table className="hidden w-full text-sm md:table">
        <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Échéance</th>
            <th className="px-4 py-2.5 font-medium">Date</th>
            <th className="px-4 py-2.5 text-right font-medium">Montant</th>
            <th className="px-4 py-2.5 text-right font-medium">Payé</th>
            <th className="px-4 py-2.5 text-right font-medium">Reste</th>
            <th className="px-4 py-2.5 text-right font-medium">Statut</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.index} className={cn(row.state === "LATE" && "bg-status-sold/5")}>
              <td className="px-4 py-2.5 font-medium">{row.label}</td>
              <td className="px-4 py-2.5 text-muted-foreground tabular">{formatDate(row.dueDate)}</td>
              <td className="px-4 py-2.5 text-right tabular">{formatMoney(row.amount, currency)}</td>
              <td className="px-4 py-2.5 text-right tabular text-status-available-strong">{row.paid > 0 ? formatMoney(row.paid, currency) : "—"}</td>
              <td className="px-4 py-2.5 text-right font-medium tabular">{row.remaining > 0 ? formatMoney(row.remaining, currency) : "—"}</td>
              <td className="px-4 py-2.5 text-right">
                <ToneBadge tone={INSTALLMENT_STATUS[row.state].tone}>{INSTALLMENT_STATUS[row.state].label}</ToneBadge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y md:hidden">
        {rows.map((row) => (
          <li key={row.index} className={cn("flex items-center justify-between gap-3 px-4 py-3", row.state === "LATE" && "bg-status-sold/5")}>
            <div className="min-w-0">
              <p className="text-sm font-medium">{row.label}</p>
              <p className="text-xs text-muted-foreground tabular">{formatDate(row.dueDate)}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-sm font-semibold tabular">{formatMoney(row.remaining > 0 ? row.remaining : row.amount, currency)}</span>
              <ToneBadge tone={INSTALLMENT_STATUS[row.state].tone} className="h-5 px-2 text-[0.68rem]">
                {INSTALLMENT_STATUS[row.state].label}
              </ToneBadge>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
