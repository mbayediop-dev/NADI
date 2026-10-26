import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowUpRight, BadgeDollarSign, CalendarClock, Coins, IdCard, Mail, MapPin, Phone, ReceiptText, SquareStack, Wallet } from "lucide-react"
import { db } from "@/lib/db"
import { hasRole, requireAdmin } from "@/lib/auth/admin"
import { getSettings } from "@/lib/settings"
import { getBuyerSales } from "@/lib/queries/sales"
import { formatArea, formatDate, formatDateTime, formatMoney, formatPercent, fullName, initials } from "@/lib/format"
import { PAYMENT_METHOD, REQUEST_STATUS, SALE_STATUS } from "@/lib/labels"
import { formatPhone } from "@/lib/phone"
import { PageHeader } from "@/components/admin/page-header"
import { StatCard } from "@/components/admin/stat-card"
import { ToneBadge } from "@/components/shared/badges"
import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/admin/sales/card"
import { Amount } from "@/components/admin/sales/amount"
import { PaymentProgress } from "@/components/admin/sales/payment-progress"
import { MethodIcon } from "@/components/admin/payments/method-icon"
import { BuyerActions, PortalToggle } from "@/components/admin/buyers/buyer-actions"

export const metadata: Metadata = { title: "Acheteur" }

export default function BuyerPage({ params }: PageProps<"/admin/acheteurs/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-16 w-80" />
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      }
    >
      <BuyerContent params={params} />
    </Suspense>
  )
}

async function BuyerContent({ params }: { params: PageProps<"/admin/acheteurs/[id]">["params"] }) {
  const admin = await requireAdmin()
  const { id } = await params
  const [buyer, settings] = await Promise.all([
    db.buyer.findUnique({
      where: { id },
      include: { requests: { orderBy: { createdAt: "desc" }, include: { lot: { select: { number: true } } } } },
    }),
    getSettings(),
  ])
  if (!buyer) notFound()
  const sales = await getBuyerSales(id, { includeCancelled: true })
  const currency = settings.currencyLabel
  const canEdit = hasRole(admin, "ADMIN")
  const live = sales.filter((s) => s.status !== "CANCELLED")
  const contracted = live.reduce((s, x) => s + x.price, 0)
  const paid = live.reduce((s, x) => s + x.summary.totalPaid, 0)
  const remaining = live.reduce((s, x) => s + x.summary.remaining, 0)
  const overdue = live.reduce((s, x) => s + x.summary.overdueAmount, 0)
  const next = live
    .map((s) => s.summary.nextDue)
    .filter((n): n is NonNullable<typeof n> => !!n)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0]
  const payments = sales
    .flatMap((s) => s.payments.map((p) => ({ ...p, lotNumber: s.lot.number, saleId: s.id })))
    .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime())
  const name = fullName(buyer)

  return (
    <>
      <PageHeader
        back={{ href: "/admin/acheteurs", label: "Acheteurs" }}
        title={
          <span className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">{initials(name)}</span>
            {name}
          </span>
        }
        description={`Client depuis le ${formatDate(buyer.createdAt)}${buyer.profession ? ` · ${buyer.profession}` : ""}`}
        actions={
          <BuyerActions
            canEdit={canEdit}
            hasSales={sales.length > 0}
            companyName={settings.companyName}
            buyer={{
              id: buyer.id,
              firstName: buyer.firstName,
              phone: buyer.phone,
              form: {
                firstName: buyer.firstName,
                lastName: buyer.lastName,
                phone: buyer.phone,
                phoneAlt: buyer.phoneAlt ?? "",
                email: buyer.email ?? "",
                address: buyer.address ?? "",
                city: buyer.city ?? "",
                country: buyer.country ?? "",
                profession: buyer.profession ?? "",
                idType: buyer.idType ?? "CNI",
                idNumber: buyer.idNumber ?? "",
                notes: buyer.notes ?? "",
              },
            }}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <StatCard label="Terrains" value={live.length} icon={SquareStack} tone="primary" hint={live.map((s) => `n°${s.lot.number}`).join(", ") || "Aucun terrain"} />
        <StatCard label="Contractualisé" value={<Amount value={contracted} currency={currency} />} icon={BadgeDollarSign} />
        <StatCard label="Payé" value={<Amount value={paid} currency={currency} />} icon={Wallet} tone="success" hint={contracted ? `${formatPercent(paid / contracted)} · reste ${formatMoney(remaining, currency)}` : undefined}>
          {contracted > 0 && <PaymentProgress progress={paid / contracted} overdueRatio={overdue / contracted} className="mt-3" />}
        </StatCard>
        <StatCard
          label={overdue > 0 ? "En retard" : "Prochaine échéance"}
          value={overdue > 0 ? <Amount value={overdue} currency={currency} /> : next ? <Amount value={next.remaining} currency={currency} /> : "—"}
          icon={overdue > 0 ? Coins : CalendarClock}
          tone={overdue > 0 ? "danger" : "gold"}
          hint={overdue > 0 ? "À régulariser" : next ? formatDate(next.dueDate) : undefined}
        />
      </div>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Card title="Terrains et ventes" description={sales.length === 0 ? undefined : `${sales.length} vente${sales.length > 1 ? "s" : ""}`}>
            {sales.length === 0 ? (
              <p className="border-t px-5 py-10 text-center text-sm text-muted-foreground">Aucun terrain attribué à cet acheteur.</p>
            ) : (
              <ul className="divide-y border-t">
                {sales.map((s) => (
                  <li key={s.id}>
                    <Link href={`/admin/ventes/${s.id}`} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 font-bold text-primary tabular">{s.lot.number}</span>
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 font-semibold">
                            {s.reference}
                            {s.summary.overdueAmount > 0 ? (
                              <ToneBadge tone="bg-status-sold/12 text-status-sold-strong ring-status-sold/30" dot>
                                Retard {s.summary.daysLate} j
                              </ToneBadge>
                            ) : (
                              <ToneBadge tone={SALE_STATUS[s.status].tone}>{SALE_STATUS[s.status].label}</ToneBadge>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {s.lot.block ? `Îlot ${s.lot.block} · ` : ""}
                            {formatArea(s.lot.areaM2)} · signée le {formatDate(s.signedAt)}
                          </p>
                        </div>
                      </div>
                      <div className="w-full space-y-1.5 sm:w-56">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium tabular">
                            {formatMoney(s.summary.totalPaid, currency)} / {formatMoney(s.price, currency)}
                          </span>
                          <span className="text-muted-foreground tabular">{Math.round(s.summary.progress * 100)} %</span>
                        </div>
                        <PaymentProgress progress={s.summary.progress} overdueRatio={s.summary.overdueAmount / s.price} />
                        <p className="text-xs text-muted-foreground">
                          {s.summary.nextDue
                            ? `Prochaine : ${formatMoney(s.summary.nextDue.remaining, currency)} le ${formatDate(s.summary.nextDue.dueDate)}`
                            : s.status === "COMPLETED"
                              ? "Entièrement payé"
                              : s.status === "CANCELLED"
                                ? `Annulée le ${formatDate(s.cancelledAt)}`
                                : "—"}
                        </p>
                      </div>
                      <ArrowUpRight className="hidden size-4 text-muted-foreground sm:block" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Historique des versements" description={`${payments.length} versement${payments.length > 1 ? "s" : ""}`}>
            {payments.length === 0 ? (
              <p className="border-t px-5 py-10 text-center text-sm text-muted-foreground">Aucun versement.</p>
            ) : (
              <ul className="max-h-[520px] divide-y overflow-y-auto border-t">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                    <MethodIcon method={p.method} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold tabular">{formatMoney(p.amount, currency)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDate(p.paidAt)} · {PAYMENT_METHOD[p.method]} · terrain n°{p.lotNumber} · {p.receiptNumber}
                      </p>
                    </div>
                    <Link href={`/admin/versements/${p.id}/recu`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                      <ReceiptText className="size-3.5" />
                      Reçu
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Coordonnées">
            <div className="space-y-2.5 px-5 pb-5 text-sm">
              <a href={`tel:${buyer.phone}`} className="flex items-center gap-2.5 hover:text-primary">
                <Phone className="size-4 text-muted-foreground" />
                <span className="tabular">{formatPhone(buyer.phone)}</span>
              </a>
              {buyer.phoneAlt && (
                <a href={`tel:${buyer.phoneAlt}`} className="flex items-center gap-2.5 hover:text-primary">
                  <Phone className="size-4 text-muted-foreground" />
                  <span className="tabular">{formatPhone(buyer.phoneAlt)}</span>
                </a>
              )}
              {buyer.email && (
                <a href={`mailto:${buyer.email}`} className="flex items-center gap-2.5 hover:text-primary">
                  <Mail className="size-4 text-muted-foreground" />
                  {buyer.email}
                </a>
              )}
              {(buyer.address || buyer.city || buyer.country) && (
                <p className="flex items-center gap-2.5">
                  <MapPin className="size-4 shrink-0 text-muted-foreground" />
                  {[buyer.address, buyer.city, buyer.country].filter(Boolean).join(", ")}
                </p>
              )}
              {buyer.idNumber && (
                <p className="flex items-center gap-2.5">
                  <IdCard className="size-4 text-muted-foreground" />
                  {buyer.idType ?? "Pièce"} n° {buyer.idNumber}
                </p>
              )}
              {buyer.notes && <p className="mt-3 rounded-lg bg-muted/60 p-3 text-xs whitespace-pre-wrap text-muted-foreground">{buyer.notes}</p>}
            </div>
          </Card>

          <Card title="Espace client" action={<PortalToggle buyerId={buyer.id} enabled={buyer.portalEnabled} canEdit={canEdit} />}>
            <div className="space-y-2 px-5 pb-5 text-sm text-muted-foreground">
              <p>
                {buyer.portalEnabled
                  ? live.length > 0
                    ? "L'acheteur se connecte avec son numéro de téléphone et un code reçu par SMS."
                    : "L'accès sera possible dès qu'un terrain lui sera attribué."
                  : "Accès désactivé : l'acheteur ne peut plus se connecter."}
              </p>
              <p>
                Dernière connexion : <span className="font-medium text-foreground">{buyer.lastLoginAt ? formatDateTime(buyer.lastLoginAt) : "jamais"}</span>
              </p>
            </div>
          </Card>

          {buyer.requests.length > 0 && (
            <Card title="Demandes de réservation" action={<Link href="/admin/demandes" className="text-xs font-medium text-primary hover:underline">Toutes</Link>}>
              <ul className="divide-y border-t">
                {buyer.requests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium">{r.lot ? `Terrain n°${r.lot.number}` : "Sans terrain précis"}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</p>
                    </div>
                    <ToneBadge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</ToneBadge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
