"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarRange } from "lucide-react"
import type { PaymentFrequency } from "@/generated/prisma/enums"
import { addPeriods, buildSchedule, durationLabel, frequencyPer, type ScheduleLine } from "@/lib/finance"
import { formatDate, formatMoney } from "@/lib/format"
import { FREQUENCY, FREQUENCY_ORDER } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { MoneyInput } from "@/components/shared/money-input"

export type PlanState = {
  price: number | null
  withDeposit: boolean
  depositAmount: number | null
  depositDueDate: string
  installmentsCount: number
  frequency: PaymentFrequency
  customIntervalDays: number | null
  firstDueDate: string
  fixedAmount: boolean
  installmentAmount: number | null
}

export const toInputDate = (d: Date) => format(d, "yyyy-MM-dd")

/** Date de 1re échéance par défaut : une période après la date de départ. */
export function defaultFirstDue(start: string, frequency: PaymentFrequency, customIntervalDays: number | null) {
  const base = new Date(`${start}T12:00:00`)
  return toInputDate(addPeriods(base, frequency, 1, customIntervalDays))
}

/** Données envoyées aux actions serveur */
export function planPayload(plan: PlanState) {
  return {
    price: plan.price ?? 0,
    withDeposit: plan.withDeposit,
    depositAmount: plan.withDeposit ? (plan.depositAmount ?? 0) : 0,
    depositDueDate: plan.depositDueDate,
    installmentsCount: plan.installmentsCount,
    frequency: plan.frequency,
    customIntervalDays: plan.frequency === "CUSTOM" ? plan.customIntervalDays : null,
    firstDueDate: plan.firstDueDate,
    installmentAmount: plan.fixedAmount ? plan.installmentAmount : null,
  }
}

export function usePlanSchedule(plan: PlanState): ScheduleLine[] {
  return React.useMemo(() => {
    if (!plan.price || plan.price <= 0 || !plan.firstDueDate || !plan.depositDueDate) return []
    const deposit = plan.withDeposit ? Math.min(plan.depositAmount ?? 0, plan.price) : 0
    return buildSchedule({
      price: plan.price,
      depositAmount: deposit,
      depositDueDate: new Date(`${plan.depositDueDate}T12:00:00`),
      installmentsCount: deposit >= plan.price ? 0 : Math.max(0, plan.installmentsCount),
      frequency: plan.frequency,
      customIntervalDays: plan.customIntervalDays,
      firstDueDate: new Date(`${plan.firstDueDate}T12:00:00`),
      installmentAmount: plan.fixedAmount ? plan.installmentAmount : null,
    })
  }, [plan])
}

/** Champs des modalités de paiement (prix, acompte, échéances). */
export function PlanFields({
  value,
  onChange,
  currency,
  errors = {},
  disabled,
}: {
  value: PlanState
  onChange: (next: PlanState) => void
  currency?: string
  errors?: Record<string, string>
  disabled?: boolean
}) {
  const set = <K extends keyof PlanState>(key: K, v: PlanState[K]) => onChange({ ...value, [key]: v })
  const balance = Math.max(0, (value.price ?? 0) - (value.withDeposit ? (value.depositAmount ?? 0) : 0))

  return (
    <div className="grid gap-5">
      <Field label="Prix de vente" error={errors["plan.price"]} hint="Modifiable en cas de prix négocié">
        <MoneyInput value={value.price} onChange={(v) => set("price", v)} suffix={currency} disabled={disabled} className="h-10 text-base font-semibold" />
      </Field>

      <div className="rounded-xl border bg-muted/30 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label htmlFor="with-deposit" className="text-sm font-semibold">
              Acompte à la signature
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">Désactivez pour une vente sans acompte : tout le prix est réparti en échéances.</p>
          </div>
          <Switch id="with-deposit" checked={value.withDeposit} onCheckedChange={(v) => set("withDeposit", v)} disabled={disabled} />
        </div>
        {value.withDeposit && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Montant de l'acompte" error={errors["plan.depositAmount"]}>
              <MoneyInput value={value.depositAmount} onChange={(v) => set("depositAmount", v)} suffix={currency} disabled={disabled} />
            </Field>
            <Field label="Date de l'acompte">
              <Input type="date" value={value.depositDueDate} onChange={(e) => set("depositDueDate", e.target.value)} disabled={disabled} />
            </Field>
            {value.price ? (
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Soit {Math.round(((value.depositAmount ?? 0) / value.price) * 100)} % du prix · solde à échelonner : {formatMoney(balance, currency)}
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre d'échéances" error={errors["plan.installmentsCount"]}>
          <Input
            type="number"
            min={0}
            max={600}
            inputMode="numeric"
            value={Number.isNaN(value.installmentsCount) ? "" : value.installmentsCount}
            onChange={(e) => set("installmentsCount", Math.max(0, Math.min(600, Math.floor(Number(e.target.value) || 0))))}
            disabled={disabled}
            className="tabular"
          />
        </Field>
        <Field label="Périodicité">
          <Select value={value.frequency} onValueChange={(v) => onChange({ ...value, frequency: v as PaymentFrequency })} disabled={disabled}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCY_ORDER.map((f) => (
                <SelectItem key={f} value={f}>
                  {FREQUENCY[f].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {value.frequency === "CUSTOM" && (
          <Field label="Intervalle (jours)" error={errors["plan.customIntervalDays"]}>
            <Input
              type="number"
              min={1}
              inputMode="numeric"
              value={value.customIntervalDays ?? ""}
              onChange={(e) => set("customIntervalDays", e.target.value ? Math.max(1, Math.floor(Number(e.target.value))) : null)}
              disabled={disabled}
            />
          </Field>
        )}
        <Field label="Première échéance">
          <Input type="date" value={value.firstDueDate} onChange={(e) => set("firstDueDate", e.target.value)} disabled={disabled} />
        </Field>
      </div>

      <div className="rounded-xl border p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label htmlFor="fixed-amount" className="text-sm font-semibold">
              Montant fixe par échéance
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">Sinon, le solde est réparti à parts égales (la dernière échéance absorbe l&apos;arrondi).</p>
          </div>
          <Switch id="fixed-amount" checked={value.fixedAmount} onCheckedChange={(v) => set("fixedAmount", v)} disabled={disabled} />
        </div>
        {value.fixedAmount && (
          <div className="mt-4 max-w-xs">
            <MoneyInput value={value.installmentAmount} onChange={(v) => set("installmentAmount", v)} suffix={currency} disabled={disabled} />
            <p className="mt-1.5 text-xs text-muted-foreground">Le nombre d&apos;échéances s&apos;ajuste si le solde est atteint plus tôt.</p>
          </div>
        )}
      </div>
    </div>
  )
}

/** Aperçu de l'échéancier généré */
export function SchedulePreview({ lines, currency, plan, className }: { lines: ScheduleLine[]; currency?: string; plan: PlanState; className?: string }) {
  if (lines.length === 0) {
    return (
      <div className={cn("flex flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground", className)}>
        <CalendarRange className="size-5" />
        Renseignez le prix et les modalités pour voir l&apos;échéancier.
      </div>
    )
  }
  const deposit = lines.find((l) => l.index === 0)
  const installments = lines.filter((l) => l.index > 0)
  const total = lines.reduce((s, l) => s + l.amount, 0)
  const last = lines[lines.length - 1]
  return (
    <div className={cn("space-y-3", className)}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Acompte</dt>
        <dd className="text-right font-semibold tabular">{deposit ? formatMoney(deposit.amount, currency) : "Aucun"}</dd>
        <dt className="text-muted-foreground">Échéances</dt>
        <dd className="text-right font-semibold tabular">
          {installments.length > 0 ? `${installments.length} × ${formatMoney(installments[0].amount, currency)}` : "—"}
        </dd>
        {installments.length > 1 && installments[installments.length - 1].amount !== installments[0].amount && (
          <>
            <dt className="text-muted-foreground">Dernière échéance</dt>
            <dd className="text-right tabular">{formatMoney(installments[installments.length - 1].amount, currency)}</dd>
          </>
        )}
        {installments.length > 0 && (
          <>
            <dt className="text-muted-foreground">Rythme</dt>
            <dd className="text-right">
              {frequencyPer(plan.frequency, plan.customIntervalDays)} · {durationLabel(installments.length, plan.frequency, plan.customIntervalDays)}
            </dd>
          </>
        )}
        <dt className="text-muted-foreground">Fin du paiement</dt>
        <dd className="text-right tabular">{formatDate(last.dueDate)}</dd>
      </dl>
      <div className="flex justify-between border-t pt-2 text-sm">
        <span className="font-semibold">Total</span>
        <span className="font-bold tabular">{formatMoney(total, currency)}</span>
      </div>
      <div className="max-h-64 overflow-y-auto rounded-lg border">
        <table className="w-full text-xs">
          <tbody className="divide-y">
            {lines.map((l) => (
              <tr key={l.index} className={cn(l.index === 0 && "bg-gold/10")}>
                <td className="px-3 py-1.5 font-medium">{l.label}</td>
                <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground tabular">{formatDate(l.dueDate)}</td>
                <td className="px-3 py-1.5 text-right font-medium whitespace-nowrap tabular">{formatMoney(l.amount, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function Field({
  label,
  error,
  hint,
  children,
  className,
}: {
  label: string
  error?: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label className="text-sm">{label}</Label>
      {children}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
