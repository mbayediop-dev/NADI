"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const fmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })

/** Saisie d'un montant entier avec séparateurs de milliers (1 500 000). */
export function MoneyInput({
  value,
  onChange,
  suffix = "FCFA",
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: number | null | undefined
  onChange: (value: number | null) => void
  suffix?: string
}) {
  const display = value == null || Number.isNaN(value) ? "" : fmt.format(value)
  return (
    <div className="relative">
      <Input
        {...props}
        inputMode="numeric"
        value={display}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d]/g, "")
          onChange(digits ? Number(digits) : null)
        }}
        className={cn("pr-16 tabular", className)}
      />
      {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted-foreground">{suffix}</span>}
    </div>
  )
}
