// Formatage (montants, surfaces, dates) — utilisable côté serveur et client
import { format, formatDistanceToNowStrict } from "date-fns"
import { fr } from "date-fns/locale"

const numberFmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })
const decimalFmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 })
const compactFmt = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 })
const percentFmt = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 })

export const DEFAULT_CURRENCY = "FCFA"

export function formatNumber(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—"
  return numberFmt.format(value)
}

export function formatDecimal(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—"
  return decimalFmt.format(value)
}

export function formatMoney(value: number | null | undefined, currency = DEFAULT_CURRENCY) {
  if (value == null || Number.isNaN(value)) return "—"
  return `${numberFmt.format(Math.round(value))} ${currency}`
}

/** 12,5 M FCFA — pour les KPI et graphiques */
export function formatMoneyCompact(value: number | null | undefined, currency = DEFAULT_CURRENCY) {
  if (value == null || Number.isNaN(value)) return "—"
  return `${compactFmt.format(value)} ${currency}`
}

export function formatCompact(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—"
  return compactFmt.format(value)
}

export function formatArea(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—"
  return `${decimalFmt.format(value)} m²`
}

export function formatHectares(m2: number) {
  return `${decimalFmt.format(m2 / 10000)} ha`
}

export function formatPercent(ratio: number | null | undefined) {
  if (ratio == null || Number.isNaN(ratio) || !Number.isFinite(ratio)) return "—"
  return percentFmt.format(ratio)
}

export function formatDate(value: Date | string | null | undefined, pattern = "d MMM yyyy") {
  if (!value) return "—"
  return format(new Date(value), pattern, { locale: fr })
}

export function formatDateLong(value: Date | string | null | undefined) {
  return formatDate(value, "d MMMM yyyy")
}

export function formatDateTime(value: Date | string | null | undefined) {
  return formatDate(value, "d MMM yyyy 'à' HH:mm")
}

export function formatMonth(value: Date | string) {
  return format(new Date(value), "MMM yy", { locale: fr })
}

export function formatRelative(value: Date | string | null | undefined) {
  if (!value) return "—"
  return `il y a ${formatDistanceToNowStrict(new Date(value), { locale: fr })}`
}

export function fullName(person: { firstName: string; lastName: string }) {
  return `${person.firstName} ${person.lastName}`.trim()
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

/** Tri naturel des numéros de terrain : 2 < 10, A-2 < A-10 */
export function compareLotNumbers(a: string, b: string) {
  return a.localeCompare(b, "fr", { numeric: true, sensitivity: "base" })
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${formatNumber(count)} ${count > 1 ? plural : singular}`
}
