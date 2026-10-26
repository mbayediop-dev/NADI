import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { requireAdmin } from "@/lib/auth/admin"
import { getSettings } from "@/lib/settings"
import { getSaleDetail } from "@/lib/queries/sales"
import { durationLabel, frequencyPer } from "@/lib/finance"
import { formatArea, formatDate, formatDateLong, formatMoney, formatPercent, fullName } from "@/lib/format"
import { INSTALLMENT_STATUS, PAYMENT_METHOD, SALE_STATUS } from "@/lib/labels"
import { formatPhone } from "@/lib/phone"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/brand/logo"
import { Skeleton } from "@/components/ui/skeleton"
import { PrintToolbar } from "@/components/admin/payments/print-toolbar"

export const metadata: Metadata = { title: "Relevé de compte", robots: { index: false } }

export default function StatementPage({ params }: PageProps<"/admin/ventes/[id]/releve">) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-[900px] max-w-[760px] rounded-2xl" />}>
      <Statement params={params} />
    </Suspense>
  )
}

async function Statement({ params }: { params: PageProps<"/admin/ventes/[id]/releve">["params"] }) {
  await requireAdmin()
  const { id } = await params
  const [sale, settings] = await Promise.all([getSaleDetail(id), getSettings()])
  if (!sale) notFound()
  const { summary, lot, buyer } = sale
  const currency = settings.currencyLabel
  const installments = sale.installments.filter((i) => i.index > 0)
  const payments = [...sale.payments].sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime())
  const muted = "text-[oklch(0.48_0.02_175)]"

  return (
    <>
      <PrintToolbar back={{ href: `/admin/ventes/${sale.id}`, label: "Retour à la vente" }} />
      <article className="mx-auto w-full max-w-[760px] overflow-hidden rounded-2xl border bg-white text-[13px] text-[oklch(0.22_0.02_175)] shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none">
        <header className="flex flex-col gap-6 border-b bg-[oklch(0.975_0.01_85)] p-8 sm:flex-row sm:items-start sm:justify-between print:flex-row">
          <div>
            <Logo />
            <div className={cn("mt-4 space-y-0.5 text-xs", muted)}>
              {settings.companyAddress && <p>{settings.companyAddress}</p>}
              {settings.companyPhone && <p>Tél. {formatPhone(settings.companyPhone)}</p>}
              {settings.companyEmail && <p>{settings.companyEmail}</p>}
            </div>
          </div>
          <div className="sm:text-right print:text-right">
            <p className="text-[0.7rem] font-bold tracking-[0.25em] text-[oklch(0.52_0.1_70)]">RELEVÉ DE COMPTE</p>
            <p className="mt-1 text-2xl font-extrabold tabular">{sale.reference}</p>
            <p className={cn("mt-1 text-sm", muted)}>Édité le {formatDateLong(new Date())}</p>
            <p className={cn("text-sm", muted)}>Statut : {SALE_STATUS[sale.status].label}</p>
          </div>
        </header>

        <section className="grid gap-6 border-b p-8 sm:grid-cols-2 print:grid-cols-2">
          <div>
            <p className={cn("text-xs font-semibold tracking-wide uppercase", muted)}>Acquéreur</p>
            <p className="mt-1 text-base font-bold">{fullName(buyer)}</p>
            <p className={cn("tabular", muted)}>{formatPhone(buyer.phone)}</p>
            {buyer.email && <p className={muted}>{buyer.email}</p>}
            {(buyer.address || buyer.city) && <p className={muted}>{[buyer.address, buyer.city, buyer.country].filter(Boolean).join(", ")}</p>}
          </div>
          <div>
            <p className={cn("text-xs font-semibold tracking-wide uppercase", muted)}>Terrain</p>
            <p className="mt-1 text-base font-bold">
              N°{lot.number}
              {lot.block ? ` — îlot ${lot.block}` : ""}
            </p>
            <p className={muted}>
              {formatArea(lot.areaM2)} · {settings.siteName}
            </p>
            <p className={muted}>
              Signée le {formatDate(sale.signedAt)} · {sale.depositAmount > 0 ? `acompte ${formatMoney(sale.depositAmount, currency)}` : "sans acompte"} ·{" "}
              {installments.length} échéance(s) {frequencyPer(sale.frequency, sale.customIntervalDays)} ({durationLabel(installments.length, sale.frequency, sale.customIntervalDays)})
            </p>
          </div>
        </section>

        <section className="grid grid-cols-4 divide-x border-b text-center">
          {[
            { label: "Prix", value: formatMoney(sale.price, currency) },
            { label: `Versé (${formatPercent(summary.progress)})`, value: formatMoney(summary.totalPaid, currency) },
            { label: "Reste à payer", value: formatMoney(summary.remaining, currency) },
            { label: "Dont en retard", value: formatMoney(summary.overdueAmount, currency) },
          ].map((item) => (
            <div key={item.label} className="p-4">
              <p className={cn("text-xs", muted)}>{item.label}</p>
              <p className="mt-1 font-bold tabular">{item.value}</p>
            </div>
          ))}
        </section>

        <section className="p-8 pb-4">
          <h2 className="mb-3 text-sm font-bold">Échéancier</h2>
          <table className="w-full">
            <thead>
              <tr className={cn("border-b text-left text-xs", muted)}>
                <th className="py-2 font-medium">Échéance</th>
                <th className="py-2 font-medium">Date</th>
                <th className="py-2 text-right font-medium">Montant</th>
                <th className="py-2 text-right font-medium">Payé</th>
                <th className="py-2 text-right font-medium">Reste</th>
                <th className="py-2 text-right font-medium">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {summary.rows.map((row) => (
                <tr key={row.index} className="break-inside-avoid">
                  <td className="py-1.5 font-medium">{row.label}</td>
                  <td className="py-1.5 tabular">{formatDate(row.dueDate)}</td>
                  <td className="py-1.5 text-right tabular">{formatMoney(row.amount, currency)}</td>
                  <td className="py-1.5 text-right tabular">{row.paid > 0 ? formatMoney(row.paid, currency) : "—"}</td>
                  <td className="py-1.5 text-right tabular">{row.remaining > 0 ? formatMoney(row.remaining, currency) : "—"}</td>
                  <td className={cn("py-1.5 text-right font-medium", row.state === "LATE" && "text-[oklch(0.5_0.17_27)]")}>{INSTALLMENT_STATUS[row.state].label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="p-8 pt-4">
          <h2 className="mb-3 text-sm font-bold">Versements reçus</h2>
          {payments.length === 0 ? (
            <p className={muted}>Aucun versement.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className={cn("border-b text-left text-xs", muted)}>
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 font-medium">Reçu</th>
                  <th className="py-2 font-medium">Mode</th>
                  <th className="py-2 font-medium">Référence</th>
                  <th className="py-2 text-right font-medium">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.map((p) => (
                  <tr key={p.id} className="break-inside-avoid">
                    <td className="py-1.5 tabular">{formatDate(p.paidAt)}</td>
                    <td className="py-1.5 tabular">{p.receiptNumber}</td>
                    <td className="py-1.5">{PAYMENT_METHOD[p.method]}</td>
                    <td className="py-1.5 tabular">{p.reference ?? "—"}</td>
                    <td className="py-1.5 text-right font-medium tabular">{formatMoney(p.amount, currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2">
                  <td colSpan={4} className="py-2 font-bold">
                    Total versé
                  </td>
                  <td className="py-2 text-right font-bold tabular">{formatMoney(summary.totalPaid, currency)}</td>
                </tr>
              </tfoot>
            </table>
          )}
          <p className={cn("mt-8 text-xs", muted)}>
            Relevé établi par {settings.companyName}. Pour toute question, contactez-nous{settings.companyPhone ? ` au ${formatPhone(settings.companyPhone)}` : ""}.
          </p>
        </section>
      </article>
    </>
  )
}
