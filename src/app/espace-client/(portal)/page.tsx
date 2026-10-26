import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Compass,
  FileText,
  HardHat,
  Layers,
  MapPinned,
  ReceiptText,
  Sprout,
  UserRound,
  Wallet,
} from "lucide-react"
import { requireBuyer } from "@/lib/auth/client"
import { getSettings } from "@/lib/settings"
import { getPlanLots, planImage } from "@/lib/queries/plan"
import { getOwnerDocuments, getOwnerSales, getOwnerUpdates, getWorksProgress } from "@/lib/queries/portal"
import { formatDate, formatDateLong, formatMoney, formatRelative } from "@/lib/format"
import { INSTALLMENT_STATUS, PAYMENT_METHOD } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { ToneBadge } from "@/components/shared/badges"
import { LotHero } from "@/components/portal/lot-hero"
import { OwnerPlan } from "@/components/portal/owner-plan"
import { PortalCard } from "@/components/portal/card"
import { ContactButtons } from "@/components/portal/contact-buttons"
import { ProgressRing } from "@/components/portal/progress-ring"

export const metadata: Metadata = { title: "Mon espace" }

export default function PortalHomePage({ searchParams }: PageProps<"/espace-client">) {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent searchParams={searchParams} />
    </Suspense>
  )
}

async function HomeContent({ searchParams }: { searchParams: PageProps<"/espace-client">["searchParams"] }) {
  const buyer = await requireBuyer()
  const [{ vente }, settings, sales, works, updates, docs] = await Promise.all([
    searchParams,
    getSettings(),
    getOwnerSales(buyer.id),
    getWorksProgress(),
    getOwnerUpdates(1),
    getOwnerDocuments(buyer.id),
  ])
  const lots = await getPlanLots({ settings, audience: "client" })
  const now = new Date()
  const currency = settings.currencyLabel
  const contact = { company: settings.companyName, phone: settings.companyPhone, whatsapp: settings.companyWhatsapp, email: settings.companyEmail }
  const plan = planImage(settings)

  const hour = now.getHours()
  const greeting = hour < 5 || hour >= 18 ? "Bonsoir" : "Bonjour"

  if (sales.length === 0) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <h1 className="text-2xl font-bold">
          {greeting}, {buyer.firstName}
        </h1>
        <p className="mt-2 text-muted-foreground">Aucun terrain n&apos;est actuellement rattaché à votre compte.</p>
        <ContactButtons contact={contact} className="mt-6 justify-center" />
      </div>
    )
  }

  // Terrain affiché : celui demandé, sinon un terrain en retard, sinon le premier en cours
  const ranked = [...sales].sort((a, b) => score(b) - score(a))
  const current = sales.find((s) => s.id === vente) ?? ranked[0]
  const upcoming = current.summary.rows.filter((r) => r.remaining > 0).slice(0, 3)
  const lastPayments = current.payments.slice(0, 3)
  const latest = updates[0]
  const docCount = docs.own.length + docs.general.length
  const totals = sales.reduce(
    (acc, s) => ({ paid: acc.paid + s.summary.totalPaid, remaining: acc.remaining + s.summary.remaining }),
    { paid: 0, remaining: 0 },
  )

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground first-letter:uppercase">{formatDateLong(now)}</p>
          <h1 className="text-[1.65rem] leading-tight font-bold tracking-tight sm:text-3xl">
            {greeting}, {buyer.firstName}
          </h1>
        </div>
        {sales.length > 1 && (
          <p className="text-sm text-muted-foreground">
            {sales.length} terrains · {formatMoney(totals.paid, currency)} payés · <span className="font-semibold text-foreground">{formatMoney(totals.remaining, currency)} restants</span>
          </p>
        )}
      </div>

      {sales.length > 1 && (
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Mes terrains">
          {sales.map((s) => {
            const active = s.id === current.id
            const late = s.summary.overdueAmount > 0
            return (
              <Link
                key={s.id}
                href={`/espace-client?vente=${s.id}`}
                scroll={false}
                role="tab"
                aria-selected={active}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                  active ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-card hover:bg-muted",
                )}
              >
                <MapPinned className="size-4" />
                Terrain n° {s.lot.number}
                {late && <span className={cn("size-2 rounded-full", active ? "bg-gold" : "bg-status-sold")} aria-label="en retard" />}
                {s.status === "COMPLETED" && <span className={cn("text-xs font-medium", active ? "text-gold" : "text-status-available-strong")}>Soldé</span>}
              </Link>
            )
          })}
        </div>
      )}

      <LotHero sale={current} currency={currency} contact={contact} now={now} />

      <div className="grid gap-5 md:gap-6 lg:grid-cols-5">
        <PortalCard title="Mon terrain sur le plan" icon={MapPinned} className="lg:col-span-3" bodyClassName="space-y-4">
          <OwnerPlan
            imageUrl={plan.imageUrl}
            width={plan.width}
            height={plan.height}
            lots={lots}
            ownedIds={sales.map((s) => s.lotId)}
            selectedId={current.lotId}
          />
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { icon: Layers, label: "Type de sol", value: current.lot.soilType },
              { icon: Compass, label: "Orientation", value: current.lot.orientation },
              { icon: MapPinned, label: "Îlot", value: current.lot.block },
              { icon: CalendarDays, label: "Acquis le", value: formatDate(current.signedAt) },
            ]
              .filter((item) => item.value)
              .map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-2xl bg-muted/60 px-3 py-2.5">
                  <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon className="size-3.5" />
                    {label}
                  </dt>
                  <dd className="mt-0.5 text-sm leading-snug font-semibold">{value}</dd>
                </div>
              ))}
          </dl>
        </PortalCard>

        <div className="space-y-5 md:space-y-6 lg:col-span-2">
          <PortalCard title="Prochaines échéances" icon={CalendarDays} action={{ href: "/espace-client/paiements", label: "Échéancier" }} bodyClassName="pt-3">
            {upcoming.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">Aucune échéance restante. 🎉</p>
            ) : (
              <ul className="divide-y">
                {upcoming.map((row) => (
                  <li key={row.index} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{row.label}</p>
                      <p className="text-xs text-muted-foreground tabular">{formatDate(row.dueDate)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-bold tabular">{formatMoney(row.remaining, currency)}</span>
                      <ToneBadge tone={INSTALLMENT_STATUS[row.state].tone} className="h-5 px-2 text-[0.68rem]">
                        {INSTALLMENT_STATUS[row.state].label}
                      </ToneBadge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PortalCard>

          <PortalCard title="Derniers versements" icon={ReceiptText} action={{ href: "/espace-client/paiements#historique", label: "Tout voir" }} bodyClassName="pt-3">
            {lastPayments.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">Aucun versement enregistré pour le moment.</p>
            ) : (
              <ul className="divide-y">
                {lastPayments.map((p) => (
                  <li key={p.id}>
                    <Link href={`/espace-client/recus/${p.id}`} className="group flex items-center gap-3 py-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-status-available/12 text-status-available-strong">
                        <Wallet className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold tabular">{formatMoney(p.amount, currency)}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {formatDate(p.paidAt)} · {PAYMENT_METHOD[p.method]}
                        </span>
                      </span>
                      <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                        Reçu
                        <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </PortalCard>
        </div>
      </div>

      <PortalCard title="Avancement du chantier" icon={HardHat} action={{ href: "/espace-client/avancement", label: "Détails" }}>
        <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
          <div className="flex items-center gap-5">
            <ProgressRing value={works.overall / 100} size={104} stroke={10} trackClassName="stroke-muted" indicatorClassName="stroke-primary">
              <span>
                <span className="block text-2xl font-extrabold tabular">{works.overall}%</span>
                <span className="block text-[0.62rem] font-semibold tracking-wide text-muted-foreground uppercase">global</span>
              </span>
            </ProgressRing>
            <div className="space-y-1.5 text-sm">
              <p>
                <span className="font-bold tabular">{works.done}</span> <span className="text-muted-foreground">étape{works.done > 1 ? "s" : ""} terminée{works.done > 1 ? "s" : ""}</span>
              </p>
              <p>
                <span className="font-bold tabular">{works.inProgress}</span> <span className="text-muted-foreground">en cours</span>
              </p>
              <p>
                <span className="font-bold tabular">{works.milestones.length - works.done - works.inProgress}</span>{" "}
                <span className="text-muted-foreground">à venir</span>
              </p>
            </div>
          </div>
          {latest ? (
            <Link href="/espace-client/avancement" className="group flex gap-4 rounded-2xl border bg-muted/30 p-3 transition-colors hover:bg-muted/60">
              {latest.media.find((m) => m.type === "IMAGE") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={latest.media.find((m) => m.type === "IMAGE")!.url}
                  alt=""
                  className="size-20 shrink-0 rounded-xl object-cover sm:size-24"
                />
              ) : (
                <span className="grid size-20 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-pine-deep text-gold sm:size-24">
                  <Sprout className="size-7" />
                </span>
              )}
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-muted-foreground">Dernière actualité · {formatRelative(latest.publishedAt)}</span>
                <span className="mt-0.5 line-clamp-1 block font-semibold group-hover:text-primary">{latest.title}</span>
                <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{latest.body}</span>
              </span>
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">Les prochaines actualités du chantier apparaîtront ici.</p>
          )}
        </div>
      </PortalCard>

      <div className="grid grid-cols-3 gap-3">
        {[
          { href: "/espace-client/paiements", icon: Wallet, label: "Paiements", hint: `${current.payments.length} versement${current.payments.length > 1 ? "s" : ""}` },
          { href: "/espace-client/documents", icon: FileText, label: "Documents", hint: `${docCount} fichier${docCount > 1 ? "s" : ""}` },
          { href: "/espace-client/profil", icon: UserRound, label: "Profil", hint: "Mes infos" },
        ].map(({ href, icon: Icon, label, hint }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col gap-3 rounded-3xl border bg-card p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center"
          >
            <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{label}</span>
              <span className="block truncate text-xs text-muted-foreground">{hint}</span>
            </span>
            <ArrowRight className="hidden size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block" />
          </Link>
        ))}
      </div>
    </div>
  )
}

function score(sale: Awaited<ReturnType<typeof getOwnerSales>>[number]) {
  if (sale.summary.overdueAmount > 0) return 3
  if (sale.status === "ACTIVE") return 2
  return 1
}

function HomeSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-64" />
      </div>
      <Skeleton className="h-[340px] w-full rounded-[1.75rem]" />
      <div className="grid gap-6 lg:grid-cols-5">
        <Skeleton className="h-[420px] rounded-3xl lg:col-span-3" />
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-48 rounded-3xl" />
          <Skeleton className="h-48 rounded-3xl" />
        </div>
      </div>
    </div>
  )
}
