import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/auth/admin"
import { getSettings } from "@/lib/settings"
import { getReceiptData } from "@/lib/queries/receipt"
import { Receipt } from "@/components/shared/receipt"
import { Skeleton } from "@/components/ui/skeleton"
import { PrintToolbar } from "@/components/admin/payments/print-toolbar"

export const metadata: Metadata = { title: "Reçu de versement", robots: { index: false } }

export default function ReceiptPage({ params }: PageProps<"/admin/versements/[id]/recu">) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-[720px] max-w-[760px] rounded-2xl" />}>
      <ReceiptContent params={params} />
    </Suspense>
  )
}

async function ReceiptContent({ params }: { params: PageProps<"/admin/versements/[id]/recu">["params"] }) {
  await requireAdmin()
  const { id } = await params
  const [settings, payment] = await Promise.all([getSettings(), db.payment.findUnique({ where: { id }, select: { saleId: true } })])
  const data = payment ? await getReceiptData(id, settings) : null
  if (!data || !payment) notFound()
  return (
    <>
      <PrintToolbar back={{ href: `/admin/ventes/${payment.saleId}`, label: "Retour à la vente" }} />
      <Receipt data={data} />
    </>
  )
}
