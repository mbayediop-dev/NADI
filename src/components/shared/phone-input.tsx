"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const COUNTRIES = [
  { code: "SN", dial: "+221", flag: "🇸🇳", placeholder: "77 123 45 67" },
  { code: "FR", dial: "+33", flag: "🇫🇷", placeholder: "6 12 34 56 78" },
  { code: "CI", dial: "+225", flag: "🇨🇮", placeholder: "07 12 34 56 78" },
  { code: "ML", dial: "+223", flag: "🇲🇱", placeholder: "65 12 34 56" },
  { code: "GN", dial: "+224", flag: "🇬🇳", placeholder: "621 12 34 56" },
  { code: "MR", dial: "+222", flag: "🇲🇷", placeholder: "22 12 34 56" },
  { code: "GM", dial: "+220", flag: "🇬🇲", placeholder: "301 2345" },
  { code: "MA", dial: "+212", flag: "🇲🇦", placeholder: "6 12 34 56 78" },
  { code: "BE", dial: "+32", flag: "🇧🇪", placeholder: "470 12 34 56" },
  { code: "IT", dial: "+39", flag: "🇮🇹", placeholder: "312 345 6789" },
  { code: "ES", dial: "+34", flag: "🇪🇸", placeholder: "612 34 56 78" },
  { code: "US", dial: "+1", flag: "🇺🇸", placeholder: "201 555 0123" },
  { code: "CA", dial: "+1", flag: "🇨🇦", placeholder: "514 555 0123" },
]

function split(value: string) {
  if (value.startsWith("+")) {
    const match = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length).find((c) => value.startsWith(c.dial))
    if (match) return { country: match.code, local: value.slice(match.dial.length).trim() }
  }
  return { country: "SN", local: value }
}

/**
 * Saisie d'un numéro de téléphone avec indicatif pays.
 * La valeur émise est « +221771234567 » (la validation finale se fait côté serveur).
 */
export function PhoneInput({
  value,
  onChange,
  className,
  id,
  autoFocus,
  disabled,
  size = "default",
}: {
  value: string
  onChange: (value: string) => void
  className?: string
  id?: string
  autoFocus?: boolean
  disabled?: boolean
  size?: "default" | "lg"
}) {
  const initial = React.useMemo(() => split(value), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [country, setCountry] = React.useState(initial.country)
  const [local, setLocal] = React.useState(initial.local)
  const current = COUNTRIES.find((c) => c.code === country) ?? COUNTRIES[0]

  function emit(nextCountry: string, nextLocal: string) {
    const dial = COUNTRIES.find((c) => c.code === nextCountry)?.dial ?? "+221"
    let digits = nextLocal.replace(/[^\d+]/g, "")
    // « 00 33 6… » = format international saisi sans le « + »
    if (digits.startsWith("00")) digits = `+${digits.slice(2)}`
    onChange(digits.startsWith("+") ? digits : digits ? `${dial}${digits.replace(/^0+(?=\d{8,})/, "")}` : "")
  }

  return (
    <div
      className={cn(
        "flex w-full items-stretch overflow-hidden rounded-lg border border-input bg-transparent shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
        size === "lg" ? "h-12 text-base" : "h-10 text-sm",
        disabled && "opacity-50",
        className,
      )}
    >
      <label className="relative flex items-center gap-1 border-r bg-muted/50 pr-2 pl-3 text-sm font-medium">
        <span aria-hidden>{current.flag}</span>
        <span className="tabular">{current.dial}</span>
        <select
          aria-label="Indicatif pays"
          value={country}
          disabled={disabled}
          onChange={(e) => {
            setCountry(e.target.value)
            emit(e.target.value, local)
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.dial} ({c.code})
            </option>
          ))}
        </select>
      </label>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={current.placeholder}
        value={local}
        onChange={(e) => {
          setLocal(e.target.value)
          emit(country, e.target.value)
        }}
        className="min-w-0 flex-1 bg-transparent px-3 tabular outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}
