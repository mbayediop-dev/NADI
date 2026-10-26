"use client"

import * as React from "react"
import { Check, Compass, Copy, Layers, MapPin, Maximize2, Mountain, Ruler, Share2, Star } from "lucide-react"
import { toast } from "sonner"
import { addPeriods, buildSchedule } from "@/lib/finance"
import { formatArea, formatDate, formatMoney, formatNumber } from "@/lib/format"
import { whatsappLink } from "@/lib/phone"
import { cn } from "@/lib/utils"
import { LotStatusBadge } from "@/components/shared/badges"
import { PaymentPlanSummary } from "@/components/shared/payment-plan"
import { Button } from "@/components/ui/button"
import { WhatsAppIcon } from "@/components/site/whatsapp-fab"
import { LotCard } from "@/components/site/explorer/lot-card"
import { monthlyEquivalent, type PublicLot } from "@/components/site/lot-utils"

/** Fiche détaillée d'un terrain (panneau de l'explorateur et page /terrains/[numéro]). */
export function LotDetails({
  lot,
  currency,
  similar,
  onSelectSimilar,
  companyName,
  companyWhatsapp,
  showTitle = true,
  cta,
}: {
  lot: PublicLot
  currency: string
  similar: PublicLot[]
  onSelectSimilar?: (lot: PublicLot) => void
  companyName: string
  companyWhatsapp: string
  showTitle?: boolean
  /** Bouton d'action affiché juste sous le prix (page d'un terrain) */
  cta?: React.ReactNode
}) {
  const available = lot.status === "AVAILABLE"
  const monthly = lot.plan ? monthlyEquivalent(lot.plan) : null

  const facts = [
    { icon: Maximize2, label: "Surface", value: formatArea(lot.areaM2) },
    {
      icon: Ruler,
      label: "Dimensions",
      value: lot.frontageM && lot.depthM ? `${formatNumber(lot.frontageM)} m × ${formatNumber(lot.depthM)} m` : null,
    },
    { icon: Mountain, label: "Type de sol", value: lot.soilType },
    { icon: Compass, label: "Orientation de la façade", value: lot.orientation },
    { icon: Layers, label: "Îlot", value: lot.block },
    ...lot.fields.map((f) => ({ icon: Check, label: f.label, value: f.value })),
  ].filter((f) => f.value)

  return (
    <div className="space-y-7">
      {showTitle && (
        <div className="flex items-start gap-4">
          <span
            className={cn(
              "grid size-16 shrink-0 place-items-center rounded-lg font-display text-3xl font-semibold tabular",
              available ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {lot.number}
          </span>
          <div className="min-w-0 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <LotStatusBadge status={lot.status} />
              {lot.isFeatured && available && (
                <span className="inline-flex h-6 items-center gap-1 rounded-md bg-gold/20 px-2.5 text-xs font-bold text-gold-strong">
                  <Star className="size-3 fill-current" />
                  Coup de cœur
                </span>
              )}
            </div>
            <h3 className="mt-2 font-display text-2xl leading-tight">Terrain n° {lot.number}</h3>
            {lot.position && (
              <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0" />
                {lot.position}
              </p>
            )}
          </div>
        </div>
      )}

      {available && lot.price != null ? (
        <div className="relative overflow-hidden rounded-lg bg-pine-deep p-5 text-white">
          <div aria-hidden className="absolute -top-16 -right-10 size-44 rounded-full bg-gold/20 blur-2xl" />
          <p className="relative text-xs font-semibold tracking-[0.18em] text-gold uppercase">Prix du terrain</p>
          <p className="relative mt-1 font-display text-4xl font-medium tabular">{formatMoney(lot.price, currency)}</p>
          <div className="relative mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/70">
            <span className="tabular">{formatMoney(Math.round(lot.price / lot.areaM2), currency)} / m²</span>
            {monthly && <span className="font-semibold text-white tabular">dès {formatMoney(Math.round(monthly / 1000) * 1000, currency)} / mois</span>}
          </div>
        </div>
      ) : available ? (
        <div className="rounded-lg border border-dashed p-5 text-center">
          <p className="font-semibold">Prix sur demande</p>
          <p className="mt-1 text-sm text-muted-foreground">Réservez ce terrain ou contactez-nous pour connaître son prix et ses modalités.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-muted/50 p-5">
          <p className="font-semibold">{lot.status === "UNAVAILABLE" ? "Ce lot n'est pas commercialisé." : "Ce terrain est déjà réservé ou vendu."}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {similar.length > 0 ? "Voici des terrains disponibles aux caractéristiques proches." : "Contactez-nous : de nouveaux lots peuvent se libérer."}
          </p>
        </div>
      )}

      {cta}

      {!available && similar.length > 0 && (
        <div className="grid gap-3">
          {similar.map((s) => (
            <LotCard key={s.id} lot={s} currency={currency} onSelect={() => onSelectSimilar?.(s)} compact />
          ))}
        </div>
      )}

      <section>
        <h4 className="text-sm font-bold">Caractéristiques</h4>
        <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border">
          {facts.map((f) => (
            <div key={f.label} className="bg-card p-3">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <f.icon className="size-3.5" />
                {f.label}
              </dt>
              <dd className="mt-1 text-sm font-semibold">{f.value}</dd>
            </div>
          ))}
          {facts.length % 2 === 1 && <div className="bg-card" />}
        </dl>
        {lot.features.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {lot.features.map((f) => (
              <li key={f} className="rounded-md bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                {f}
              </li>
            ))}
          </ul>
        )}
        {lot.description && <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{lot.description}</p>}
      </section>

      {lot.plan && (
        <section>
          <h4 className="text-sm font-bold">Modalités de paiement</h4>
          <PaymentPlanSummary plan={lot.plan} currency={currency} className="mt-3" />
          <SchedulePreview lot={lot} currency={currency} />
        </section>
      )}

      <ShareRow lot={lot} companyName={companyName} companyWhatsapp={companyWhatsapp} />
    </div>
  )
}

function SchedulePreview({ lot, currency }: { lot: PublicLot; currency: string }) {
  const plan = lot.plan!
  const lines = React.useMemo(() => {
    const today = new Date()
    return buildSchedule({
      price: plan.price,
      depositAmount: plan.deposit,
      depositDueDate: today,
      installmentsCount: plan.count,
      frequency: plan.frequency,
      customIntervalDays: plan.customIntervalDays,
      firstDueDate: addPeriods(today, plan.frequency, 1, plan.customIntervalDays),
      installmentAmount: lot.installmentAmount,
    })
  }, [plan, lot.installmentAmount])
  if (lines.length === 0) return null
  const visible = lines.length > 5 ? [...lines.slice(0, 3), null, lines[lines.length - 1]] : lines
  return (
    <div className="mt-4 rounded-md border bg-muted/30 p-4">
      <p className="text-xs font-semibold text-muted-foreground">Simulation si vous réservez aujourd&apos;hui</p>
      <ol className="mt-3 space-y-2">
        {visible.map((line, i) =>
          line ? (
            <li key={line.index} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", line.index === 0 ? "bg-gold" : "bg-primary/60")} />
                <span className="font-medium">{line.label}</span>
                <span className="text-xs text-muted-foreground">{line.index === 0 ? "à la signature" : formatDate(line.dueDate, "MMM yyyy")}</span>
              </span>
              <span className="font-semibold tabular">{formatMoney(line.amount, currency)}</span>
            </li>
          ) : (
            <li key={`gap-${i}`} className="pl-4 text-xs text-muted-foreground">
              ⋯ {lines.length - 4} autres échéances identiques
            </li>
          ),
        )}
      </ol>
      <p className="mt-3 text-[0.7rem] leading-relaxed text-muted-foreground">
        Montants indicatifs. L&apos;échéancier définitif est établi avec vous à la signature.
      </p>
    </div>
  )
}

function ShareRow({ lot, companyName, companyWhatsapp }: { lot: PublicLot; companyName: string; companyWhatsapp: string }) {
  const [copied, setCopied] = React.useState(false)
  function url() {
    return `${window.location.origin}/terrains/${encodeURIComponent(lot.number)}`
  }
  async function share() {
    const link = url()
    if (navigator.share) {
      try {
        await navigator.share({ title: `Terrain n° ${lot.number} — ${companyName}`, url: link })
        return
      } catch {
        /* partage annulé */
      }
    }
    await navigator.clipboard.writeText(link)
    setCopied(true)
    toast.success("Lien copié")
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="flex flex-wrap gap-2 border-t pt-5">
      <Button variant="outline" size="lg" className="h-10 rounded-md" onClick={share}>
        {copied ? <Copy /> : <Share2 />}
        Partager ce terrain
      </Button>
      {companyWhatsapp && (
        <Button variant="outline" size="lg" className="h-10 rounded-md" asChild>
          <a
            href={whatsappLink(companyWhatsapp, `Bonjour ${companyName}, je souhaite des informations sur le terrain n° ${lot.number}.`)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <WhatsAppIcon className="size-4 text-[#25D366]" />
            Poser une question
          </a>
        </Button>
      )}
    </div>
  )
}
