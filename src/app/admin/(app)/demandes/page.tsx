import { Suspense } from "react"
import type { Metadata } from "next"
import { Clock, Inbox, Percent, Timer } from "lucide-react"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { hasRole, requireAdmin } from "@/lib/auth/admin"
import { getSettings } from "@/lib/settings"
import { compareLotNumbers, formatNumber, formatPercent } from "@/lib/format"
import { PageHeader } from "@/components/admin/page-header"
import { StatCard } from "@/components/admin/stat-card"
import { Skeleton } from "@/components/ui/skeleton"
import { RequestsBoard } from "@/components/admin/requests/requests-board"

export const metadata: Metadata = { title: "Demandes" }

export default function RequestsPage({ searchParams }: PageProps<"/admin/demandes">) {
  return (
    <>
      <PageHeader title="Demandes de réservation" description="Les personnes intéressées depuis le site. Rappelez-les, proposez un terrain, puis validez la vente." />
      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-2xl" />
              ))}
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-96 rounded-2xl" />
              ))}
            </div>
          </div>
        }
      >
        <RequestsContent searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function RequestsContent({ searchParams }: { searchParams: PageProps<"/admin/demandes">["searchParams"] }) {
  const admin = await requireAdmin()
  const [sp, settings, requests, available] = await Promise.all([
    searchParams,
    getSettings(),
    db.reservationRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        lot: { select: { id: true, number: true, status: true, areaM2: true, price: true, block: true } },
        proposedLot: { select: { id: true, number: true, status: true, areaM2: true, price: true, block: true } },
        sale: { select: { id: true, reference: true } },
      },
    }),
    db.lot.findMany({ where: { status: "AVAILABLE" }, select: { id: true, number: true, status: true, areaM2: true, price: true, block: true } }),
  ])

  const demand = new Map<string, number>()
  for (const r of requests) if (r.lotId && (r.status === "NEW" || r.status === "CONTACTED")) demand.set(r.lotId, (demand.get(r.lotId) ?? 0) + 1)

  const pending = requests.filter((r) => r.status === "NEW")
  const oldestPendingDays = daysSince(pending.map((r) => r.createdAt))
  const inProgress = requests.filter((r) => r.status === "CONTACTED" || r.status === "ALTERNATIVE_PROPOSED").length
  const closed = requests.filter((r) => r.status === "CONVERTED" || r.status === "DECLINED")
  const conversion = closed.length ? requests.filter((r) => r.status === "CONVERTED").length / closed.length : null
  const handled = requests.filter((r) => r.handledAt)
  const avgHours = handled.length ? handled.reduce((s, r) => s + (r.handledAt!.getTime() - r.createdAt.getTime()), 0) / handled.length / 3600000 : null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="À traiter"
          value={formatNumber(pending.length)}
          icon={Inbox}
          tone={pending.length ? "gold" : "success"}
          hint={pending.length ? `La plus ancienne attend depuis ${oldestPendingDays} j` : "Aucune demande en attente"}
        />
        <StatCard label="En cours" value={formatNumber(inProgress)} icon={Clock} tone="primary" hint="Contactées ou terrain proposé" />
        <StatCard label="Taux de conversion" value={conversion == null ? "—" : formatPercent(conversion)} icon={Percent} tone="success" hint="Sur les demandes clôturées" />
        <StatCard
          label="Délai de prise en charge"
          value={avgHours == null ? "—" : avgHours < 48 ? `${Math.round(avgHours)} h` : `${Math.round(avgHours / 24)} j`}
          icon={Timer}
          hint="Temps moyen avant premier contact"
        />
      </div>
      <RequestsBoard
        requests={requests.map((r) => ({
          id: r.id,
          fullName: r.fullName,
          phone: r.phone,
          email: r.email,
          message: r.message,
          preferredContact: r.preferredContact,
          status: r.status,
          adminNotes: r.adminNotes,
          createdAt: r.createdAt,
          handledAt: r.handledAt,
          lot: r.lot,
          proposedLot: r.proposedLot,
          sale: r.sale,
          buyerId: r.buyerId,
          lotDemand: r.lotId ? (demand.get(r.lotId) ?? 0) : 0,
        }))}
        availableLots={available.sort((a, b) => compareLotNumbers(a.number, b.number))}
        currency={settings.currencyLabel}
        companyName={settings.companyName}
        appUrl={env.appUrl}
        canEdit={hasRole(admin, "ADMIN")}
        initialId={typeof sp.id === "string" ? sp.id : undefined}
      />
    </div>
  )
}

/** Ancienneté (en jours) de la plus ancienne date */
function daysSince(dates: Date[]) {
  if (dates.length === 0) return 0
  return Math.floor((Date.now() - Math.min(...dates.map((d) => d.getTime()))) / 86400000)
}
