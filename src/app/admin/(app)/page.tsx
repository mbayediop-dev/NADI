import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  Gem,
  Inbox,
  LandPlot,
  MessageCircle,
  Phone,
  Plus,
  Ruler,
  SquareStack,
  Users,
  Wallet,
} from "lucide-react"
import { hasRole, requireAdmin } from "@/lib/auth/admin"
import { getDashboardData, type DashboardData } from "@/lib/queries/stats"
import { formatArea, formatCompact, formatDate, formatDateLong, formatMoney, formatMoneyCompact, formatNumber, formatPercent, formatRelative, fullName } from "@/lib/format"
import { LOT_STATUS, PAYMENT_METHOD, REQUEST_STATUS } from "@/lib/labels"
import { whatsappLink } from "@/lib/phone"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/admin/page-header"
import { StatCard } from "@/components/admin/stat-card"
import { ToneBadge } from "@/components/shared/badges"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/admin/sales/card"
import { MethodIcon } from "@/components/admin/payments/method-icon"
import { AgingChart, CollectionsChart, CumulativeChart, ForecastChart, LotStatusBreakdown, MethodsBars } from "@/components/admin/dashboard/charts"
import { RemindButton } from "@/components/admin/dashboard/remind-button"

export const metadata: Metadata = { title: "Tableau de bord" }

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  )
}

async function Dashboard() {
  const admin = await requireAdmin()
  const data = await getDashboardData()
  const canEdit = hasRole(admin, "ADMIN")
  const { finance, lots, requests, series, lists, currency } = data
  const firstName = admin.name.split(" ")[0]

  return (
    <>
      <PageHeader
        title={`Bonjour ${firstName}`}
        description={`Situation du site au ${formatDateLong(data.now)}.`}
        actions={
          canEdit && (
            <>
              <Button variant="outline" asChild>
                <Link href="/admin/versements">
                  <Wallet />
                  Versements
                </Link>
              </Button>
              <Button asChild>
                <Link href="/admin/ventes/nouvelle">
                  <Plus />
                  Nouvelle vente
                </Link>
              </Button>
            </>
          )
        }
      />

      {/* ── Synthèse financière ─────────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-3">
        <HeroCard data={data} />
        <MonthCard data={data} />
      </div>

      {/* ── Indicateurs ─────────────────────────────────────── */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <Link href="/admin/ventes?filtre=late" className="rounded-2xl transition-shadow hover:shadow-md">
          <StatCard
            label="Arriérés de paiement"
            value={<ResponsiveMoney value={finance.overdue} currency={currency} />}
            icon={AlertTriangle}
            tone={finance.overdue > 0 ? "danger" : "success"}
            hint={finance.lateSalesCount > 0 ? `${finance.lateSalesCount} vente${finance.lateSalesCount > 1 ? "s" : ""} en retard sur ${finance.activeSalesCount}` : "Aucun retard"}
            className="h-full"
          />
        </Link>
        <StatCard
          label="Terrains vendus"
          value={
            <>
              {lots.counts.SOLD}
              <span className="text-base font-medium text-muted-foreground"> / {lots.sellable}</span>
            </>
          }
          icon={SquareStack}
          tone="primary"
          hint={`${formatPercent(lots.soldRatio)} du lotissement commercialisable · ${lots.counts.RESERVED} réservé${lots.counts.RESERVED > 1 ? "s" : ""}`}
        />
        <StatCard
          label="Valeur du stock disponible"
          value={<ResponsiveMoney value={lots.stockValue} currency={currency} compact="always" />}
          icon={Gem}
          tone="gold"
          hint={`${lots.counts.AVAILABLE} terrains disponibles${lots.reservedValue ? ` · + ${formatMoneyCompact(lots.reservedValue, currency)} réservés` : ""}`}
        />
        <StatCard
          label="Prix moyen au m²"
          value={lots.avgPriceM2Sold ? <ResponsiveMoney value={lots.avgPriceM2Sold} currency={currency} /> : "—"}
          icon={Ruler}
          hint={lots.avgPriceM2Catalogue ? `Vendu · catalogue disponible : ${formatMoney(lots.avgPriceM2Catalogue, currency)}` : "Prix de vente moyen"}
        />
        <StatCard label="Acheteurs" value={formatNumber(data.buyersCount)} icon={Users} hint={`${finance.completedSalesCount} terrain${finance.completedSalesCount > 1 ? "s" : ""} entièrement payé${finance.completedSalesCount > 1 ? "s" : ""}`} />
        <Link href="/admin/demandes" className="rounded-2xl transition-shadow hover:shadow-md">
          <StatCard
            label="Demandes en attente"
            value={formatNumber(requests.pending)}
            icon={Inbox}
            tone={requests.fresh > 0 ? "warning" : "default"}
            hint={requests.fresh > 0 ? `dont ${requests.fresh} nouvelle${requests.fresh > 1 ? "s" : ""} à traiter` : `${requests.total} demande${requests.total > 1 ? "s" : ""} reçues au total`}
            className="h-full"
          />
        </Link>
        <StatCard
          label="Taux de conversion"
          value={formatPercent(requests.conversion)}
          icon={BadgeDollarSign}
          hint={`${requests.converted} demande${requests.converted > 1 ? "s" : ""} transformée${requests.converted > 1 ? "s" : ""} en vente (sur les demandes clôturées)`}
        />
        <StatCard
          label="Surface vendue"
          value={formatArea(lots.soldArea)}
          icon={LandPlot}
          hint={`${formatArea(lots.area.AVAILABLE)} encore disponibles`}
        />
      </div>

      {/* ── Graphiques ──────────────────────────────────────── */}
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="Encaissements des 12 derniers mois"
          description={`Total : ${formatMoney(series.months.reduce((s, m) => s + m.collected, 0), currency)} encaissés pour ${formatMoney(series.months.reduce((s, m) => s + m.expected, 0), currency)} attendus`}
        >
          <div className="px-3 pb-4 sm:px-5">
            <CollectionsChart data={series.months.map(({ label, collected, expected }) => ({ label, collected, expected }))} currency={currency} />
          </div>
        </Card>
        <Card title="Commercialisation" description={`${lots.total} terrains · ${formatArea(lots.area.AVAILABLE + lots.area.RESERVED + lots.area.SOLD + lots.area.UNAVAILABLE)}`}>
          <div className="px-5 pb-5">
            <p className="mb-4 text-4xl font-bold tracking-tight">
              {formatPercent(lots.soldRatio)}
              <span className="ml-2 text-sm font-medium text-muted-foreground">vendus</span>
            </p>
            <LotStatusBreakdown counts={lots.counts} area={lots.area} total={lots.total} />
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="Prévision des encaissements"
          description={`${formatMoney(finance.forecastTotal, currency)} attendus sur les 12 prochains mois (hors arriérés), d'après les échéanciers`}
        >
          <div className="px-3 pb-4 sm:px-5">
            <ForecastChart data={series.forecast.map(({ label, amount, count }) => ({ label, amount, count }))} currency={currency} />
          </div>
        </Card>
        <Card title="Ancienneté des retards" description={`${formatMoney(finance.overdue, currency)} à recouvrer`}>
          <div className="px-3 pb-4 sm:px-5">
            <AgingChart data={series.aging.map(({ label, amount, count }) => ({ label, amount, count }))} currency={currency} />
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Ventes cumulées" description="Nombre de terrains attribués depuis le lancement">
          <div className="px-3 pb-4 sm:px-5">
            {series.cumulative.length > 0 ? (
              <CumulativeChart data={series.cumulative.map(({ label, lots, contracted }) => ({ label, lots, contracted }))} currency={currency} />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">Aucune vente pour le moment.</p>
            )}
          </div>
        </Card>
        <Card title="Modes de paiement" description="Répartition des montants encaissés">
          <div className="px-5 pb-5">
            <MethodsBars data={series.methods} currency={currency} />
          </div>
        </Card>
      </div>

      {/* ── Listes d'action ─────────────────────────────────── */}
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card
          title="Retards à relancer"
          description={lists.late.length ? `${lists.late.length} acheteur${lists.late.length > 1 ? "s" : ""} · ${formatMoney(finance.overdue, currency)}` : "Tous les paiements sont à jour"}
          action={
            lists.late.length > 0 && (
              <Link href="/admin/ventes?filtre=late" className="text-xs font-medium text-primary hover:underline">
                Tout voir
              </Link>
            )
          }
        >
          <ul className="divide-y border-t">
            {lists.late.slice(0, 6).map((l) => (
              <li key={l.saleId} className="flex items-center gap-3 px-5 py-3">
                <Link href={`/admin/ventes/${l.saleId}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium">{l.buyerName}</p>
                  <p className="text-xs text-muted-foreground">
                    Terrain n°{l.lotNumber} · <span className="font-semibold text-status-sold-strong">{formatMoney(l.overdueAmount, currency)}</span> · {l.daysLate} j
                  </p>
                </Link>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon-sm" asChild aria-label="Appeler">
                    <a href={`tel:${l.phone}`}>
                      <Phone />
                    </a>
                  </Button>
                  <Button variant="ghost" size="icon-sm" asChild aria-label="WhatsApp">
                    <a
                      href={whatsappLink(l.phone, `Bonjour ${l.buyerName.split(" ")[0]}, nous revenons vers vous au sujet du terrain n°${l.lotNumber} : un montant de ${formatMoney(l.overdueAmount, currency)} reste en attente. Merci de nous recontacter.`)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle />
                    </a>
                  </Button>
                  {canEdit && <RemindButton saleId={l.saleId} />}
                </div>
              </li>
            ))}
            {lists.late.length === 0 && <li className="px-5 py-10 text-center text-sm text-muted-foreground">Aucun retard 🎉</li>}
          </ul>
        </Card>

        <Card
          title="Échéances des 30 prochains jours"
          description={lists.upcoming.length ? `${lists.upcoming.length} échéance${lists.upcoming.length > 1 ? "s" : ""} · ${formatMoney(lists.upcomingTotal, currency)}` : "Aucune échéance à venir"}
        >
          <ul className="max-h-[392px] divide-y overflow-y-auto border-t">
            {lists.upcoming.map((u) => (
              <li key={`${u.saleId}-${u.label}`}>
                <Link href={`/admin/ventes/${u.saleId}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40">
                  <span className="grid w-11 shrink-0 place-items-center rounded-lg border bg-background py-1 text-center leading-none">
                    <span className="text-base font-bold tabular">{formatDate(u.dueDate, "d")}</span>
                    <span className="mt-0.5 text-[0.62rem] font-medium text-muted-foreground uppercase">{formatDate(u.dueDate, "MMM")}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{u.buyerName}</p>
                    <p className="text-xs text-muted-foreground">
                      Terrain n°{u.lotNumber} · {u.label}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular">{formatMoney(u.amount, currency)}</p>
                    <p className={cn("text-xs", u.daysLeft <= 3 ? "font-medium text-gold-strong" : "text-muted-foreground")}>
                      {u.daysLeft === 0 ? "aujourd'hui" : u.daysLeft === 1 ? "demain" : `dans ${u.daysLeft} j`}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
            {lists.upcoming.length === 0 && <li className="px-5 py-10 text-center text-sm text-muted-foreground">Rien à encaisser dans les 30 jours.</li>}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Card
          title="Derniers versements"
          action={
            <Link href="/admin/versements" className="text-xs font-medium text-primary hover:underline">
              Journal
            </Link>
          }
        >
          <ul className="divide-y border-t">
            {lists.recentPayments.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/ventes/${p.sale.id}`} className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-muted/40">
                  <MethodIcon method={p.method} className="size-8" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{fullName(p.sale.buyer)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(p.paidAt)} · {PAYMENT_METHOD[p.method]} · n°{p.sale.lot.number}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular">{formatMoney(p.amount, currency)}</span>
                </Link>
              </li>
            ))}
            {lists.recentPayments.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">Aucun versement.</li>}
          </ul>
        </Card>

        <Card
          title="Dernières demandes"
          action={
            <Link href="/admin/demandes" className="text-xs font-medium text-primary hover:underline">
              Toutes
            </Link>
          }
        >
          <ul className="divide-y border-t">
            {lists.recentRequests.map((r) => (
              <li key={r.id}>
                <Link href="/admin/demandes" className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.lot ? `Terrain n°${r.lot.number} (${LOT_STATUS[r.lot.status].label.toLowerCase()})` : "Sans terrain précis"} · {formatRelative(r.createdAt)}
                    </p>
                  </div>
                  <ToneBadge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</ToneBadge>
                </Link>
              </li>
            ))}
            {lists.recentRequests.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">Aucune demande.</li>}
          </ul>
        </Card>

        <Card title="Activité récente" className="lg:col-span-2 xl:col-span-1">
          <ol className="space-y-0 border-t px-5 py-3">
            {lists.activities.map((a, i) => (
              <li key={a.id} className="relative flex gap-3 pb-4 last:pb-1">
                {i < lists.activities.length - 1 && <span className="absolute top-3 left-[5px] h-full w-px bg-border" aria-hidden />}
                <span className="relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-card bg-primary ring-1 ring-primary/30" />
                <div className="min-w-0">
                  <p className="text-sm leading-snug">{a.message}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatRelative(a.createdAt)}
                    {a.actor ? ` · ${a.actor.name}` : ""}
                  </p>
                </div>
              </li>
            ))}
            {lists.activities.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Aucune activité.</li>}
          </ol>
        </Card>
      </div>

    </>
  )
}

/** Carte principale : encaissé / contractualisé / reste */
function HeroCard({ data }: { data: DashboardData }) {
  const { finance, currency } = data
  const paidPct = finance.contracted > 0 ? finance.collected / finance.contracted : 0
  return (
    <section className="relative overflow-hidden rounded-2xl bg-pine-deep p-5 text-white shadow-sm sm:p-7 xl:col-span-2">
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-gold/10 blur-3xl" />
      <div className="relative flex flex-col gap-6 2xl:flex-row 2xl:items-end 2xl:justify-between">
        <div>
          <p className="text-sm font-medium text-white/70">Encaissé à ce jour</p>
          <p className="mt-1 text-[2.3rem] leading-none font-bold tracking-tight sm:text-5xl">{formatMoney(finance.collected, currency)}</p>
          <p className="mt-3 text-sm text-white/70">
            sur <span className="font-semibold text-white">{formatMoney(finance.contracted, currency)}</span> de ventes contractualisées
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:max-w-md">
          <div>
            <dt className="text-white/60">Reste à encaisser</dt>
            <dd className="mt-0.5 text-lg font-semibold">{formatMoneyCompact(finance.remaining, currency)}</dd>
          </div>
          <div>
            <dt className="text-white/60">Recouvrement à date</dt>
            <dd className="mt-0.5 text-lg font-semibold">{formatPercent(finance.recoveryToDate)}</dd>
          </div>
        </dl>
      </div>
      <div className="relative mt-6">
        <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-white/12">
          <div className="h-full rounded-full bg-gold" style={{ width: `${paidPct * 100}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-white/65">
          <span>{formatPercent(paidPct)} du montant des ventes encaissé</span>
          <span>
            {finance.activeSalesCount} vente{finance.activeSalesCount > 1 ? "s" : ""} en cours · {finance.completedSalesCount} soldée{finance.completedSalesCount > 1 ? "s" : ""}
          </span>
        </div>
        {finance.cancelledCollected > 0 && (
          <p className="mt-2 text-xs text-white/55">+ {formatMoney(finance.cancelledCollected, currency)} reçus sur des ventes annulées (non comptés).</p>
        )}
      </div>
    </section>
  )
}

/** Mois en cours : encaissé vs attendu, évolution vs mois précédent */
function MonthCard({ data }: { data: DashboardData }) {
  const { finance, currency } = data
  const ratio = finance.expectedThisMonth > 0 ? Math.min(1, finance.collectedThisMonth / finance.expectedThisMonth) : null
  const delta = finance.monthDelta
  const up = delta != null && delta >= 0
  return (
    <section className="flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
      <div>
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">Encaissé ce mois-ci</p>
          {delta != null && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold",
                up ? "bg-status-available/12 text-status-available-strong" : "bg-status-sold/12 text-status-sold-strong",
              )}
              title="Par rapport au mois précédent"
            >
              {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {up ? "+" : ""}
              {formatPercent(delta)}
            </span>
          )}
        </div>
        <p className="mt-2 text-3xl font-bold tracking-tight">{formatMoney(finance.collectedThisMonth, currency)}</p>
        <p className="mt-1 text-xs text-muted-foreground">Mois précédent : {formatMoney(finance.collectedLastMonth, currency)}</p>
        <div className="mt-4 rounded-xl bg-muted/60 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">À encaisser dans les 30 prochains jours</p>
          <p className="mt-0.5 text-sm font-semibold">
            {formatMoney(data.lists.upcomingTotal, currency)}
            <span className="font-normal text-muted-foreground">
              {" "}
              · {data.lists.upcoming.length} échéance{data.lists.upcoming.length > 1 ? "s" : ""}
            </span>
          </p>
        </div>
      </div>
      <div className="mt-5 space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Attendu ce mois : {formatMoney(finance.expectedThisMonth, currency)}</span>
          <span className="font-semibold tabular">{ratio != null ? formatPercent(ratio) : "—"}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary" style={{ width: `${(ratio ?? 0) * 100}%` }} />
        </div>
        <Link href="/admin/versements" className="inline-flex items-center gap-1 pt-1 text-xs font-medium text-primary hover:underline">
          Voir le journal des versements <ArrowRight className="size-3" />
        </Link>
      </div>
    </section>
  )
}

/** Montant des tuiles : complet sur grand écran, compact (3,7 M) sur mobile ; l'unité est discrète. */
function ResponsiveMoney({ value, currency, compact = "mobile" }: { value: number; currency: string; compact?: "mobile" | "always" }) {
  const unit = <span className="text-sm font-semibold text-muted-foreground"> {currency}</span>
  const short = value >= 100_000 ? formatCompact(value) : formatNumber(value)
  if (compact === "always") return <>{short}{unit}</>
  return (
    <>
      <span className="sm:hidden">
        {short}
        {unit}
      </span>
      <span className="hidden sm:inline">
        {formatNumber(value)}
        {unit}
      </span>
    </>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-48 rounded-2xl xl:col-span-2" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Skeleton className="h-80 rounded-2xl xl:col-span-2" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  )
}
