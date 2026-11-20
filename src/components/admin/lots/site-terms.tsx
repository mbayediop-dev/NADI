"use client"

import * as React from "react"
import { CalendarClock, HandCoins, Info, Pencil, Ruler } from "lucide-react"
import type { LotStatus, PaymentFrequency } from "@/generated/prisma/enums"
import { MONTHS_PER_PERIOD, resolvePlan } from "@/lib/finance"
import { formatArea, formatMoney, formatNumber } from "@/lib/format"
import { FREQUENCY } from "@/lib/labels"
import { followsSitePrice, PRICE_ROUNDINGS, siteLotPrice, type SitePricing } from "@/lib/lot-pricing"
import { useServerAction } from "@/hooks/use-server-action"
import { setSiteTerms } from "@/app/admin/(app)/terrains/actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { MoneyInput } from "@/components/shared/money-input"
import { FormField } from "@/components/admin/settings/form-bits"

export type SiteTerms = { pricing: SitePricing; depositRate: number; installments: number; frequency: PaymentFrequency }
export type SiteTermsLot = { id: string; number: string; areaM2: number; price: number | null; status: LotStatus; customPrice: boolean; hasOwnPlan: boolean }

const TERM_FREQUENCIES = ["MONTHLY", "BIMONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"] as const
type TermFrequency = (typeof TERM_FREQUENCIES)[number]

const plural = (n: number, word: string) => `${formatNumber(n)} ${word}${n > 1 ? "s" : ""}`

/** « 24 mois », ou le nombre de versements pour une périodicité qui ne se compte pas en mois. */
function balanceDuration(installments: number, frequency: PaymentFrequency) {
  const months = MONTHS_PER_PERIOD[frequency]
  return months ? `${formatNumber(installments * months)} mois` : plural(installments, "versement")
}

function installmentsText(count: number, frequency: PaymentFrequency) {
  return frequency === "MONTHLY" ? plural(count, "mensualité") : `${plural(count, "versement")} ${FREQUENCY[frequency].per}`
}

function parseRate(text: string) {
  const value = Number(text.replace(",", ".").replace(/[^\d.]/g, ""))
  return text.trim() === "" || Number.isNaN(value) ? null : value
}

export function SiteTermsCard({ terms, lots, currency, canEdit }: { terms: SiteTerms; lots: SiteTermsLot[]; currency: string; canEdit: boolean }) {
  const [open, setOpen] = React.useState(false)
  const { pricing } = terms
  const following = lots.filter((l) => followsSitePrice(l, pricing)).length
  const custom = pricing.pricePerM2 != null ? lots.filter((l) => l.customPrice && l.status !== "SOLD").length : 0
  const ownPlan = lots.filter((l) => l.hasOwnPlan && l.status !== "SOLD").length
  const sample = lots.find((l) => l.status === "AVAILABLE" && l.price && !l.hasOwnPlan)
  const plan = sample
    ? resolvePlan(
        { price: sample.price, depositAmount: null, installmentsCount: null, frequency: null },
        { defaultDepositRate: terms.depositRate, defaultInstallments: terms.installments, defaultFrequency: terms.frequency },
      )
    : null

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-xs md:p-5" aria-labelledby="site-terms-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="site-terms-title" className="text-base font-semibold">
            Conditions de vente du site
          </h2>
          <p className="text-sm text-muted-foreground">S&apos;appliquent automatiquement à tous les terrains, sauf prix ou modalités particuliers.</p>
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Pencil />
            Modifier
          </Button>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Term
          icon={Ruler}
          label="Prix du m²"
          value={pricing.pricePerM2 ? `${formatNumber(pricing.pricePerM2)} ${currency}` : "Non défini"}
          hint={
            pricing.pricePerM2
              ? `${plural(following, "terrain")} au prix du site${custom ? ` · ${plural(custom, "prix particulier")}` : ""}`
              : "Prix saisis terrain par terrain"
          }
        />
        <Term icon={HandCoins} label="Caution par défaut" value={`${formatNumber(terms.depositRate)} %`} hint="du prix, versée à la réservation" />
        <Term icon={CalendarClock} label="Paiement du solde" value={balanceDuration(terms.installments, terms.frequency)} hint={installmentsText(terms.installments, terms.frequency)} />
      </div>

      {(plan || ownPlan > 0) && (
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          {plan && sample && (
            <p>
              Exemple : terrain n° {sample.number} ({formatArea(sample.areaM2)}) à <strong className="text-foreground tabular">{formatMoney(plan.price, currency)}</strong>
              {" "}— caution {formatMoney(plan.deposit, currency)}, puis {plan.count} × {formatMoney(plan.perInstallment, currency)} {plan.per}.
            </p>
          )}
          {ownPlan > 0 && (
            <p>
              {plural(ownPlan, "terrain")} {ownPlan > 1 ? "ont leurs propres" : "a ses propres"} modalités : caution et durée par défaut ne s&apos;y appliquent pas.
            </p>
          )}
        </div>
      )}

      {open && <SiteTermsDialog terms={terms} lots={lots} currency={currency} onOpenChange={setOpen} />}
    </section>
  )
}

function Term({ icon: Icon, label, value, hint }: { icon: React.ElementType; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1 text-lg font-bold tracking-tight tabular">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function SiteTermsDialog({ terms, lots, currency, onOpenChange }: { terms: SiteTerms; lots: SiteTermsLot[]; currency: string; onOpenChange: (open: boolean) => void }) {
  const { run, pending } = useServerAction()
  const startMonthsPer = MONTHS_PER_PERIOD[terms.frequency]
  const [usePrice, setUsePrice] = React.useState(terms.pricing.pricePerM2 != null)
  const [pricePerM2, setPricePerM2] = React.useState<number | null>(terms.pricing.pricePerM2)
  const [rounding, setRounding] = React.useState(String(terms.pricing.rounding))
  const [rateText, setRateText] = React.useState(formatNumber(terms.depositRate))
  const [months, setMonths] = React.useState<number | null>(startMonthsPer ? terms.installments * startMonthsPer : terms.installments)
  const [frequency, setFrequency] = React.useState<TermFrequency>(startMonthsPer ? (terms.frequency as TermFrequency) : "MONTHLY")
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const rate = parseRate(rateText)
  const rateError = rate != null && rate > 100 ? "La caution ne peut pas dépasser 100 %" : undefined
  const monthsPer = MONTHS_PER_PERIOD[frequency] ?? 1
  const durationError = months && months % monthsPer !== 0 ? `Avec un rythme ${FREQUENCY[frequency].label.toLowerCase()}, la durée doit être un multiple de ${monthsPer} mois.` : undefined
  const installments = months && !durationError ? months / monthsPer : null
  const pricing: SitePricing = { pricePerM2: usePrice && pricePerM2 ? pricePerM2 : null, rounding: Number(rounding) }

  const unsold = lots.filter((l) => l.status !== "SOLD")
  const followers = unsold.filter((l) => followsSitePrice(l, pricing))
  const changes = followers.flatMap((l) => {
    const next = siteLotPrice(l.areaM2, pricing)
    return next != null && next !== l.price ? [{ lot: l, next }] : []
  })
  const custom = pricing.pricePerM2 != null ? unsold.filter((l) => l.customPrice).length : 0
  const sold = lots.length - unsold.length
  const totalAfter = pricing.pricePerM2 != null ? unsold.reduce((s, l) => s + ((followsSitePrice(l, pricing) ? siteLotPrice(l.areaM2, pricing) : l.price) ?? 0), 0) : null

  const sampleLot = unsold.find((l) => !l.hasOwnPlan && (pricing.pricePerM2 != null ? followsSitePrice(l, pricing) : l.price))
  const samplePrice = sampleLot ? (pricing.pricePerM2 != null && followsSitePrice(sampleLot, pricing) ? siteLotPrice(sampleLot.areaM2, pricing) : sampleLot.price) : null
  const plan =
    samplePrice && rate != null && !rateError && installments
      ? resolvePlan({ price: samplePrice, depositAmount: null, installmentsCount: null, frequency: null }, { defaultDepositRate: rate, defaultInstallments: installments, defaultFrequency: frequency })
      : null

  const invalid = (usePrice && !pricePerM2) || rate == null || !!rateError || !months || !!durationError

  function submit() {
    setErrors({})
    run(
      () =>
        setSiteTerms({
          pricePerM2: usePrice ? pricePerM2 : null,
          rounding: Number(rounding) as 1000,
          depositRate: rate ?? Number.NaN,
          durationMonths: months ?? Number.NaN,
          frequency,
        }),
      { onSuccess: () => onOpenChange(false), onError: (_, fieldErrors) => setErrors(fieldErrors ?? {}) },
    )
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Conditions de vente du site</DialogTitle>
          <DialogDescription>Prix du m², caution et durée de paiement proposés pour les terrains du site.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            if (!invalid) submit()
          }}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 p-3">
              <div>
                <p className="text-sm font-semibold">Prix du m² du site</p>
                <p className="text-xs text-muted-foreground">Prix de chaque terrain = surface × prix du m², recalculé automatiquement.</p>
              </div>
              <Switch checked={usePrice} onCheckedChange={setUsePrice} aria-label="Utiliser un prix du m² pour tout le site" />
            </div>
            {usePrice ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Prix du m²" htmlFor="site-ppm2" error={errors.pricePerM2}>
                  <MoneyInput id="site-ppm2" autoFocus value={pricePerM2} onChange={setPricePerM2} suffix={`${currency}/m²`} className="h-9" />
                </FormField>
                <FormField label="Arrondi du prix" htmlFor="site-round">
                  <Select value={rounding} onValueChange={setRounding}>
                    <SelectTrigger id="site-round" className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRICE_ROUNDINGS.map((r) => (
                        <SelectItem key={r.value} value={String(r.value)}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sans prix du m², chaque prix se saisit dans la fiche du terrain. Les prix actuels sont conservés.</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Caution par défaut" htmlFor="site-rate" error={rateError ?? errors.depositRate} hint="Pourcentage du prix versé à la réservation.">
              <div className="relative">
                <Input id="site-rate" inputMode="decimal" className="h-9 pr-8 tabular" value={rateText} onChange={(e) => setRateText(e.target.value)} />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">%</span>
              </div>
            </FormField>
            <FormField label="Paiement du solde" htmlFor="site-months" error={durationError ?? errors.durationMonths} hint={installments ? installmentsText(installments, frequency) : "Durée pour payer le reste du prix."}>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="site-months"
                    inputMode="numeric"
                    className="h-9 pr-12 tabular"
                    value={months ?? ""}
                    onChange={(e) => setMonths(e.target.value.replace(/\D/g, "") ? Number(e.target.value.replace(/\D/g, "")) : null)}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">mois</span>
                </div>
                <Select value={frequency} onValueChange={(f) => setFrequency(f as TermFrequency)}>
                  <SelectTrigger className="h-9 w-[132px]" aria-label="Rythme des versements">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TERM_FREQUENCIES.map((f) => (
                      <SelectItem key={f} value={f}>
                        {FREQUENCY[f].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </FormField>
          </div>

          <div className="space-y-2 rounded-xl border p-3 text-sm">
            <p className="font-semibold">Effet sur les terrains</p>
            {pricing.pricePerM2 != null ? (
              <>
                <p className="text-muted-foreground">
                  {changes.length ? `${plural(changes.length, "prix")} recalculé${changes.length > 1 ? "s" : ""}` : "Aucun prix à modifier"}
                  {custom ? ` · ${plural(custom, "prix particulier")} conservé${custom > 1 ? "s" : ""}` : ""}
                  {sold ? ` · ${plural(sold, "terrain vendu")} non modifié${sold > 1 ? "s" : ""}` : ""}
                </p>
                {changes.length > 0 && (
                  <ul className="max-h-40 divide-y overflow-y-auto rounded-lg border bg-muted/30">
                    {changes.slice(0, 40).map(({ lot, next }) => (
                      <li key={lot.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
                        <span className="text-muted-foreground">
                          N° {lot.number} · {formatArea(lot.areaM2)}
                        </span>
                        <span className="tabular">
                          <span className="text-muted-foreground line-through">{lot.price ? formatNumber(lot.price) : "—"}</span>{" "}
                          <strong>{formatMoney(next, currency)}</strong>
                        </span>
                      </li>
                    ))}
                    {changes.length > 40 && <li className="px-3 py-1.5 text-center text-xs text-muted-foreground">… et {changes.length - 40} autres</li>}
                  </ul>
                )}
                {totalAfter != null && (
                  <p className="text-right text-muted-foreground">
                    Valeur des terrains non vendus : <strong className="text-foreground tabular">{formatMoney(totalAfter, currency)}</strong>
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Les prix des terrains ne changent pas.</p>
            )}
            {plan && sampleLot && (
              <p className="flex items-start gap-2 rounded-lg bg-secondary/50 p-2.5 text-xs">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span>
                  Terrain n° {sampleLot.number} : {formatMoney(plan.price, currency)}, caution {formatMoney(plan.deposit, currency)}, puis {plan.count} × {formatMoney(plan.perInstallment, currency)} {plan.per}.
                </span>
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending || invalid}>
              {pending && <Spinner />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
