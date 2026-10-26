import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { requireBuyer } from "@/lib/auth/client"
import { getSettings } from "@/lib/settings"
import { getReceiptData } from "@/lib/queries/receipt"
import { Skeleton } from "@/components/ui/skeleton"
import { Receipt } from "@/components/shared/receipt"
import { PrintButton } from "@/components/shared/print-button"

export const metadata: Metadata = { title: "Reçu de versement" }

export default function ReceiptPage({ params }: PageProps<"/espace-client/recus/[id]">) {
  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/espace-client/paiements" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Mes paiements
        </Link>
        <PrintButton label="Télécharger / imprimer" />
      </div>
      <Suspense fallback={<Skeleton className="mx-auto h-[720px] w-full max-w-[760px] rounded-2xl" />}>
        <ReceiptContent params={params} />
      </Suspense>
    </div>
  )
}

async function ReceiptContent({ params }: { params: PageProps<"/espace-client/recus/[id]">["params"] }) {
  const buyer = await requireBuyer()
  const [{ id }, settings] = await Promise.all([params, getSettings()])
  const data = await getReceiptData(id, settings, { buyerId: buyer.id })
  if (!data) notFound()
  return <Receipt data={data} />
}
