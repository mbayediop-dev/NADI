import Link from "next/link"
import { differenceInCalendarDays } from "date-fns"
import { AlertTriangle, CalendarClock, CheckCircle2, PartyPopper, Ruler } from "lucide-react"
import type { OwnerSale } from "@/lib/queries/portal"
import { formatArea, formatDate, formatDateLong, formatMoney, formatNumber, fullName } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ProgressRing } from "@/components/portal/progress-ring"
import { ContactButtons, type CompanyContact } from "@/components/portal/contact-buttons"

function dueIn(date: Date, now: Date) {
  const days = differenceInCalendarDays(date, now)
  if (days === 0) return "aujourd'hui"
  if (days === 1) return "demain"
  return `dans ${formatNumber(days)} jours`
}

/** Carte principale d'un terrain : progression du paiement, montants et prochaine échéance. */
export function LotHero({ sale, currency, contact, now }: { sale: OwnerSale; currency: string; contact: CompanyContact; now: Date }) {
  const { summary, lot } = sale
  const settled = sale.status === "COMPLETED" || summary.isSettled
  const late = !settled && summary.overdueAmount > 0
  const percent = Math.floor(summary.progress * 100)

  return (
    <section className="relative overflow-hidden rounded-[1.75rem] bg-pine-deep text-white shadow-lg shadow-pine-deep/15">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.08] mix-blend-luminosity"
        style={{ backgroundImage: "url(/plan/site-plan.svg)", backgroundSize: "220%", backgroundPosition: "30% 40%" }}
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-pine-deep via-pine-deep/95 to-pine/80" />
      <div aria-hidden className="absolute -top-20 -right-16 size-64 rounded-full bg-gold/25 blur-3xl" />

      <div className="relative p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">Mon terrain</p>
            <h2 className="mt-1.5 font-display text-[2.1rem] leading-none sm:text-5xl">
              N° {lot.number}
              {lot.block && <span className="ml-2 align-middle font-sans text-base font-semibold text-white/60 sm:text-lg">Îlot {lot.block}</span>}
            </h2>
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/75">
              <span className="inline-flex items-center gap-1.5">
                <Ruler className="size-4 text-gold" />
                {formatArea(lot.areaM2)}
                {lot.frontageM && lot.depthM ? ` · ${formatNumber(lot.frontageM)} × ${formatNumber(lot.depthM)} m` : ""}
              </span>
              <span className="hidden text-white/30 sm:inline">•</span>
              <span>Vente {sale.reference}</span>
            </p>
            {lot.position && <p className="mt-1 line-clamp-1 text-sm text-white/55">{lot.position}</p>}
          </div>
          <ProgressRing value={summary.progress} size={112} stroke={10} className="sm:hidden">
            <span>
              <span className="block text-2xl font-extrabold tabular">{percent}%</span>
              <span className="block text-[0.65rem] font-semibold tracking-wide text-white/60 uppercase">payé</span>
            </span>
          </ProgressRing>
        </div>

        <div className="mt-6 flex items-center gap-8">
          <ProgressRing value={summary.progress} size={148} stroke={12} className="hidden sm:grid">
            <span>
              <span className="block text-4xl font-extrabold tabular">{percent}%</span>
              <span className="block text-xs font-semibold tracking-wide text-white/60 uppercase">payé</span>
            </span>
          </ProgressRing>
          <dl className="grid flex-1 grid-cols-2 gap-3 lg:grid-cols-3">
            <div className="rounded-2xl bg-white/[0.07] p-3.5 ring-1 ring-white/10 sm:p-4">
              <dt className="text-xs text-white/60">Déjà payé</dt>
              <dd className="mt-1 text-[0.95rem] font-bold whitespace-nowrap tabular sm:text-xl">{formatMoney(summary.totalPaid, currency)}</dd>
            </div>
            <div className="rounded-2xl bg-white/[0.07] p-3.5 ring-1 ring-white/10 sm:p-4">
              <dt className="text-xs text-white/60">Reste à payer</dt>
              <dd className={cn("mt-1 text-[0.95rem] font-bold whitespace-nowrap tabular sm:text-xl", settled ? "text-white/60" : "text-gold")}>
                {formatMoney(summary.remaining, currency)}
              </dd>
            </div>
            <div className="col-span-2 flex items-center justify-between rounded-2xl bg-white/[0.07] p-3.5 ring-1 ring-white/10 sm:p-4 lg:col-span-1 lg:block">
              <dt className="text-xs text-white/60">Prix du terrain</dt>
              <dd className="font-bold tabular lg:mt-1 lg:text-xl">{formatMoney(summary.price, currency)}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-5">
          <div className="h-2 overflow-hidden rounded-full bg-white/10 sm:hidden">
            <div className="h-full rounded-full bg-gold" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 text-xs text-white/55 sm:mt-0">
            {formatNumber(summary.paidCount)} échéance{summary.paidCount > 1 ? "s" : ""} réglée{summary.paidCount > 1 ? "s" : ""} sur{" "}
            {formatNumber(summary.totalCount)}
          </p>
        </div>
      </div>

      {/* Bandeau de situation */}
      {settled ? (
        <div className="relative flex items-start gap-3 border-t border-white/10 bg-gold/95 px-5 py-4 text-gold-foreground sm:px-7">
          <PartyPopper className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-bold">Félicitations, votre terrain est entièrement payé !</p>
            <p className="text-sm opacity-80">Merci pour votre confiance. NADI Group vous contactera pour la suite des formalités.</p>
          </div>
        </div>
      ) : late ? (
        <div className="relative border-t border-white/10 bg-status-sold px-5 py-4 text-white sm:px-7">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-bold">
                Paiement en retard : {formatMoney(summary.overdueAmount, currency)}
              </p>
              <p className="text-sm text-white/85">
                {formatNumber(summary.overdueCount)} échéance{summary.overdueCount > 1 ? "s" : ""} non réglée{summary.overdueCount > 1 ? "s" : ""}
                {summary.daysLate > 0 && ` · depuis ${formatNumber(summary.daysLate)} jour${summary.daysLate > 1 ? "s" : ""}`}. Contactez NADI Group pour
                régulariser votre situation.
              </p>
            </div>
          </div>
          <ContactButtons
            variant="light"
            contact={contact}
            className="mt-3 sm:ml-8"
            message={`Bonjour, je suis ${fullName(sale.buyer)}, propriétaire du terrain n° ${lot.number} (${sale.reference}). Je souhaite régulariser mon paiement.`}
          />
        </div>
      ) : summary.nextDue ? (
        <Link
          href="/espace-client/paiements"
          className="relative flex items-center gap-3 border-t border-white/10 bg-white px-5 py-4 text-foreground transition-colors hover:bg-sand sm:px-7"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <CalendarClock className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold tracking-wide text-muted-foreground uppercase">Prochaine échéance</span>
            <span className="block font-semibold">
              <span className="sm:hidden">{formatDate(summary.nextDue.dueDate)}</span>
              <span className="hidden sm:inline">{formatDateLong(summary.nextDue.dueDate)}</span>{" "}
              <span className="font-normal text-muted-foreground">· {dueIn(summary.nextDue.dueDate, now)}</span>
            </span>
          </span>
          <span className="text-right text-base font-extrabold whitespace-nowrap text-primary tabular sm:text-lg">{formatMoney(summary.nextDue.remaining, currency)}</span>
        </Link>
      ) : (
        <div className="relative flex items-center gap-3 border-t border-white/10 bg-white px-5 py-4 text-foreground sm:px-7">
          <CheckCircle2 className="size-5 text-status-available" />
          <p className="text-sm font-semibold">Toutes vos échéances sont à jour.</p>
        </div>
      )}
    </section>
  )
}
