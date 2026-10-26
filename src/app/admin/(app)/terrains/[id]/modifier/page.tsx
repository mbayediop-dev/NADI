import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/auth/admin"
import { fullName } from "@/lib/format"
import { getSettings, planDefaults } from "@/lib/settings"
import { getLotFields, getLotSuggestions } from "@/lib/queries/lots"
import { PageHeader } from "@/components/admin/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { LotForm } from "@/components/admin/lots/lot-form"

export const metadata: Metadata = { title: "Modifier le terrain" }

export default function EditLotPage({ params }: PageProps<"/admin/terrains/[id]/modifier">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-14 w-72" />
          <Skeleton className="h-[600px] rounded-2xl" />
        </div>
      }
    >
      <EditLotContent params={params} />
    </Suspense>
  )
}

async function EditLotContent({ params }: { params: PageProps<"/admin/terrains/[id]/modifier">["params"] }) {
  await requireAdmin("ADMIN")
  const { id } = await params
  const [lot, settings, fields, suggestions] = await Promise.all([
    db.lot.findUnique({
      where: { id },
      include: { sales: { where: { status: { not: "CANCELLED" } }, include: { buyer: true }, take: 1 } },
    }),
    getSettings(),
    getLotFields(),
    getLotSuggestions(),
  ])
  if (!lot) notFound()
  const sale = lot.sales[0]
  return (
    <>
      <PageHeader title={`Modifier le terrain n° ${lot.number}`} back={{ href: `/admin/terrains/${lot.id}`, label: `Terrain n° ${lot.number}` }} />
      <LotForm
        initial={{
          id: lot.id,
          number: lot.number,
          block: lot.block,
          areaM2: lot.areaM2,
          frontageM: lot.frontageM,
          depthM: lot.depthM,
          price: lot.price,
          depositAmount: lot.depositAmount,
          installmentsCount: lot.installmentsCount,
          frequency: lot.frequency,
          customIntervalDays: lot.customIntervalDays,
          installmentAmount: lot.installmentAmount,
          status: lot.status,
          reservedNote: lot.reservedNote,
          soilType: lot.soilType,
          position: lot.position,
          orientation: lot.orientation,
          description: lot.description,
          features: lot.features,
          isFeatured: lot.isFeatured,
          attributes: (lot.attributes ?? {}) as Record<string, string | number | boolean | null>,
        }}
        fields={fields}
        suggestions={suggestions}
        defaults={planDefaults(settings)}
        currency={settings.currencyLabel}
        sale={sale ? { id: sale.id, reference: sale.reference, buyerName: fullName(sale.buyer) } : null}
      />
    </>
  )
}
