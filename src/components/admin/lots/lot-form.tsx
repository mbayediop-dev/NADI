"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Coins, Info, LandPlot, ListChecks, Lock, Ruler, Save, SlidersHorizontal } from "lucide-react"
import type { FieldType, LotStatus, PaymentFrequency } from "@/generated/prisma/enums"
import { buildSchedule, resolvePlan, toDueDate, type PlanDefaults } from "@/lib/finance"
import { formatArea, formatDate, formatMoney, formatNumber } from "@/lib/format"
import { LOT_STATUS } from "@/lib/labels"
import { cn } from "@/lib/utils"
import type { LotInput } from "@/lib/lot-import"
import { useServerAction } from "@/hooks/use-server-action"
import { createLot, updateLot } from "@/app/admin/(app)/terrains/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { MoneyInput } from "@/components/shared/money-input"
import { PaymentPlanSummary } from "@/components/shared/payment-plan"
import { LotStatusBadge } from "@/components/shared/badges"
import { FormField, FormSection, parseOptionalNumber, Suggestions, TagInput } from "@/components/admin/settings/form-bits"
import { PlanFields } from "@/components/admin/lots/plan-fields"

export type LotFieldDef = { key: string; label: string; type: FieldType; unit: string | null; options: string[] }

export type LotFormInitial = {
  id?: string
  number: string
  block: string | null
  areaM2: number | null
  frontageM: number | null
  depthM: number | null
  price: number | null
  depositAmount: number | null
  installmentsCount: number | null
  frequency: PaymentFrequency | null
  customIntervalDays: number | null
  installmentAmount: number | null
  status: LotStatus
  reservedNote: string | null
  soilType: string | null
  position: string | null
  orientation: string | null
  description: string | null
  features: string[]
  isFeatured: boolean
  attributes: Record<string, string | number | boolean | null>
}

type Props = {
  initial: LotFormInitial
  fields: LotFieldDef[]
  suggestions: { soilTypes: string[]; blocks: string[]; orientations: string[]; features: string[] }
  defaults: PlanDefaults
  currency: string
  /** Vente en cours sur ce terrain (statut verrouillé) */
  sale?: { id: string; reference: string; buyerName: string } | null
}

function NumberInput({ value, onChange, id, placeholder, suffix }: { value: number | null; onChange: (v: number | null) => void; id: string; placeholder?: string; suffix?: string }) {
  return (
    <div className="relative">
      <Input
        id={id}
        inputMode="decimal"
        className={cn("h-9 tabular", suffix && "pr-10")}
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e) => onChange(parseOptionalNumber(e.target.value))}
      />
      {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">{suffix}</span>}
    </div>
  )
}

export function LotForm({ initial, fields, suggestions, defaults, currency, sale }: Props) {
  const router = useRouter()
  const { run, pending } = useServerAction()
  // Création : modalités par défaut pré-remplies
  const [v, setV] = React.useState(() =>
    initial.id || initial.installmentsCount != null || initial.frequency != null
      ? initial
      : { ...initial, installmentsCount: defaults.defaultInstallments, frequency: defaults.defaultFrequency },
  )
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [useDefaults, setUseDefaults] = React.useState(initial.id ? initial.depositAmount == null && initial.installmentsCount == null && initial.frequency == null : false)
  // Le formulaire est rendu à la demande (sous-arbre dynamique) : la date du jour peut être lue ici
  const [today] = React.useState(() => new Date())

  const set = <K extends keyof LotFormInitial>(key: K, value: LotFormInitial[K]) => setV((prev) => ({ ...prev, [key]: value }))

  const planSource = useDefaults
    ? { price: v.price, depositAmount: null, installmentsCount: null, frequency: null, customIntervalDays: null, installmentAmount: null }
    : v
  const plan = resolvePlan(planSource, defaults)
  const pricePerM2 = v.price && v.areaM2 ? v.price / v.areaM2 : null
  const preview =
    plan && today
      ? buildSchedule({
          price: plan.price,
          depositAmount: plan.deposit,
          depositDueDate: today,
          installmentsCount: plan.count,
          frequency: plan.frequency,
          customIntervalDays: plan.customIntervalDays,
          firstDueDate: toDueDate(new Date(today.getFullYear(), today.getMonth() + 1, today.getDate())),
          installmentAmount: useDefaults ? null : v.installmentAmount,
        })
      : []

  function submit() {
    const payload: LotInput = {
      number: v.number,
      block: v.block,
      areaM2: v.areaM2 ?? Number.NaN,
      frontageM: v.frontageM,
      depthM: v.depthM,
      price: v.price,
      depositAmount: useDefaults ? null : v.depositAmount,
      installmentsCount: useDefaults ? null : v.installmentsCount,
      frequency: useDefaults ? null : v.frequency,
      customIntervalDays: useDefaults || v.frequency !== "CUSTOM" ? null : v.customIntervalDays,
      installmentAmount: useDefaults ? null : v.installmentAmount,
      status: v.status === "SOLD" ? "AVAILABLE" : v.status,
      reservedNote: v.reservedNote,
      soilType: v.soilType,
      position: v.position,
      orientation: v.orientation,
      description: v.description,
      features: v.features,
      isFeatured: v.isFeatured,
      attributes: v.attributes,
    }
    setErrors({})
    run(() => (initial.id ? updateLot(initial.id, payload) : createLot(payload)), {
      onSuccess: (data) => router.push(`/admin/terrains/${data.id}`),
      onError: (_, fieldErrors) => setErrors(fieldErrors ?? {}),
      refresh: false,
    })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="grid gap-6 pb-24 lg:grid-cols-[minmax(0,1fr)_360px] lg:pb-0"
    >
      <div className="space-y-6">
        <FormSection title="Identification" description="Numéro affiché sur le plan et sur le site." icon={LandPlot}>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Numéro du terrain" htmlFor="number" required error={errors.number}>
              <Input id="number" className="h-9 font-semibold" value={v.number} onChange={(e) => set("number", e.target.value)} placeholder="Ex. 12 ou A-12" autoFocus={!initial.id} />
            </FormField>
            <FormField label="Îlot / zone" htmlFor="block" error={errors.block}>
              <Input id="block" list="blocks" className="h-9" value={v.block ?? ""} onChange={(e) => set("block", e.target.value || null)} placeholder="Ex. A" />
              <Suggestions id="blocks" values={suggestions.blocks} />
            </FormField>
            <FormField label="Superficie" htmlFor="area" required error={errors.areaM2}>
              <NumberInput id="area" value={v.areaM2} onChange={(n) => set("areaM2", n)} placeholder="300" suffix="m²" />
            </FormField>
            <FormField label="Façade" htmlFor="frontage" error={errors.frontageM}>
              <NumberInput id="frontage" value={v.frontageM} onChange={(n) => set("frontageM", n)} placeholder="15" suffix="m" />
            </FormField>
            <FormField label="Profondeur" htmlFor="depth" error={errors.depthM}>
              <NumberInput id="depth" value={v.depthM} onChange={(n) => set("depthM", n)} placeholder="20" suffix="m" />
            </FormField>
            {v.frontageM && v.depthM && (
              <div className="flex items-end pb-2 text-xs text-muted-foreground">
                <span>
                  {formatNumber(v.frontageM)} × {formatNumber(v.depthM)} m = <strong className="text-foreground">{formatArea(v.frontageM * v.depthM)}</strong>
                  {v.areaM2 !== v.frontageM * v.depthM && (
                    <button type="button" className="ml-1 text-primary underline underline-offset-2" onClick={() => set("areaM2", (v.frontageM ?? 0) * (v.depthM ?? 0))}>
                      utiliser
                    </button>
                  )}
                </span>
              </div>
            )}
          </div>
        </FormSection>

        <FormSection title="Prix et modalités de paiement" description="Ce que l'acheteur verra sur le site : prix, acompte et versements." icon={Coins}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Prix du terrain"
              htmlFor="price"
              error={errors.price}
              hint={pricePerM2 ? `Soit ${formatNumber(pricePerM2)} ${currency} / m²` : "Laissez vide pour « Prix sur demande »"}
            >
              <MoneyInput id="price" className="h-9" value={v.price} onChange={(n) => set("price", n)} suffix={currency} />
            </FormField>
            <FormField label="Prix au m² (calcul rapide)" htmlFor="ppm2" hint="Renseigne le prix à partir de la superficie.">
              <MoneyInput
                id="ppm2"
                className="h-9"
                value={pricePerM2 ? Math.round(pricePerM2) : null}
                onChange={(n) => v.areaM2 && set("price", n ? Math.round((n * v.areaM2) / 1000) * 1000 : null)}
                suffix={`${currency}/m²`}
                disabled={!v.areaM2}
              />
            </FormField>
          </div>

          <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border bg-muted/30 p-3">
            <div>
              <p className="text-sm font-semibold">Utiliser les modalités par défaut</p>
              <p className="text-xs text-muted-foreground">
                {defaults.defaultDepositRate} % d&apos;acompte puis {defaults.defaultInstallments} versements — modifiables dans les paramètres.
              </p>
            </div>
            <Switch
              checked={useDefaults}
              onCheckedChange={(checked) => {
                setUseDefaults(checked)
                if (!checked)
                  setV((prev) => ({
                    ...prev,
                    depositAmount: prev.depositAmount ?? (prev.price ? Math.round((prev.price * defaults.defaultDepositRate) / 100 / 1000) * 1000 : null),
                    installmentsCount: prev.installmentsCount ?? defaults.defaultInstallments,
                    frequency: prev.frequency ?? defaults.defaultFrequency,
                  }))
              }}
              aria-label="Utiliser les modalités par défaut"
            />
          </div>

          {!useDefaults && (
            <div className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Acompte"
                  htmlFor="deposit"
                  error={errors.depositAmount}
                  hint={v.price && v.depositAmount != null ? `${formatNumber((v.depositAmount / v.price) * 100)} % du prix` : "0 = sans acompte"}
                >
                  <MoneyInput id="deposit" className="h-9" value={v.depositAmount} onChange={(n) => set("depositAmount", n)} suffix={currency} />
                </FormField>
                <FormField label="Raccourcis" htmlFor="deposit-presets">
                  <div id="deposit-presets" className="flex flex-wrap gap-1.5">
                    {[0, 10, 20, 25, 30, 40, 50].map((p) => (
                      <button
                        key={p}
                        type="button"
                        disabled={!v.price}
                        onClick={() => set("depositAmount", v.price ? Math.round((v.price * p) / 100 / 1000) * 1000 : 0)}
                        className="h-8 rounded-lg border px-2.5 text-xs font-semibold transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-40"
                      >
                        {p === 0 ? "Aucun" : `${p} %`}
                      </button>
                    ))}
                  </div>
                </FormField>
              </div>
              <PlanFields
                count={v.installmentsCount}
                frequency={v.frequency}
                customDays={v.customIntervalDays}
                errors={errors}
                onChange={(p) =>
                  setV((prev) => ({
                    ...prev,
                    ...("count" in p ? { installmentsCount: p.count ?? null } : {}),
                    ...("frequency" in p ? { frequency: p.frequency ?? null } : {}),
                    ...("customDays" in p ? { customIntervalDays: p.customDays ?? null } : {}),
                  }))
                }
              />
              <FormField
                label="Montant par versement (optionnel)"
                htmlFor="installment"
                error={errors.installmentAmount}
                hint="Vide = solde réparti automatiquement. Sinon, la dernière échéance ajuste le total."
              >
                <MoneyInput id="installment" className="h-9" value={v.installmentAmount} onChange={(n) => set("installmentAmount", n)} suffix={currency} placeholder="Calcul automatique" />
              </FormField>
            </div>
          )}
        </FormSection>

        <FormSection title="Statut" description="Le statut « Vendu » est posé automatiquement lors de l'attribution à un acheteur." icon={ListChecks}>
          {sale ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 p-3 text-sm">
              <Lock className="size-4 text-muted-foreground" />
              <LotStatusBadge status={initial.status} />
              <span className="flex-1">
                Attribué à <strong>{sale.buyerName}</strong>
              </span>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/ventes/${sale.id}`}>Vente {sale.reference}</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-3">
                {(["AVAILABLE", "RESERVED", "UNAVAILABLE"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set("status", s)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border p-3 text-left text-sm font-semibold transition-all",
                      v.status === s ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50",
                    )}
                  >
                    <span className="size-3 rounded-[4px]" style={{ background: LOT_STATUS[s].color }} />
                    {LOT_STATUS[s].label}
                  </button>
                ))}
              </div>
              {v.status === "RESERVED" && (
                <FormField label="Note sur l'option" htmlFor="reservedNote" hint="Ex. : option pour M. Diallo jusqu'au 15/11, en attente de l'acompte.">
                  <Input id="reservedNote" className="h-9" value={v.reservedNote ?? ""} onChange={(e) => set("reservedNote", e.target.value || null)} />
                </FormField>
              )}
            </div>
          )}
        </FormSection>

        <FormSection title="Caractéristiques" description="Informations affichées sur la fiche publique du terrain." icon={Ruler}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Type de sol" htmlFor="soil" error={errors.soilType}>
              <Input id="soil" list="soils" className="h-9" value={v.soilType ?? ""} onChange={(e) => set("soilType", e.target.value || null)} placeholder="Ex. Sableux (dior)" />
              <Suggestions id="soils" values={suggestions.soilTypes} />
            </FormField>
            <FormField label="Orientation de la façade" htmlFor="orientation">
              <Input id="orientation" list="orientations" className="h-9" value={v.orientation ?? ""} onChange={(e) => set("orientation", e.target.value || null)} placeholder="Ex. Nord" />
              <Suggestions id="orientations" values={suggestions.orientations} />
            </FormField>
            <FormField label="Position" htmlFor="position" className="sm:col-span-2" error={errors.position}>
              <Input id="position" className="h-9" value={v.position ?? ""} onChange={(e) => set("position", e.target.value || null)} placeholder="Ex. Façade sur l'avenue principale, angle de rue" />
            </FormField>
            <FormField label="Atouts" htmlFor="features" className="sm:col-span-2" hint="Entrée pour ajouter. Ex. : Angle, Vue dégagée, Proche école.">
              <TagInput id="features" value={v.features} onChange={(f) => set("features", f)} suggestions={suggestions.features} />
            </FormField>
            <FormField label="Description" htmlFor="description" className="sm:col-span-2" error={errors.description}>
              <Textarea id="description" rows={4} value={v.description ?? ""} onChange={(e) => set("description", e.target.value || null)} placeholder="Présentez le terrain en quelques phrases…" />
            </FormField>
            <label className="flex items-center justify-between gap-4 rounded-xl border p-3 sm:col-span-2">
              <span>
                <span className="block text-sm font-semibold">Mettre en avant</span>
                <span className="text-xs text-muted-foreground">Le terrain est signalé comme « coup de cœur » sur le site.</span>
              </span>
              <Switch checked={v.isFeatured} onCheckedChange={(c) => set("isFeatured", c)} />
            </label>
          </div>
        </FormSection>

        {fields.length > 0 && (
          <FormSection
            title="Informations complémentaires"
            description={
              <>
                Champs définis dans <Link href="/admin/parametres?tab=champs" className="text-primary underline underline-offset-2">Paramètres</Link>.
              </>
            }
            icon={SlidersHorizontal}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((f) => {
                const value = v.attributes[f.key]
                const setAttr = (val: string | number | boolean | null) => set("attributes", { ...v.attributes, [f.key]: val })
                const id = `attr-${f.key}`
                if (f.type === "BOOLEAN") {
                  return (
                    <label key={f.key} className="flex items-center justify-between gap-4 rounded-xl border p-3">
                      <span className="text-sm font-semibold">{f.label}</span>
                      <Switch checked={value === true} onCheckedChange={(c) => setAttr(c)} />
                    </label>
                  )
                }
                if (f.type === "SELECT") {
                  return (
                    <FormField key={f.key} label={f.label} htmlFor={id}>
                      <Select value={typeof value === "string" && value ? value : "__none"} onValueChange={(val) => setAttr(val === "__none" ? null : val)}>
                        <SelectTrigger id={id} className="h-9 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">Non renseigné</SelectItem>
                          {f.options.map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>
                  )
                }
                if (f.type === "NUMBER") {
                  return (
                    <FormField key={f.key} label={f.label} htmlFor={id}>
                      <NumberInput id={id} value={typeof value === "number" ? value : null} onChange={(n) => setAttr(n)} suffix={f.unit ?? undefined} />
                    </FormField>
                  )
                }
                return (
                  <FormField key={f.key} label={f.label} htmlFor={id}>
                    <Input id={id} className="h-9" value={typeof value === "string" ? value : ""} onChange={(e) => setAttr(e.target.value || null)} />
                  </FormField>
                )
              })}
            </div>
          </FormSection>
        )}
      </div>

      {/* Aperçu */}
      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
          <div className="bg-pine-deep p-5 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">Aperçu</p>
                <p className="mt-1 text-2xl font-bold">Terrain n° {v.number || "—"}</p>
                <p className="text-sm text-white/70">
                  {v.block ? `Îlot ${v.block} · ` : ""}
                  {formatArea(v.areaM2)}
                </p>
              </div>
              {!sale && <LotStatusBadge status={v.status} className="bg-white/95" />}
            </div>
            <p className="mt-4 text-3xl font-extrabold tracking-tight tabular">{v.price ? formatMoney(v.price, currency) : "Prix sur demande"}</p>
            {pricePerM2 && <p className="text-sm text-white/70 tabular">{formatNumber(pricePerM2)} {currency} / m²</p>}
          </div>
          <div className="space-y-4 p-4">
            {plan ? (
              <>
                <PaymentPlanSummary plan={plan} currency={currency} />
                {preview.length > 1 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Exemple d&apos;échéancier (signature aujourd&apos;hui)</p>
                    <ul className="divide-y rounded-xl border text-sm">
                      {preview.slice(0, 4).map((line) => (
                        <li key={line.index} className="flex items-center justify-between gap-2 px-3 py-2">
                          <span>
                            <span className="font-medium">{line.label}</span>
                            <span className="ml-2 text-xs text-muted-foreground">{formatDate(line.dueDate)}</span>
                          </span>
                          <span className="font-semibold tabular">{formatMoney(line.amount, currency)}</span>
                        </li>
                      ))}
                      {preview.length > 4 && <li className="px-3 py-2 text-center text-xs text-muted-foreground">… {preview.length - 4} autres échéances</li>}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0" />
                Renseignez un prix pour calculer les modalités de paiement.
              </p>
            )}
          </div>
        </div>
        <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t bg-background/95 p-3 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0">
          <Button type="button" variant="outline" className="h-10 flex-1 lg:flex-none" onClick={() => router.back()}>
            Annuler
          </Button>
          <Button type="submit" className="h-10 flex-[2] lg:flex-1" disabled={pending}>
            {pending ? <Spinner /> : <Save />}
            {initial.id ? "Enregistrer les modifications" : "Créer le terrain"}
          </Button>
        </div>
      </aside>
    </form>
  )
}
