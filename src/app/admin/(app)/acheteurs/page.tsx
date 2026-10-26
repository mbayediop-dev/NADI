import { Suspense } from "react"
import type { Metadata } from "next"
import { Download } from "lucide-react"
import { db } from "@/lib/db"
import { hasRole, requireAdmin } from "@/lib/auth/admin"
import { getSettings } from "@/lib/settings"
import { summarizeSale } from "@/lib/finance"
import { compareLotNumbers, fullName } from "@/lib/format"
import { PageHeader } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { BuyersTable, type BuyerRow } from "@/components/admin/buyers/buyers-table"

export const metadata: Metadata = { title: "Acheteurs" }

export default function BuyersPage() {
  return (
    <>
      <PageHeader
        title="Acheteurs"
        description="Propriétaires et futurs propriétaires : coordonnées, terrains, situation des paiements et accès à l'espace client."
        actions={
          <Button variant="outline" asChild>
            <a href="/api/admin/export/acheteurs">
              <Download />
              Exporter
            </a>
          </Button>
        }
      />
      <Suspense
        fallback={
          <div className="space-y-3">
            <Skeleton className="h-9 w-full max-w-md" />
            <Skeleton className="h-[480px] w-full rounded-xl" />
          </div>
        }
      >
        <BuyersContent />
      </Suspense>
    </>
  )
}

async function BuyersContent() {
  const admin = await requireAdmin()
  const [settings, buyers] = await Promise.all([
    getSettings(),
    db.buyer.findMany({
      include: {
        sales: {
          where: { status: { not: "CANCELLED" } },
          include: { lot: { select: { number: true } }, installments: true, payments: { select: { amount: true, paidAt: true } } },
        },
      },
    }),
  ])
  const rows: BuyerRow[] = buyers.map((b) => {
    const summaries = b.sales.map((s) => summarizeSale(s))
    return {
      id: b.id,
      name: fullName(b),
      phone: b.phone,
      email: b.email,
      city: [b.city, b.country && b.country !== "Sénégal" ? b.country : null].filter(Boolean).join(", ") || null,
      lots: b.sales.map((s) => s.lot.number).sort(compareLotNumbers),
      contracted: b.sales.reduce((s, x) => s + x.price, 0),
      paid: summaries.reduce((s, x) => s + x.totalPaid, 0),
      remaining: summaries.reduce((s, x) => s + x.remaining, 0),
      overdue: summaries.reduce((s, x) => s + x.overdueAmount, 0),
      daysLate: Math.max(0, ...summaries.map((x) => x.daysLate)),
      portalEnabled: b.portalEnabled,
      lastLoginAt: b.lastLoginAt?.toISOString() ?? null,
      createdAt: b.createdAt.toISOString(),
    }
  })
  return <BuyersTable rows={rows} currency={settings.currencyLabel} canEdit={hasRole(admin, "ADMIN")} />
}
