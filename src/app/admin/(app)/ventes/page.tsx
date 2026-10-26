import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { Download, Plus } from "lucide-react"
import { hasRole, requireAdmin } from "@/lib/auth/admin"
import { getSettings } from "@/lib/settings"
import { getAllSalesWithSummary } from "@/lib/queries/sales"
import { fullName } from "@/lib/format"
import { PageHeader } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { SalesTable, type SaleRow, type SalesFilter } from "@/components/admin/sales/sales-table"

export const metadata: Metadata = { title: "Ventes" }

export default function SalesPage({ searchParams }: PageProps<"/admin/ventes">) {
  return (
    <>
      <PageHeader
        title="Ventes"
        description="Terrains attribués, suivi des paiements et des retards."
        actions={
          <>
            <Button variant="outline" asChild>
              <a href="/api/admin/export/ventes">
                <Download />
                Exporter
              </a>
            </Button>
            <Suspense fallback={null}>
              <NewSaleButton />
            </Suspense>
          </>
        }
      />
      <Suspense fallback={<TableSkeleton />}>
        <SalesContent searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function NewSaleButton() {
  const admin = await requireAdmin()
  if (!hasRole(admin, "ADMIN")) return null
  return (
    <Button asChild>
      <Link href="/admin/ventes/nouvelle">
        <Plus />
        Nouvelle vente
      </Link>
    </Button>
  )
}

const FILTERS: SalesFilter[] = ["all", "active", "late", "completed", "cancelled"]

async function SalesContent({ searchParams }: { searchParams: PageProps<"/admin/ventes">["searchParams"] }) {
  await requireAdmin()
  const [{ filtre }, sales, settings] = await Promise.all([searchParams, getAllSalesWithSummary(), getSettings()])
  const initial = FILTERS.find((f) => f === filtre) ?? "all"
  const rows: SaleRow[] = sales.map((s) => ({
    id: s.id,
    reference: s.reference,
    status: s.status,
    lotNumber: s.lot.number,
    lotBlock: s.lot.block,
    buyerName: fullName(s.buyer),
    phone: s.buyer.phone,
    price: s.price,
    paid: s.summary.totalPaid,
    remaining: s.summary.remaining,
    progress: s.summary.progress,
    overdue: s.summary.overdueAmount,
    daysLate: s.summary.daysLate,
    nextDueDate: s.summary.nextDue?.dueDate.toISOString() ?? null,
    nextDueAmount: s.summary.nextDue?.remaining ?? null,
    signedAt: s.signedAt.toISOString(),
  }))
  return <SalesTable rows={rows} currency={settings.currencyLabel} initialFilter={initial} />
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-9 w-full max-w-xl" />
      <Skeleton className="h-[480px] w-full rounded-xl" />
    </div>
  )
}
