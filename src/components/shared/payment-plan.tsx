import { CalendarClock, Coins, Repeat, Wallet } from "lucide-react"
import type { PaymentPlan } from "@/lib/finance"
import { formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Résumé des modalités de paiement d'un terrain (acompte, versements, durée). */
export function PaymentPlanSummary({ plan, currency, className }: { plan: PaymentPlan; currency?: string; className?: string }) {
  const items = [
    { icon: Wallet, label: "Acompte", value: plan.deposit > 0 ? formatMoney(plan.deposit, currency) : "Aucun" },
    {
      icon: Repeat,
      label: "Versements",
      value: plan.count > 0 ? `${plan.count} × ${formatMoney(plan.perInstallment, currency)}` : "Paiement comptant",
      hint: plan.count > 0 ? plan.per : undefined,
    },
    { icon: CalendarClock, label: "Durée", value: plan.count > 0 ? plan.duration : "—" },
    { icon: Coins, label: "Reste après acompte", value: formatMoney(plan.balance, currency) },
  ]
  return (
    <dl className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border", className)}>
      {items.map(({ icon: Icon, label, value, hint }) => (
        <div key={label} className="bg-card p-3">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon className="size-3.5" />
            {label}
          </dt>
          <dd className="mt-1 text-sm font-semibold tabular">{value}</dd>
          {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
        </div>
      ))}
    </dl>
  )
}
