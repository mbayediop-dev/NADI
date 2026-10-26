import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowUpRight, Bookmark, Inbox, LandPlot, MapPin, Ruler, Sparkles, Star, Wallet } from "lucide-react"
import { hasRole, requireAdmin } from "@/lib/auth/admin"
import { getSettings, planDefaults } from "@/lib/settings"
import { getAdminLotDetail, getLotFields } from "@/lib/queries/lots"
import { getPlanLots, planImage } from "@/lib/queries/plan"
import { resolvePlan } from "@/lib/finance"
import { formatArea, formatDate, formatMoney, formatNumber, formatPercent, formatRelative, fullName } from "@/lib/format"
import { REQUEST_STATUS, SALE_STATUS } from "@/lib/labels"
import { formatPhone } from "@/lib/phone"
import { PageHeader } from "@/components/admin/page-header"
import { LotStatusBadge, ToneBadge } from "@/components/shared/badges"
import { PaymentPlanSummary } from "@/components/shared/payment-plan"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { LotDetailActions } from "@/components/admin/lots/lot-actions"
import { LotMiniPlan } from "@/components/admin/lots/lot-mini-plan"

export const metadata: Metadata = { title: "Terrain" }

export default function LotDetailPage({ params }: PageProps<"/admin/terrains/[id]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <LotDetail params={params} />
    </Suspense>
  )
}

function Card({ title, icon: Icon, children, action }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card shadow-xs">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3 md:px-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4 text-primary" />
          {title}
        </h2>
        {action}
      </header>
      <div className="p-4 md:p-5">{children}</div>
    </section>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold">{value ?? "—"}</dd>
    </div>
  )
}

async function LotDetail({ params }: { params: PageProps<"/admin/terrains/[id]">["params"] }) {
  const admin = await requireAdmin()
  const { id } = await params
  const settings = await getSettings()
  const [lot, fields, planLots] = await Promise.all([getAdminLotDetail(id), getLotFields(), getPlanLots({ settings, audience: "admin" })])
  if (!lot) notFound()

  const currency = settings.currencyLabel
  const plan = resolvePlan(lot, planDefaults(settings))
  const usesDefaults = lot.depositAmount == null && lot.installmentsCount == null && lot.frequency == null
  const activeSale = lot.sales.find((s) => s.status !== "CANCELLED") ?? null
  const pastSales = lot.sales.filter((s) => s.status === "CANCELLED")
  const attributes = (lot.attributes ?? {}) as Record<string, unknown>
  const img = planImage(settings)
  const openRequests = lot.requests.filter((r) => r.status === "NEW" || r.status === "CONTACTED").length

  return (
    <>
      <PageHeader
        back={{ href: "/admin/terrains", label: "Terrains" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            Terrain n° {lot.number}
            <LotStatusBadge status={lot.status} />
            {lot.isFeatured && (
              <ToneBadge tone="bg-gold/20 text-gold-strong ring-gold/40">
                <Star className="size-3 fill-current" /> Coup de cœur
              </ToneBadge>
            )}
          </span>
        }
        description={[lot.block && `Îlot ${lot.block}`, formatArea(lot.areaM2), lot.position].filter(Boolean).join(" · ")}
        actions={<LotDetailActions lot={lot} canEdit={hasRole(admin, "ADMIN")} hasSale={!!activeSale} hasHistory={lot.sales.length > 0} />}
      />

      {lot.status === "RESERVED" && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-status-reserved/40 bg-status-reserved/10 p-4 text-sm">
          <Bookmark className="mt-0.5 size-4 shrink-0 text-status-reserved-strong" />
          <div>
            <p className="font-semibold">Option posée sur ce terrain</p>
            <p className="text-muted-foreground">{lot.reservedNote || "Aucune note."}</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          {/* Prix */}
          <Card
            title="Prix et modalités de paiement"
            icon={Wallet}
            action={usesDefaults && plan ? <ToneBadge tone="bg-muted text-muted-foreground ring-border">Modalités par défaut</ToneBadge> : undefined}
          >
            <div className="mb-4 flex flex-wrap items-end gap-x-6 gap-y-2">
              <div>
                <p className="text-xs text-muted-foreground">Prix de vente</p>
                <p className="text-3xl font-extrabold tracking-tight tabular">{lot.price ? formatMoney(lot.price, currency) : "Non défini"}</p>
              </div>
              {lot.price && (
                <p className="pb-1 text-sm text-muted-foreground tabular">
                  {formatNumber(lot.price / lot.areaM2)} {currency} / m²
                </p>
              )}
            </div>
            {plan ? <PaymentPlanSummary plan={plan} currency={currency} /> : <p className="text-sm text-muted-foreground">Renseignez un prix pour définir les modalités.</p>}
          </Card>

          {/* Vente */}
          <Card title="Attribution" icon={LandPlot}>
            {activeSale ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/admin/acheteurs/${activeSale.buyer.id}`} className="text-lg font-bold hover:text-primary">
                      {fullName(activeSale.buyer)}
                    </Link>
                    <p className="text-sm text-muted-foreground tabular">{formatPhone(activeSale.buyer.phone)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ToneBadge tone={SALE_STATUS[activeSale.status].tone}>{SALE_STATUS[activeSale.status].label}</ToneBadge>
                    <Link href={`/admin/ventes/${activeSale.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                      {activeSale.reference}
                      <ArrowUpRight className="size-4" />
                    </Link>
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Payé : <strong className="text-foreground tabular">{formatMoney(activeSale.summary.totalPaid, currency)}</strong>
                    </span>
                    <span className="font-semibold tabular">{formatPercent(activeSale.summary.progress)}</span>
                  </div>
                  <Progress value={activeSale.summary.progress * 100} className="h-2" />
                </div>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Info label="Prix convenu" value={<span className="tabular">{formatMoney(activeSale.price, currency)}</span>} />
                  <Info label="Reste à payer" value={<span className="tabular">{formatMoney(activeSale.summary.remaining, currency)}</span>} />
                  <Info label="Signature" value={formatDate(activeSale.signedAt)} />
                  <Info
                    label="Retard"
                    value={
                      activeSale.summary.overdueAmount > 0 ? (
                        <span className="text-status-sold-strong tabular">{formatMoney(activeSale.summary.overdueAmount, currency)}</span>
                      ) : (
                        <span className="text-status-available-strong">À jour</span>
                      )
                    }
                  />
                </dl>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {lot.status === "UNAVAILABLE" ? "Ce terrain n'est pas commercialisé." : "Ce terrain n'est attribué à aucun acheteur pour le moment."}
              </p>
            )}
            {pastSales.length > 0 && (
              <div className="mt-5 border-t pt-4">
                <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Historique</p>
                <ul className="space-y-2 text-sm">
                  {pastSales.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/admin/ventes/${s.id}`} className="hover:text-primary">
                        {s.reference} · {fullName(s.buyer)}
                      </Link>
                      <span className="text-muted-foreground">Annulée le {formatDate(s.cancelledAt ?? s.updatedAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* Caractéristiques */}
          <Card title="Caractéristiques" icon={Ruler}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
              <Info label="Superficie" value={formatArea(lot.areaM2)} />
              <Info label="Dimensions" value={lot.frontageM && lot.depthM ? `${formatNumber(lot.frontageM)} × ${formatNumber(lot.depthM)} m` : null} />
              <Info label="Îlot" value={lot.block} />
              <Info label="Type de sol" value={lot.soilType} />
              <Info label="Orientation" value={lot.orientation} />
              <Info label="Ajouté le" value={formatDate(lot.createdAt)} />
              {fields.map((f) => {
                const value = attributes[f.key]
                return (
                  <Info
                    key={f.key}
                    label={f.label}
                    value={value == null || value === "" ? null : typeof value === "boolean" ? (value ? "Oui" : "Non") : `${String(value)}${f.unit ? ` ${f.unit}` : ""}`}
                  />
                )
              })}
            </dl>
            {lot.position && (
              <p className="mt-5 flex items-start gap-2 text-sm">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                {lot.position}
              </p>
            )}
            {lot.features.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {lot.features.map((f) => (
                  <span key={f} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                    <Sparkles className="size-3" />
                    {f}
                  </span>
                ))}
              </div>
            )}
            {lot.description && <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{lot.description}</p>}
          </Card>
        </div>

        <div className="space-y-6">
          <LotMiniPlan lotId={lot.id} lots={planLots} {...img} hasGeometry={!!lot.polygon} />

          <Card
            title="Demandes reçues"
            icon={Inbox}
            action={openRequests > 0 ? <ToneBadge tone="bg-gold/20 text-gold-strong ring-gold/40">{openRequests} en cours</ToneBadge> : undefined}
          >
            {lot.requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune demande pour ce terrain.</p>
            ) : (
              <ul className="-my-2 divide-y">
                {lot.requests.slice(0, 8).map((r) => (
                  <li key={r.id} className="py-2.5">
                    <Link href={`/admin/demandes?id=${r.id}`} className="flex items-start justify-between gap-3 hover:text-primary">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{r.fullName}</span>
                        <span className="text-xs text-muted-foreground">{formatRelative(r.createdAt)}</span>
                      </span>
                      <ToneBadge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</ToneBadge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

        </div>
      </div>
    </>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-80" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  )
}
