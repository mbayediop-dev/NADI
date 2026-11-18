import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { requireAdmin } from "@/lib/auth/admin"
import { getSettings } from "@/lib/settings"
import { getConstructionReceiptData } from "@/lib/queries/construction"
import { Receipt } from "@/components/shared/receipt"
import { Skeleton } from "@/components/ui/skeleton"
import { PrintToolbar } from "@/components/admin/payments/print-toolbar"

export const metadata: Metadata = { title: "Reçu de versement", robots: { index: false } }

export default function ConstructionReceiptPage({ params }: PageProps<"/admin/construction/versements/[id]/recu">) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-[720px] max-w-[760px] rounded-2xl" />}>
      <ReceiptContent params={params} />
    </Suspense>
  )
}

async function ReceiptContent({ params }: { params: PageProps<"/admin/construction/versements/[id]/recu">["params"] }) {
  await requireAdmin()
  const [{ id }, settings] = await Promise.all([params, getSettings()])
  const data = await getConstructionReceiptData(id, settings)
  if (!data) notFound()
  return (
    <>
      <PrintToolbar back={{ href: `/admin/construction/${data.projectId}?onglet=finances`, label: "Retour au projet" }} />
      <Receipt data={data} />
    </>
  )
}
