import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { AlertTriangle, ArrowUpRight, Ban, CalendarClock, CheckCircle2, Coins, Hourglass, Mail, MapPin, Phone, Wallet } from "lucide-react"
import { hasRole, requireAdmin } from "@/lib/auth/admin"
import { getSettings } from "@/lib/settings"
import { getSaleDetail } from "@/lib/queries/sales"
import { durationLabel, frequencyPer } from "@/lib/finance"
import { formatArea, formatDate, formatDateLong, formatMoney, formatPercent, fullName } from "@/lib/format"
import { SALE_STATUS } from "@/lib/labels"
import { formatPhone } from "@/lib/phone"
import { PageHeader } from "@/components/admin/page-header"
import { StatCard } from "@/components/admin/stat-card"
import { ToneBadge } from "@/components/shared/badges"
import { ScheduleTable } from "@/components/shared/schedule-table"
import { Skeleton } from "@/components/ui/skeleton"
import { SaleActions } from "@/components/admin/sales/sale-actions"
import { SalePayments } from "@/components/admin/sales/sale-payments"
import { SaleDocuments, SaleNotes } from "@/components/admin/sales/sale-documents"
import { PaymentProgress } from "@/components/admin/sales/payment-progress"
import { Card } from "@/components/admin/sales/card"
import { Amount } from "@/components/admin/sales/amount"

export const metadata: Metadata = { title: "Vente" }

export default function SalePage({ params }: PageProps<"/admin/ventes/[id]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <SaleContent params={params} />
    </Suspense>
  )
}

async function SaleContent({ params }: { params: PageProps<"/admin/ventes/[id]">["params"] }) {
  const admin = await requireAdmin()
  const { id } = await params
  const [sale, settings] = await Promise.all([getSaleDetail(id), getSettings()])
  if (!sale) notFound()
  const { summary, lot, buyer } = sale
  const currency = settings.currencyLabel
  const canEdit = hasRole(admin, "ADMIN")
  const today = format(new Date(), "yyyy-MM-dd")
  const buyerName = fullName(buyer)
  const installments = sale.installments.filter((i) => i.index > 0)

  return (
    <>
      <PageHeader
        back={{ href: "/admin/ventes", label: "Ventes" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            Vente {sale.reference}
            <ToneBadge tone={SALE_STATUS[sale.status].tone}>{SALE_STATUS[sale.status].label}</ToneBadge>
          </span>
        }
        description={
          <>
            <Link href={`/admin/terrains/${lot.id}`} className="font-medium text-foreground hover:underline">
              Terrain n°{lot.number}
            </Link>
            {lot.block ? ` · Îlot ${lot.block}` : ""} · {formatArea(lot.areaM2)} — attribué à{" "}
            <Link href={`/admin/acheteurs/${buyer.id}`} className="font-medium text-foreground hover:underline">
              {buyerName}
            </Link>{" "}
            le {formatDateLong(sale.signedAt)}
          </>
        }
        actions={
          <SaleActions
            canEdit={canEdit}
            currency={currency}
            today={today}
            smsDefault={settings.smsOnPayment}
            sale={{
              id: sale.id,
              reference: sale.reference,
              lotNumber: lot.number,
              buyerName,
              phone: buyer.phone,
              status: sale.status,
              remaining: summary.remaining,
              nextDue: summary.nextDue?.remaining ?? null,
              paid: summary.totalPaid,
              overdue: summary.overdueAmount,
              plan: {
                price: sale.price,
                withDeposit: sale.depositAmount > 0,
                depositAmount: sale.depositAmount || null,
                depositDueDate: format(sale.depositDueDate ?? sale.signedAt, "yyyy-MM-dd"),
                installmentsCount: sale.installmentsCount,
                frequency: sale.frequency,
                customIntervalDays: sale.customIntervalDays,
                firstDueDate: format(sale.firstDueDate ?? sale.signedAt, "yyyy-MM-dd"),
                fixedAmount: false,
                installmentAmount: null,
              },
            }}
          />
        }
      />

      {sale.status === "CANCELLED" && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-border bg-muted/60 p-4 text-sm">
          <Ban className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p>
            <strong>Vente annulée</strong> le {formatDate(sale.cancelledAt)}. {sale.cancelReason && <>Motif : {sale.cancelReason}.</>} Le terrain a été
            remis en vente ; {formatMoney(summary.totalPaid, currency)} avaient été versés.
          </p>
        </div>
      )}
      {summary.overdueAmount > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-status-sold/30 bg-status-sold/8 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-sold-strong" />
          <p>
            <strong className="text-status-sold-strong">{formatMoney(summary.overdueAmount, currency)} en retard</strong> —{" "}
            {summary.overdueCount} échéance{summary.overdueCount > 1 ? "s" : ""} impayée{summary.overdueCount > 1 ? "s" : ""}, la plus ancienne depuis{" "}
            {summary.daysLate} jour{summary.daysLate > 1 ? "s" : ""}.
          </p>
        </div>
      )}
      {sale.status === "COMPLETED" && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-status-available/30 bg-status-available/8 p-4 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-status-available-strong" />
          <p>
            <strong className="text-status-available-strong">Terrain entièrement payé.</strong>{" "}
            {summary.lastPaymentAt && `Dernier versement le ${formatDate(summary.lastPaymentAt)}.`}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <StatCard label="Prix de vente" value={<Amount value={sale.price} currency={currency} />} icon={Coins} hint={`${formatMoney(sale.price / lot.areaM2, currency)} / m²`} />
        <StatCard label="Déjà payé" value={<Amount value={summary.totalPaid} currency={currency} />} icon={Wallet} tone="success" hint={`${formatPercent(summary.progress)} du prix`}>
          <PaymentProgress progress={summary.progress} overdueRatio={summary.overdueAmount / sale.price} className="mt-3" />
        </StatCard>
        <StatCard
          label="Reste à payer"
          value={<Amount value={summary.remaining} currency={currency} />}
          icon={Hourglass}
          tone={summary.overdueAmount > 0 ? "danger" : "default"}
          hint={`${summary.paidCount} / ${summary.totalCount} échéances réglées`}
        />
        <StatCard
          label={summary.nextDue ? "Prochaine échéance" : "Échéancier"}
          value={summary.nextDue ? <Amount value={summary.nextDue.remaining} currency={currency} /> : sale.status === "COMPLETED" ? "Soldé" : "—"}
          icon={CalendarClock}
          tone={summary.nextDue?.state === "LATE" ? "danger" : "gold"}
          hint={summary.nextDue ? `${summary.nextDue.label} · ${formatDate(summary.nextDue.dueDate)}` : undefined}
        />
      </div>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Card
            title="Échéancier"
            description={`${sale.depositAmount > 0 ? `Acompte de ${formatMoney(sale.depositAmount, currency)}, puis ` : ""}${installments.length} échéance${installments.length > 1 ? "s" : ""} ${frequencyPer(sale.frequency, sale.customIntervalDays)} sur ${durationLabel(installments.length, sale.frequency, sale.customIntervalDays)}`}
          >
            <ScheduleTable rows={summary.rows} currency={currency} className="rounded-none border-0 border-t" />
          </Card>
          <Card title="Versements" description={`${sale.payments.length} versement${sale.payments.length > 1 ? "s" : ""} · ${formatMoney(summary.totalPaid, currency)}`}>
            <div className="border-t">
              <SalePayments
                canEdit={canEdit}
                currency={currency}
                today={today}
                payments={sale.payments.map((p) => ({
                  id: p.id,
                  amount: p.amount,
                  paidAt: format(p.paidAt, "yyyy-MM-dd"),
                  method: p.method,
                  reference: p.reference,
                  note: p.note,
                  receiptNumber: p.receiptNumber,
                  recordedBy: p.recordedBy?.name ?? null,
                }))}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Acheteur" action={<Link href={`/admin/acheteurs/${buyer.id}`} className="text-xs font-medium text-primary hover:underline">Fiche <ArrowUpRight className="inline size-3" /></Link>}>
            <div className="space-y-2 px-5 pb-5 text-sm">
              <p className="text-base font-semibold">{buyerName}</p>
              <a href={`tel:${buyer.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                <Phone className="size-4" />
                <span className="tabular">{formatPhone(buyer.phone)}</span>
              </a>
              {buyer.email && (
                <a href={`mailto:${buyer.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                  <Mail className="size-4" />
                  {buyer.email}
                </a>
              )}
              {(buyer.address || buyer.city) && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="size-4" />
                  {[buyer.address, buyer.city, buyer.country].filter(Boolean).join(", ")}
                </p>
              )}
              {buyer.idNumber && (
                <p className="text-xs text-muted-foreground">
                  {buyer.idType ?? "Pièce"} n° {buyer.idNumber}
                </p>
              )}
            </div>
          </Card>
          <Card title="Détails de la vente">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 pb-5 text-sm">
              <Detail label="Référence" value={sale.reference} />
              <Detail label="Signée le" value={formatDate(sale.signedAt)} />
              <Detail label="Terrain" value={`N°${lot.number}${lot.block ? ` · îlot ${lot.block}` : ""}`} />
              <Detail label="Surface" value={formatArea(lot.areaM2)} />
              <Detail label="Acompte" value={sale.depositAmount > 0 ? formatMoney(sale.depositAmount, currency) : "Sans acompte"} />
              <Detail label="Périodicité" value={frequencyPer(sale.frequency, sale.customIntervalDays)} />
              <Detail label="Échéances" value={String(installments.length)} />
              <Detail label="Fin prévue" value={formatDate(summary.rows[summary.rows.length - 1]?.dueDate)} />
            </dl>
          </Card>
          <Card title="Documents" description="Visibles par l'acheteur dans son espace client">
            <div className="px-5 pb-5">
              <SaleDocuments
                saleId={sale.id}
                canEdit={canEdit}
                documents={sale.documents.map((d) => ({ id: d.id, title: d.title, category: d.category, filename: d.filename, size: d.size, createdAt: d.createdAt.toISOString() }))}
              />
            </div>
          </Card>
          <Card title="Notes internes">
            <div className="px-5 pb-5">
              <SaleNotes saleId={sale.id} notes={sale.notes} canEdit={canEdit} />
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium tabular">{value}</dd>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-96 max-w-full" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  )
}
