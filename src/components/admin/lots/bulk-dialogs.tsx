"use client"

import * as React from "react"
import type { PaymentFrequency } from "@/generated/prisma/enums"
import { resolvePlan } from "@/lib/finance"
import { formatArea, formatMoney, formatNumber } from "@/lib/format"
import { LOT_STATUS } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { useServerAction } from "@/hooks/use-server-action"
import type { AdminLotRow } from "@/lib/queries/lots"
import {
  bulkDeleteLots,
  bulkSetDeposit,
  bulkSetPlan,
  bulkSetPrice,
  bulkSetSoilType,
  bulkSetStatus,
} from "@/app/admin/(app)/terrains/actions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { MoneyInput } from "@/components/shared/money-input"
import { FormField, Suggestions } from "@/components/admin/settings/form-bits"
import { PlanFields } from "@/components/admin/lots/plan-fields"

export type BulkKind = "price" | "deposit" | "plan" | "status" | "soil" | "delete"

type DialogProps = {
  rows: AdminLotRow[]
  currency: string
  soilTypes: string[]
  onDone: () => void
  onOpenChange: (open: boolean) => void
}

const ROUNDINGS = [
  { value: "1", label: "Aucun arrondi" },
  { value: "1000", label: "Au millier (1 000)" },
  { value: "10000", label: "À 10 000" },
  { value: "50000", label: "À 50 000" },
  { value: "100000", label: "À 100 000" },
]

const roundTo = (v: number, step: number) => Math.round(v / step) * step

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
            value === o.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Preview({ items }: { items: { key: string; left: React.ReactNode; right: React.ReactNode }[] }) {
  if (!items.length) return null
  return (
    <div className="max-h-48 overflow-y-auto rounded-xl border bg-muted/30">
      <ul className="divide-y text-sm">
        {items.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="text-muted-foreground">{item.left}</span>
            <span className="font-semibold tabular">{item.right}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Shell({
  title,
  description,
  children,
  onSubmit,
  pending,
  submitLabel = "Appliquer",
  destructive,
  disabled,
  onOpenChange,
}: {
  title: string
  description: React.ReactNode
  children: React.ReactNode
  onSubmit: () => void
  pending: boolean
  submitLabel?: string
  destructive?: boolean
  disabled?: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit()
          }}
        >
          {children}
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={pending || disabled}>
              {pending && <Spinner />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const plural = (n: number) => `${formatNumber(n)} terrain${n > 1 ? "s" : ""}`

export function BulkPriceDialog({ rows, currency, onDone, onOpenChange }: DialogProps) {
  const { run, pending } = useServerAction()
  const [mode, setMode] = React.useState<"fixed" | "perM2">("perM2")
  const [value, setValue] = React.useState<number | null>(null)
  const [rounding, setRounding] = React.useState("50000")
  const [adjustDeposit, setAdjustDeposit] = React.useState(true)
  const editable = rows.filter((r) => r.status !== "SOLD")
  const sold = rows.length - editable.length
  const compute = (r: AdminLotRow) => (value ? roundTo(mode === "fixed" ? value : value * r.areaM2, Number(rounding)) : null)
  const total = editable.reduce((s, r) => s + (compute(r) ?? 0), 0)

  return (
    <Shell
      title="Définir le prix"
      description={`${plural(editable.length)} concerné${editable.length > 1 ? "s" : ""}${sold ? ` · ${sold} vendu${sold > 1 ? "s" : ""} ignoré${sold > 1 ? "s" : ""}` : ""}`}
      pending={pending}
      disabled={!value || editable.length === 0}
      onOpenChange={onOpenChange}
      onSubmit={() =>
        run(() => bulkSetPrice(rows.map((r) => r.id), { mode, value: value ?? 0, rounding: Number(rounding) as 1000, adjustDeposit }), {
          onSuccess: () => {
            onDone()
            onOpenChange(false)
          },
        })
      }
    >
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: "perM2", label: "Prix au m²" },
          { value: "fixed", label: "Montant fixe" },
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={mode === "perM2" ? "Prix au m²" : "Prix du terrain"} htmlFor="bulk-price">
          <MoneyInput id="bulk-price" autoFocus value={value} onChange={setValue} suffix={mode === "perM2" ? `${currency}/m²` : currency} className="h-9" />
        </FormField>
        <FormField label="Arrondi" htmlFor="bulk-round">
          <Select value={rounding} onValueChange={setRounding}>
            <SelectTrigger id="bulk-round" className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROUNDINGS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <label className="flex items-start gap-2.5 rounded-xl border p-3 text-sm">
        <Checkbox checked={adjustDeposit} onCheckedChange={(v) => setAdjustDeposit(!!v)} className="mt-0.5" />
        <span>
          <span className="font-medium">Recalculer l&apos;acompte</span>
          <span className="block text-xs text-muted-foreground">Conserve le même pourcentage du prix (ou le taux par défaut).</span>
        </span>
      </label>
      {value ? (
        <>
          <Preview
            items={editable.slice(0, 30).map((r) => ({
              key: r.id,
              left: `N° ${r.number} · ${formatArea(r.areaM2)}`,
              right: formatMoney(compute(r), currency),
            }))}
          />
          <p className="text-right text-sm text-muted-foreground">
            Valeur totale : <strong className="text-foreground tabular">{formatMoney(total, currency)}</strong>
          </p>
        </>
      ) : null}
    </Shell>
  )
}

export function BulkDepositDialog({ rows, currency, onDone, onOpenChange }: DialogProps) {
  const { run, pending } = useServerAction()
  const [mode, setMode] = React.useState<"percent" | "fixed" | "none">("percent")
  const [value, setValue] = React.useState<number | null>(30)
  const [rounding, setRounding] = React.useState("100000")
  const editable = rows.filter((r) => r.status !== "SOLD")
  const compute = (r: AdminLotRow) => {
    if (mode === "none") return 0
    if (!value) return null
    const d = mode === "fixed" ? value : r.price ? roundTo((r.price * value) / 100, Number(rounding)) : null
    return d == null ? null : r.price != null ? Math.min(d, r.price) : d
  }

  return (
    <Shell
      title="Définir l'acompte"
      description={`${plural(editable.length)} concerné${editable.length > 1 ? "s" : ""}. Les terrains vendus ne sont pas modifiés.`}
      pending={pending}
      disabled={(mode !== "none" && !value) || editable.length === 0}
      onOpenChange={onOpenChange}
      onSubmit={() =>
        run(() => bulkSetDeposit(rows.map((r) => r.id), { mode, value: value ?? 0, rounding: Number(rounding) as 1000 }), {
          onSuccess: () => {
            onDone()
            onOpenChange(false)
          },
        })
      }
    >
      <Segmented
        value={mode}
        onChange={(m) => {
          setMode(m)
          if (m === "percent") setValue(30)
          if (m === "fixed") setValue(null)
        }}
        options={[
          { value: "percent", label: "% du prix" },
          { value: "fixed", label: "Montant fixe" },
          { value: "none", label: "Sans acompte" },
        ]}
      />
      {mode === "percent" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Pourcentage du prix" htmlFor="bulk-dep">
            <div className="relative">
              <Input
                id="bulk-dep"
                inputMode="decimal"
                className="h-9 pr-8 tabular"
                value={value ?? ""}
                onChange={(e) => setValue(e.target.value === "" ? null : Math.min(100, Number(e.target.value.replace(",", ".")) || 0))}
              />
              <span className="absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">%</span>
            </div>
          </FormField>
          <FormField label="Arrondi" htmlFor="bulk-dep-round">
            <Select value={rounding} onValueChange={setRounding}>
              <SelectTrigger id="bulk-dep-round" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROUNDINGS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
      )}
      {mode === "fixed" && (
        <FormField label="Montant de l'acompte" htmlFor="bulk-dep-fixed">
          <MoneyInput id="bulk-dep-fixed" value={value} onChange={setValue} suffix={currency} className="h-9" />
        </FormField>
      )}
      <Preview
        items={editable.slice(0, 30).map((r) => ({
          key: r.id,
          left: `N° ${r.number} · ${formatMoney(r.price, currency)}`,
          right: compute(r) == null ? "Prix manquant" : formatMoney(compute(r), currency),
        }))}
      />
    </Shell>
  )
}

export function BulkPlanDialog({ rows, currency, onDone, onOpenChange }: DialogProps) {
  const { run, pending } = useServerAction()
  const [count, setCount] = React.useState<number | null>(12)
  const [frequency, setFrequency] = React.useState<PaymentFrequency | null>("MONTHLY")
  const [customDays, setCustomDays] = React.useState<number | null>(null)
  const [forced, setForced] = React.useState<number | null>(null)
  const editable = rows.filter((r) => r.status !== "SOLD")
  const sample = editable.find((r) => r.price)
  const plan =
    sample && count != null && frequency
      ? resolvePlan({ price: sample.price, depositAmount: sample.depositAmount ?? 0, installmentsCount: count, frequency, customIntervalDays: customDays, installmentAmount: forced })
      : null

  return (
    <Shell
      title="Modalités de paiement"
      description={`Nombre de versements et périodicité pour ${plural(editable.length)}.`}
      pending={pending}
      disabled={count == null || !frequency || (frequency === "CUSTOM" && !customDays) || editable.length === 0}
      onOpenChange={onOpenChange}
      onSubmit={() =>
        run(
          () =>
            bulkSetPlan(
              rows.map((r) => r.id),
              { installmentsCount: count ?? 0, frequency: frequency ?? "MONTHLY", customIntervalDays: customDays, installmentAmount: forced },
            ),
          {
            onSuccess: () => {
              onDone()
              onOpenChange(false)
            },
          },
        )
      }
    >
      <PlanFields
        count={count}
        frequency={frequency}
        customDays={customDays}
        onChange={(p) => {
          if ("count" in p) setCount(p.count ?? null)
          if ("frequency" in p) setFrequency(p.frequency ?? null)
          if ("customDays" in p) setCustomDays(p.customDays ?? null)
        }}
      />
      <FormField label="Montant par versement (optionnel)" htmlFor="bulk-forced" hint="Laissez vide pour répartir automatiquement le solde ; sinon la dernière échéance absorbe l'écart.">
        <MoneyInput id="bulk-forced" value={forced} onChange={setForced} suffix={currency} className="h-9" placeholder="Calcul automatique" />
      </FormField>
      {plan && sample && (
        <div className="rounded-xl border bg-secondary/40 p-3 text-sm">
          <p className="text-xs text-muted-foreground">Exemple — terrain n° {sample.number}</p>
          <p className="mt-1 font-semibold">
            {plan.count > 0 ? `${plan.count} × ${formatMoney(plan.perInstallment, currency)} ${plan.per}` : "Paiement comptant"}
          </p>
          {plan.count > 0 && <p className="text-xs text-muted-foreground">Durée : {plan.duration} · après un acompte de {formatMoney(plan.deposit, currency)}</p>}
        </div>
      )}
    </Shell>
  )
}

export function BulkStatusDialog({ rows, onDone, onOpenChange }: DialogProps) {
  const { run, pending } = useServerAction()
  const [status, setStatus] = React.useState<"AVAILABLE" | "RESERVED" | "UNAVAILABLE">("AVAILABLE")
  const locked = rows.filter((r) => r.sale).length
  return (
    <Shell
      title="Changer le statut"
      description={
        locked
          ? `${locked} terrain${locked > 1 ? "s" : ""} attribué${locked > 1 ? "s" : ""} à un acheteur ne ser${locked > 1 ? "ont" : "a"} pas modifié${locked > 1 ? "s" : ""}.`
          : `Nouveau statut pour ${plural(rows.length)}.`
      }
      pending={pending}
      onOpenChange={onOpenChange}
      onSubmit={() =>
        run(() => bulkSetStatus(rows.map((r) => r.id), status), {
          onSuccess: () => {
            onDone()
            onOpenChange(false)
          },
        })
      }
    >
      <div className="grid gap-2">
        {(["AVAILABLE", "RESERVED", "UNAVAILABLE"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
              status === s ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50",
            )}
          >
            <span className="size-3.5 rounded-[4px]" style={{ background: LOT_STATUS[s].color }} />
            <span className="flex-1">
              <span className="block text-sm font-semibold">{LOT_STATUS[s].label}</span>
              <span className="text-xs text-muted-foreground">
                {s === "AVAILABLE" && "Visible et réservable sur le site"}
                {s === "RESERVED" && "Option posée : affiché comme pris sur le site"}
                {s === "UNAVAILABLE" && "Retiré de la vente (équipement, réserve foncière…)"}
              </span>
            </span>
          </button>
        ))}
      </div>
    </Shell>
  )
}

export function BulkSoilDialog({ rows, soilTypes, onDone, onOpenChange }: DialogProps) {
  const { run, pending } = useServerAction()
  const [value, setValue] = React.useState("")
  return (
    <Shell
      title="Type de sol"
      description={`Appliquer un type de sol à ${plural(rows.length)}.`}
      pending={pending}
      onOpenChange={onOpenChange}
      onSubmit={() =>
        run(() => bulkSetSoilType(rows.map((r) => r.id), value), {
          onSuccess: () => {
            onDone()
            onOpenChange(false)
          },
        })
      }
    >
      <FormField label="Type de sol" htmlFor="bulk-soil" hint="Laissez vide pour effacer.">
        <Input id="bulk-soil" list="bulk-soil-list" autoFocus className="h-9" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Ex. Sableux (dior)" />
        <Suggestions id="bulk-soil-list" values={soilTypes} />
      </FormField>
    </Shell>
  )
}

export function BulkDeleteDialog({ rows, onDone, onOpenChange }: DialogProps) {
  const { run, pending } = useServerAction()
  const locked = rows.filter((r) => r.sale).length
  return (
    <Shell
      title={`Supprimer ${plural(rows.length)} ?`}
      description={
        <>
          Cette action est définitive.
          {locked > 0 && ` ${locked} terrain${locked > 1 ? "s" : ""} avec un historique de vente ser${locked > 1 ? "ont" : "a"} conservé${locked > 1 ? "s" : ""}.`}
        </>
      }
      submitLabel="Supprimer"
      destructive
      pending={pending}
      onOpenChange={onOpenChange}
      onSubmit={() =>
        run(() => bulkDeleteLots(rows.map((r) => r.id)), {
          onSuccess: () => {
            onDone()
            onOpenChange(false)
          },
        })
      }
    >
      <Label className="sr-only">Confirmation</Label>
    </Shell>
  )
}

export const BULK_DIALOGS: Record<BulkKind, (props: DialogProps) => React.ReactNode> = {
  price: BulkPriceDialog,
  deposit: BulkDepositDialog,
  plan: BulkPlanDialog,
  status: BulkStatusDialog,
  soil: BulkSoilDialog,
  delete: BulkDeleteDialog,
}
