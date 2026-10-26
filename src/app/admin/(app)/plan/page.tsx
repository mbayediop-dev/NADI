import { Suspense } from "react"
import type { Metadata } from "next"
import { hasRole, requireAdmin } from "@/lib/auth/admin"
import { getSettings } from "@/lib/settings"
import { getAdminLots } from "@/lib/queries/lots"
import { getPlanLots, planImage } from "@/lib/queries/plan"
import { PageHeader } from "@/components/admin/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { AdminPlan } from "@/components/admin/plan-editor/admin-plan"

export const metadata: Metadata = { title: "Plan du site" }

export default function PlanPage({ searchParams }: PageProps<"/admin/plan">) {
  return (
    <>
      <PageHeader title="Plan du site" description="Visualisez l'état de chaque lot en un coup d'œil, et dessinez les terrains sur le plan de masse." className="mb-4" />
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-9 w-full max-w-xl rounded-full" />
            <div className="flex flex-col gap-4 lg:h-[calc(100dvh-14.5rem)] lg:flex-row">
              <Skeleton className="h-[58dvh] flex-1 rounded-2xl lg:h-auto" />
              <Skeleton className="h-80 w-full rounded-2xl lg:h-auto lg:w-[360px]" />
            </div>
          </div>
        }
      >
        <PlanContent searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function PlanContent({ searchParams }: { searchParams: PageProps<"/admin/plan">["searchParams"] }) {
  const admin = await requireAdmin()
  const [sp, settings] = await Promise.all([searchParams, getSettings()])
  const [lots, rows] = await Promise.all([getPlanLots({ settings, audience: "admin" }), getAdminLots(settings)])
  const lotId = typeof sp.lot === "string" ? sp.lot : undefined
  return (
    <AdminPlan
      {...planImage(settings)}
      lots={lots}
      panel={rows.map((r) => ({
        id: r.id,
        number: r.number,
        block: r.block,
        areaM2: r.areaM2,
        price: r.price,
        status: r.status,
        plan: r.plan,
        hasGeometry: r.hasGeometry,
        openRequests: r.openRequests,
        sale: r.sale ? { id: r.sale.id, reference: r.sale.reference, buyerId: r.sale.buyerId, buyerName: r.sale.buyerName } : null,
      }))}
      currency={settings.currencyLabel}
      canEdit={hasRole(admin, "ADMIN")}
      initialLotId={lotId && rows.some((r) => r.id === lotId) ? lotId : undefined}
      initialEdit={sp.edit === "1"}
    />
  )
}
