import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { AlertTriangle, CalendarDays, ChevronRight, ReceiptText, Wallet } from "lucide-react"
import { requireBuyer } from "@/lib/auth/client"
import { getSettings } from "@/lib/settings"
import { getOwnerSales } from "@/lib/queries/portal"
import { durationLabel, frequencyPer } from "@/lib/finance"
import { formatArea, formatDate, formatMoney, formatNumber } from "@/lib/format"
import { PAYMENT_METHOD, SALE_STATUS } from "@/lib/labels"
import { Skeleton } from "@/components/ui/skeleton"
import { ToneBadge } from "@/components/shared/badges"
import { ScheduleTable } from "@/components/shared/schedule-table"
import { PageTitle, PortalCard } from "@/components/portal/card"

export const metadata: Metadata = { title: "Mes paiements" }

export default function PaymentsPage() {
  return (
    <>
      <PageTitle title="Mes paiements" description="Votre échéancier, vos versements et vos reçus." />
      <Suspense fallback={<PaymentsSkeleton />}>
        <PaymentsContent />
      </Suspense>
    </>
  )
}

async function PaymentsContent() {
  const buyer = await requireBuyer()
  const [settings, sales] = await Promise.all([getSettings(), getOwnerSales(buyer.id)])
  const currency = settings.currencyLabel

  if (sales.length === 0) {
    return <p className="rounded-3xl border bg-card p-8 text-center text-muted-foreground">Aucun paiement à afficher.</p>
  }

  const totals = sales.reduce(
    (acc, s) => ({
      price: acc.price + s.summary.price,
      paid: acc.paid + s.summary.totalPaid,
      remaining: acc.remaining + s.summary.remaining,
      overdue: acc.overdue + s.summary.overdueAmount,
    }),
    { price: 0, paid: 0, remaining: 0, overdue: 0 },
  )
  const allPayments = sales
    .flatMap((s) => s.payments.map((p) => ({ ...p, lotNumber: s.lot.number })))
    .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime())

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Total label="Montant total" value={formatMoney(totals.price, currency)} />
        <Total label="Déjà payé" value={formatMoney(totals.paid, currency)} tone="text-status-available-strong" />
        <Total label="Reste à payer" value={formatMoney(totals.remaining, currency)} tone="text-primary" />
        <Total
          label="En retard"
          value={totals.overdue > 0 ? formatMoney(totals.overdue, currency) : "Aucun"}
          tone={totals.overdue > 0 ? "text-status-sold-strong" : "text-muted-foreground"}
        />
      </dl>

      {sales.map((sale) => {
        const { summary } = sale
        const percent = Math.floor(summary.progress * 100)
        return (
          <PortalCard key={sale.id} bodyClassName="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold">Terrain n° {sale.lot.number}</h2>
                  <ToneBadge tone={SALE_STATUS[sale.status].tone}>{SALE_STATUS[sale.status].label}</ToneBadge>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {sale.lot.block && `Îlot ${sale.lot.block} · `}
                  {formatArea(sale.lot.areaM2)} · Vente {sale.reference} du {formatDate(sale.signedAt)}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-xs text-muted-foreground">Payé</p>
                <p className="text-lg font-bold tabular">
                  {formatMoney(summary.totalPaid, currency)} <span className="text-sm font-medium text-muted-foreground">/ {formatMoney(summary.price, currency)}</span>
                </p>
              </div>
            </div>

            <div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-status-available" style={{ width: `${percent}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                <span>{percent}% réglé</span>
                <span>
                  Reste <strong className="text-foreground tabular">{formatMoney(summary.remaining, currency)}</strong>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm">
              <Info label="Acompte" value={sale.depositAmount > 0 ? formatMoney(sale.depositAmount, currency) : "Aucun"} />
              <Info
                label="Versements"
                value={sale.installmentsCount > 0 ? `${formatNumber(sale.installmentsCount)} versement${sale.installmentsCount > 1 ? "s" : ""}` : "Paiement unique"}
                hint={sale.installmentsCount > 0 ? frequencyPer(sale.frequency, sale.customIntervalDays) : undefined}
              />
              <Info label="Durée" value={sale.installmentsCount > 0 ? durationLabel(sale.installmentsCount, sale.frequency, sale.customIntervalDays) : "—"} />
            </div>

            {summary.overdueAmount > 0 && (
              <p className="flex items-start gap-2 rounded-2xl bg-status-sold/10 px-4 py-3 text-sm text-status-sold-strong">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  <strong>{formatMoney(summary.overdueAmount, currency)}</strong> en retard ({formatNumber(summary.overdueCount)} échéance
                  {summary.overdueCount > 1 ? "s" : ""}). Merci de contacter NADI Group pour régulariser.
                </span>
              </p>
            )}

            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
                <CalendarDays className="size-4 text-primary" />
                Échéancier
              </h3>
              <ScheduleTable rows={summary.rows} currency={currency} />
            </div>
          </PortalCard>
        )
      })}

      <PortalCard title="Historique des versements" icon={ReceiptText} bodyClassName="pt-3" className="scroll-mt-24">
        <div id="historique" className="scroll-mt-24" />
        {allPayments.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Aucun versement enregistré pour le moment.</p>
        ) : (
          <ul className="divide-y">
            {allPayments.map((p) => (
              <li key={p.id}>
                <Link href={`/espace-client/recus/${p.id}`} className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-muted/50">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-status-available/12 text-status-available-strong">
                    <Wallet className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-bold tabular">{formatMoney(p.amount, currency)}</span>
                      {sales.length > 1 && <span className="text-xs text-muted-foreground">Terrain n° {p.lotNumber}</span>}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {formatDate(p.paidAt)} · {PAYMENT_METHOD[p.method]} · <span className="tabular">{p.receiptNumber}</span>
                    </span>
                  </span>
                  <span className="hidden items-center gap-1 text-sm font-semibold text-primary sm:flex">
                    Voir le reçu
                    <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground sm:hidden" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PortalCard>
    </div>
  )
}

function Total({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-3xl border bg-card p-4 shadow-xs">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={`mt-1 text-base font-bold tabular sm:text-xl ${tone ?? ""}`}>{value}</dd>
    </div>
  )
}

function Info({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-muted/60 px-3 py-2.5 sm:px-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-[0.8rem] leading-snug font-semibold tabular sm:text-sm">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function PaymentsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-3xl" />
        ))}
      </div>
      <Skeleton className="h-[520px] rounded-3xl" />
    </div>
  )
}
