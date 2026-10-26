"use client"

import type { PaymentFrequency } from "@/generated/prisma/enums"
import { FREQUENCY, FREQUENCY_ORDER } from "@/lib/labels"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FormField, parseOptionalNumber } from "@/components/admin/settings/form-bits"

export function FrequencySelect({
  value,
  onChange,
  id,
  allowEmpty,
}: {
  value: PaymentFrequency | null
  onChange: (value: PaymentFrequency | null) => void
  id?: string
  allowEmpty?: string
}) {
  return (
    <Select value={value ?? "__none"} onValueChange={(v) => onChange(v === "__none" ? null : (v as PaymentFrequency))}>
      <SelectTrigger id={id} className="h-9 w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty && <SelectItem value="__none">{allowEmpty}</SelectItem>}
        {FREQUENCY_ORDER.map((f) => (
          <SelectItem key={f} value={f}>
            {FREQUENCY[f].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Nombre de versements, périodicité et intervalle personnalisé */
export function PlanFields({
  count,
  frequency,
  customDays,
  onChange,
  errors,
  allowEmpty,
}: {
  count: number | null
  frequency: PaymentFrequency | null
  customDays: number | null
  onChange: (patch: { count?: number | null; frequency?: PaymentFrequency | null; customDays?: number | null }) => void
  errors?: Record<string, string>
  allowEmpty?: string
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Nombre de versements" htmlFor="plan-count" hint="Après l'acompte. 0 = paiement comptant." error={errors?.installmentsCount}>
        <Input
          id="plan-count"
          inputMode="numeric"
          className="h-9 tabular"
          placeholder={allowEmpty ? "Par défaut" : "12"}
          value={count ?? ""}
          onChange={(e) => onChange({ count: parseOptionalNumber(e.target.value.replace(/\D/g, "")) })}
        />
      </FormField>
      <FormField label="Périodicité" htmlFor="plan-frequency" error={errors?.frequency}>
        <FrequencySelect id="plan-frequency" value={frequency} onChange={(f) => onChange({ frequency: f })} allowEmpty={allowEmpty} />
      </FormField>
      {frequency === "CUSTOM" && (
        <FormField label="Intervalle (jours)" htmlFor="plan-days" error={errors?.customIntervalDays} className="sm:col-span-2">
          <Input
            id="plan-days"
            inputMode="numeric"
            className="h-9 tabular"
            placeholder="45"
            value={customDays ?? ""}
            onChange={(e) => onChange({ customDays: parseOptionalNumber(e.target.value.replace(/\D/g, "")) })}
          />
        </FormField>
      )}
    </div>
  )
}
