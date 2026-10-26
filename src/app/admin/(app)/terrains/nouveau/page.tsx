import { Suspense } from "react"
import type { Metadata } from "next"
import { requireAdmin } from "@/lib/auth/admin"
import { getSettings, planDefaults } from "@/lib/settings"
import { getLotFields, getLotSuggestions } from "@/lib/queries/lots"
import { PageHeader } from "@/components/admin/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { LotForm } from "@/components/admin/lots/lot-form"

export const metadata: Metadata = { title: "Nouveau terrain" }

export default function NewLotPage() {
  return (
    <>
      <PageHeader title="Nouveau terrain" description="Ajoutez un lot à l'inventaire. Vous pourrez ensuite le dessiner sur le plan." back={{ href: "/admin/terrains", label: "Terrains" }} />
      <Suspense fallback={<FormSkeleton />}>
        <NewLotContent />
      </Suspense>
    </>
  )
}

async function NewLotContent() {
  await requireAdmin("ADMIN")
  const [settings, fields, suggestions] = await Promise.all([getSettings(), getLotFields(), getLotSuggestions()])
  return (
    <LotForm
      initial={{
        number: "",
        block: null,
        areaM2: null,
        frontageM: null,
        depthM: null,
        price: null,
        depositAmount: null,
        installmentsCount: null,
        frequency: null,
        customIntervalDays: null,
        installmentAmount: null,
        status: "AVAILABLE",
        reservedNote: null,
        soilType: null,
        position: null,
        orientation: null,
        description: null,
        features: [],
        isFeatured: false,
        attributes: {},
      }}
      fields={fields}
      suggestions={suggestions}
      defaults={planDefaults(settings)}
      currency={settings.currencyLabel}
    />
  )
}

function FormSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  )
}
