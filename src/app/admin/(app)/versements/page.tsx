import { Suspense } from "react"
import type { Metadata } from "next"
import { format } from "date-fns"
import { db } from "@/lib/db"
import { hasRole, requireAdmin } from "@/lib/auth/admin"
import { getSettings } from "@/lib/settings"
import { fullName } from "@/lib/format"
import { PageHeader } from "@/components/admin/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { PaymentsJournal, type JournalRow } from "@/components/admin/payments/payments-journal"

export const metadata: Metadata = { title: "Versements" }

export default function PaymentsPage() {
  return (
    <>
      <PageHeader title="Versements" description="Journal de tous les encaissements : filtrez par période ou par mode de paiement, exportez vers Excel." />
      <Suspense
        fallback={
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-[480px] w-full rounded-xl" />
          </div>
        }
      >
        <JournalContent />
      </Suspense>
    </>
  )
}

async function JournalContent() {
  const admin = await requireAdmin()
  const [settings, payments] = await Promise.all([
    getSettings(),
    db.payment.findMany({
      orderBy: [{ paidAt: "desc" }, { receiptNumber: "desc" }],
      include: {
        recordedBy: { select: { name: true } },
        sale: { select: { id: true, status: true, lot: { select: { number: true } }, buyer: { select: { firstName: true, lastName: true, phone: true } } } },
      },
    }),
  ])
  const rows: JournalRow[] = payments.map((p) => ({
    id: p.id,
    saleId: p.sale.id,
    saleCancelled: p.sale.status === "CANCELLED",
    receiptNumber: p.receiptNumber,
    paidAt: format(p.paidAt, "yyyy-MM-dd"),
    amount: p.amount,
    method: p.method,
    reference: p.reference,
    buyerName: fullName(p.sale.buyer),
    phone: p.sale.buyer.phone,
    lotNumber: p.sale.lot.number,
    recordedBy: p.recordedBy?.name ?? null,
  }))
  return (
    <PaymentsJournal
      rows={rows}
      currency={settings.currencyLabel}
      today={format(new Date(), "yyyy-MM-dd")}
      canEdit={hasRole(admin, "ADMIN")}
      smsDefault={settings.smsOnPayment}
    />
  )
}
