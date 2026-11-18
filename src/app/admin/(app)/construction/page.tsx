import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { Coins, HardHat, Inbox, Plus, ReceiptText } from "lucide-react"
import { hasRole, requireAdmin } from "@/lib/auth/admin"
import { landLabel } from "@/lib/construction"
import { fullName, formatMoney } from "@/lib/format"
import { getProjects } from "@/lib/queries/construction"
import { getSettings } from "@/lib/settings"
import { PageHeader } from "@/components/admin/page-header"
import { StatCard } from "@/components/admin/stat-card"
import { Amount } from "@/components/admin/sales/amount"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ProjectsTable, type ProjectRow, type ProjectsFilter } from "@/components/admin/construction/projects-table"

export const metadata: Metadata = { title: "Construction" }

export default function ConstructionPage({ searchParams }: PageProps<"/admin/construction">) {
  return (
    <>
      <PageHeader
        title="Construction"
        description="Maisons construites pour nos clients : demandes, offres, chantiers, versements et dépenses."
        actions={
          <Suspense fallback={null}>
            <NewProjectButton />
          </Suspense>
        }
      />
      <Suspense fallback={<PageSkeleton />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function NewProjectButton() {
  const admin = await requireAdmin()
  if (!hasRole(admin, "ADMIN")) return null
  return (
    <Button asChild>
      <Link href="/admin/construction/nouveau">
        <Plus />
        Nouveau projet
      </Link>
    </Button>
  )
}

const FILTERS: ProjectsFilter[] = ["all", "requests", "study", "works", "delivered", "cancelled"]

async function Content({ searchParams }: { searchParams: PageProps<"/admin/construction">["searchParams"] }) {
  await requireAdmin()
  const [{ filtre }, projects, settings] = await Promise.all([searchParams, getProjects(), getSettings()])
  const currency = settings.currencyLabel
  const initial = FILTERS.find((f) => f === filtre) ?? "all"

  const live = projects.filter((p) => p.status !== "CANCELLED")
  const requests = live.filter((p) => p.status === "REQUESTED").length
  const works = live.filter((p) => p.status === "IN_PROGRESS" || p.status === "SIGNED" || p.status === "SUSPENDED")
  const contracted = live.reduce((sum, p) => sum + (p.contractAmount ? p.summary.contract : 0), 0)
  const paid = live.reduce((sum, p) => sum + p.summary.finance.totalPaid, 0)
  const spent = live.reduce((sum, p) => sum + p.summary.spent, 0)
  const overdue = live.reduce((sum, p) => sum + p.summary.finance.overdueAmount, 0)

  const rows: ProjectRow[] = projects.map((p) => ({
    id: p.id,
    reference: p.reference,
    title: p.title,
    status: p.status,
    clientName: p.buyer ? fullName(p.buyer) : p.contactName,
    phone: p.buyer?.phone ?? p.contactPhone,
    hasAccount: !!p.buyer,
    landOrigin: p.landOrigin,
    land: landLabel(p),
    contract: p.contractAmount ? p.summary.contract : 0,
    paid: p.summary.finance.totalPaid,
    spent: p.summary.spent,
    overdue: p.summary.finance.overdueAmount,
    progress: p.summary.progress,
    createdAt: p.createdAt.toISOString(),
  }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <StatCard
          label="Demandes à étudier"
          value={requests}
          icon={Inbox}
          tone={requests > 0 ? "gold" : "default"}
          hint={requests > 0 ? "Reçues depuis le site ou l'espace client" : "Aucune demande en attente"}
        />
        <StatCard
          label="Chantiers engagés"
          value={works.length}
          icon={HardHat}
          tone="primary"
          hint={`${works.filter((p) => p.status === "IN_PROGRESS").length} en cours · ${live.filter((p) => p.status === "DELIVERED").length} livré(s)`}
        />
        <StatCard
          label="Contrats signés"
          value={<Amount value={contracted} currency={currency} />}
          icon={Coins}
          tone="success"
          hint={`${formatMoney(paid, currency)} encaissés${overdue > 0 ? ` · ${formatMoney(overdue, currency)} en retard` : ""}`}
        />
        <StatCard
          label="Dépenses de chantier"
          value={<Amount value={spent} currency={currency} />}
          icon={ReceiptText}
          hint={`Solde de trésorerie : ${formatMoney(paid - spent, currency)}`}
        />
      </div>
      <ProjectsTable rows={rows} currency={currency} initialFilter={initial} />
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-[420px] w-full rounded-xl" />
    </div>
  )
}
