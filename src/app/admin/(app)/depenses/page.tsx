import { Suspense } from "react"
import type { Metadata } from "next"
import { format } from "date-fns"
import { Building2, CalendarDays, MapPinned, ReceiptText } from "lucide-react"
import { hasRole, requireAdmin } from "@/lib/auth/admin"
import { db } from "@/lib/db"
import { formatMonth } from "@/lib/format"
import { getExpenses } from "@/lib/queries/construction"
import { getSettings } from "@/lib/settings"
import { PageHeader } from "@/components/admin/page-header"
import { StatCard } from "@/components/admin/stat-card"
import { Amount } from "@/components/admin/sales/amount"
import { Skeleton } from "@/components/ui/skeleton"
import { NewExpenseButton, type ExpenseContext } from "@/components/admin/construction/expenses"
import { ExpensesBoard, type ExpensesFilter } from "@/components/admin/construction/expenses-board"

export const metadata: Metadata = { title: "Dépenses" }

export default function ExpensesPage({ searchParams }: PageProps<"/admin/depenses">) {
  return (
    <>
      <PageHeader
        title="Dépenses"
        description="Tout ce qui est dépensé : pour le lotissement lui-même (viabilisation, voirie, frais) et pour le chantier de chaque client."
        actions={
          <Suspense fallback={null}>
            <NewButton />
          </Suspense>
        }
      />
      <Suspense fallback={<PageSkeleton />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  )
}

/** Chantiers proposés à la saisie d'une dépense, avec leurs étapes. */
async function expenseContext(): Promise<ExpenseContext> {
  const [settings, projects] = await Promise.all([
    getSettings(),
    db.constructionProject.findMany({
      where: { status: { not: "CANCELLED" } },
      select: { id: true, reference: true, title: true, contactName: true, phases: { select: { id: true, title: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
      orderBy: { createdAt: "desc" },
    }),
  ])
  return {
    currency: settings.currencyLabel,
    today: format(new Date(), "yyyy-MM-dd"),
    projects: projects.map((p) => ({ id: p.id, label: `${p.reference} — ${p.title} (${p.contactName})`, phases: p.phases })),
  }
}

async function NewButton() {
  const admin = await requireAdmin()
  if (!hasRole(admin, "ADMIN")) return null
  return <NewExpenseButton context={await expenseContext()} />
}

const FILTERS: ExpensesFilter[] = ["all", "site", "projects"]

async function Content({ searchParams }: { searchParams: PageProps<"/admin/depenses">["searchParams"] }) {
  const admin = await requireAdmin()
  const [{ filtre }, expenses, context] = await Promise.all([searchParams, getExpenses(), expenseContext()])
  const currency = context.currency
  const now = new Date()
  const thisMonth = format(now, "yyyy-MM")
  const sum = (list: typeof expenses) => list.reduce((s, e) => s + e.amount, 0)
  const site = expenses.filter((e) => e.scope === "SITE")
  const projects = expenses.filter((e) => e.scope === "PROJECT")
  const month = expenses.filter((e) => e.spentAt.toISOString().startsWith(thisMonth))
  const projectCount = new Set(projects.map((e) => e.projectId)).size

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <StatCard label="Total dépensé" value={<Amount value={sum(expenses)} currency={currency} />} icon={ReceiptText} tone="primary" hint={`${expenses.length} dépense${expenses.length > 1 ? "s" : ""} enregistrée${expenses.length > 1 ? "s" : ""}`} />
        <StatCard label="Lotissement" value={<Amount value={sum(site)} currency={currency} />} icon={MapPinned} hint="Viabilisation, voirie, frais du site" />
        <StatCard
          label="Chantiers des clients"
          value={<Amount value={sum(projects)} currency={currency} />}
          icon={Building2}
          tone="gold"
          hint={`Sur ${projectCount} chantier${projectCount > 1 ? "s" : ""}`}
        />
        <StatCard label="Ce mois-ci" value={<Amount value={sum(month)} currency={currency} />} icon={CalendarDays} hint={<span className="first-letter:uppercase">{formatMonth(now)}</span>} />
      </div>
      <ExpensesBoard
        canEdit={hasRole(admin, "ADMIN")}
        context={context}
        initialFilter={FILTERS.find((f) => f === filtre) ?? "all"}
        expenses={expenses.map((e) => ({
          id: e.id,
          scope: e.scope,
          projectId: e.projectId,
          projectLabel: e.project ? `${e.project.reference} — ${e.project.title}` : null,
          phaseId: e.phaseId,
          phaseTitle: e.phase?.title ?? null,
          category: e.category,
          label: e.label,
          supplier: e.supplier,
          quantity: e.quantity,
          unit: e.unit,
          unitPrice: e.unitPrice,
          amount: e.amount,
          spentAt: e.spentAt.toISOString(),
          method: e.method,
          reference: e.reference,
          note: e.note,
          visibleToClient: e.visibleToClient,
          attachmentName: e.attachmentName,
        }))}
      />
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
      <Skeleton className="h-[420px] w-full rounded-2xl" />
    </div>
  )
}
