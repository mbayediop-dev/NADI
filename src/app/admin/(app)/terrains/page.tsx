import { Suspense } from "react"
import type { Metadata } from "next"
import { hasRole, requireAdmin } from "@/lib/auth/admin"
import { getSettings } from "@/lib/settings"
import { getAdminLots, getLotSuggestions } from "@/lib/queries/lots"
import { formatArea, formatMoneyCompact, formatNumber, formatPercent } from "@/lib/format"
import { PageHeader } from "@/components/admin/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { LotsTable } from "@/components/admin/lots/lots-table"

export const metadata: Metadata = { title: "Terrains" }

export default function LotsPage() {
  return (
    <>
      <PageHeader
        title="Terrains"
        description="Inventaire complet du lotissement : prix, modalités de paiement, statut et attribution de chaque lot."
      />
      <Suspense fallback={<LotsSkeleton />}>
        <LotsContent />
      </Suspense>
    </>
  )
}

async function LotsContent() {
  const admin = await requireAdmin()
  const settings = await getSettings()
  const [rows, suggestions] = await Promise.all([getAdminLots(settings), getLotSuggestions()])
  const forSale = rows.filter((r) => r.status !== "UNAVAILABLE")
  const totalArea = forSale.reduce((s, r) => s + r.areaM2, 0)
  const stock = rows.filter((r) => r.status === "AVAILABLE").reduce((s, r) => s + (r.price ?? 0), 0)
  const priced = forSale.filter((r) => r.pricePerM2)
  const avgM2 = priced.length ? priced.reduce((s, r) => s + (r.pricePerM2 ?? 0), 0) / priced.length : null
  const sold = rows.filter((r) => r.status === "SOLD").length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Terrains commercialisables" value={formatNumber(forSale.length)} hint={`${formatArea(totalArea)} au total`} />
        <Kpi label="Taux de vente" value={formatPercent(forSale.length ? sold / forSale.length : 0)} hint={`${sold} vendu${sold > 1 ? "s" : ""}`} />
        <Kpi label="Stock disponible" value={formatMoneyCompact(stock, settings.currencyLabel)} hint="Valeur des lots disponibles" />
        <Kpi label="Prix moyen au m²" value={avgM2 ? `${formatNumber(avgM2)} ${settings.currencyLabel}` : "—"} hint="Sur les lots commercialisables" />
      </div>
      <LotsTable
        rows={rows}
        currency={settings.currencyLabel}
        blocks={suggestions.blocks}
        soilTypes={suggestions.soilTypes}
        canEdit={hasRole(admin, "ADMIN")}
      />
    </div>
  )
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-xs">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tracking-tight tabular md:text-2xl">{value}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function LotsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-28 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-[480px] rounded-xl" />
    </div>
  )
}
