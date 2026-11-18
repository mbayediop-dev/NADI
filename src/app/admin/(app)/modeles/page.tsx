import { Suspense } from "react"
import type { Metadata } from "next"
import { hasRole, requireAdmin } from "@/lib/auth/admin"
import { getHouseModels } from "@/lib/queries/construction"
import { getSettings } from "@/lib/settings"
import { PageHeader } from "@/components/admin/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { HouseModelsManager } from "@/components/admin/construction/house-models-manager"

export const metadata: Metadata = { title: "Modèles de maisons" }

export default function HouseModelsPage() {
  return (
    <>
      <PageHeader
        title="Modèles de maisons"
        description="Les plans types que vous proposez de construire. Ils sont présentés sur le site et servent de point de départ aux projets des clients."
      />
      <Suspense fallback={<Skeleton className="h-[420px] w-full rounded-2xl" />}>
        <Content />
      </Suspense>
    </>
  )
}

async function Content() {
  const admin = await requireAdmin()
  const [models, settings] = await Promise.all([getHouseModels(), getSettings()])
  return (
    <HouseModelsManager
      canEdit={hasRole(admin, "ADMIN")}
      currency={settings.currencyLabel}
      models={models.map((m) => ({
        id: m.id,
        name: m.name,
        tagline: m.tagline,
        description: m.description,
        levels: m.levels,
        bedrooms: m.bedrooms,
        bathrooms: m.bathrooms,
        livingAreaM2: m.livingAreaM2,
        minLandM2: m.minLandM2,
        basePrice: m.basePrice,
        images: m.images,
        features: m.features,
        published: m.published,
        projects: m._count.projects,
      }))}
    />
  )
}
