// Calculs financiers : modalités de paiement, échéanciers, situation d'une vente.
// Module pur (sans accès BD), utilisable côté serveur et client.
import { addDays, addMonths, addWeeks, differenceInCalendarDays, startOfDay } from "date-fns"
import type { PaymentFrequency, SaleStatus } from "@/generated/prisma/enums"
import { FREQUENCY } from "@/lib/labels"

/** Les dates d'échéance sont stockées à midi UTC pour éviter tout décalage de fuseau. */
export function toDueDate(value: Date | string) {
  const d = new Date(value)
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12))
}

export function addPeriods(date: Date, frequency: PaymentFrequency, count: number, customIntervalDays?: number | null) {
  switch (frequency) {
    case "WEEKLY":
      return addWeeks(date, count)
    case "BIWEEKLY":
      return addWeeks(date, 2 * count)
    case "MONTHLY":
      return addMonths(date, count)
    case "BIMONTHLY":
      return addMonths(date, 2 * count)
    case "QUARTERLY":
      return addMonths(date, 3 * count)
    case "SEMIANNUAL":
      return addMonths(date, 6 * count)
    case "ANNUAL":
      return addMonths(date, 12 * count)
    case "CUSTOM":
      return addDays(date, (customIntervalDays || 30) * count)
  }
}

const MONTHS_PER_PERIOD: Partial<Record<PaymentFrequency, number>> = {
  MONTHLY: 1,
  BIMONTHLY: 2,
  QUARTERLY: 3,
  SEMIANNUAL: 6,
  ANNUAL: 12,
}

/** « 12 mois », « 2 ans », « 26 semaines »… */
export function durationLabel(count: number, frequency: PaymentFrequency, customIntervalDays?: number | null) {
  if (count <= 0) return "—"
  const months = MONTHS_PER_PERIOD[frequency]
  if (months) {
    const total = months * count
    if (total >= 12 && total % 12 === 0) return `${total / 12} an${total / 12 > 1 ? "s" : ""}`
    return `${total} mois`
  }
  if (frequency === "WEEKLY") return `${count} semaine${count > 1 ? "s" : ""}`
  if (frequency === "BIWEEKLY") return `${count * 2} semaines`
  const days = (customIntervalDays || 30) * count
  return `${days} jours`
}

export function frequencyPer(frequency: PaymentFrequency, customIntervalDays?: number | null) {
  if (frequency === "CUSTOM") return `tous les ${customIntervalDays || 30} jours`
  return FREQUENCY[frequency].per
}

/** Répartit un montant en n échéances arrondies à la centaine, la dernière absorbant l'écart. */
export function splitAmount(total: number, count: number, forcedAmount?: number | null): number[] {
  if (count <= 0 || total <= 0) return []
  if (forcedAmount && forcedAmount > 0) {
    const amounts: number[] = []
    let rest = Math.round(total)
    for (let i = 0; i < count && rest > 0; i++) {
      const amount = i === count - 1 ? rest : Math.min(Math.round(forcedAmount), rest)
      amounts.push(amount)
      rest -= amount
    }
    return amounts
  }
  const base = Math.floor(total / count / 100) * 100 || Math.floor(total / count)
  const amounts = Array.from({ length: count }, () => base)
  amounts[count - 1] = Math.round(total - base * (count - 1))
  return amounts
}

// ─────────────────────────────────────────────────────────────
// Modalités proposées pour un terrain
// ─────────────────────────────────────────────────────────────

export type PlanSource = {
  price: number | null
  depositAmount: number | null
  installmentsCount: number | null
  frequency: PaymentFrequency | null
  customIntervalDays?: number | null
  installmentAmount?: number | null
}

export type PlanDefaults = {
  defaultDepositRate: number
  defaultInstallments: number
  defaultFrequency: PaymentFrequency
}

export type PaymentPlan = {
  price: number
  deposit: number
  balance: number
  count: number
  frequency: PaymentFrequency
  customIntervalDays: number | null
  perInstallment: number
  lastInstallment: number
  duration: string
  per: string
}

/** Modalités effectives d'un terrain (valeurs du terrain, sinon valeurs par défaut des paramètres). */
export function resolvePlan(lot: PlanSource, defaults?: PlanDefaults): PaymentPlan | null {
  if (!lot.price || lot.price <= 0) return null
  const price = Math.round(lot.price)
  const deposit = Math.round(
    lot.depositAmount ?? (defaults ? Math.round((price * defaults.defaultDepositRate) / 100 / 1000) * 1000 : 0),
  )
  const count = lot.installmentsCount ?? defaults?.defaultInstallments ?? 0
  const frequency = lot.frequency ?? defaults?.defaultFrequency ?? "MONTHLY"
  const balance = Math.max(0, price - deposit)
  const amounts = splitAmount(balance, count, lot.installmentAmount)
  return {
    price,
    deposit,
    balance,
    count: amounts.length,
    frequency,
    customIntervalDays: lot.customIntervalDays ?? null,
    perInstallment: amounts[0] ?? 0,
    lastInstallment: amounts[amounts.length - 1] ?? 0,
    duration: durationLabel(amounts.length, frequency, lot.customIntervalDays),
    per: frequencyPer(frequency, lot.customIntervalDays),
  }
}

// ─────────────────────────────────────────────────────────────
// Échéancier d'une vente
// ─────────────────────────────────────────────────────────────

export type ScheduleInput = {
  price: number
  depositAmount: number
  depositDueDate: Date
  installmentsCount: number
  frequency: PaymentFrequency
  customIntervalDays?: number | null
  firstDueDate: Date
  installmentAmount?: number | null
}

export type ScheduleLine = { index: number; label: string; dueDate: Date; amount: number }

export function buildSchedule(input: ScheduleInput): ScheduleLine[] {
  const lines: ScheduleLine[] = []
  const price = Math.round(input.price)
  const deposit = Math.min(Math.round(input.depositAmount || 0), price)
  if (deposit > 0) {
    lines.push({ index: 0, label: "Acompte", dueDate: toDueDate(input.depositDueDate), amount: deposit })
  }
  const amounts = splitAmount(price - deposit, input.installmentsCount, input.installmentAmount)
  amounts.forEach((amount, i) => {
    lines.push({
      index: i + 1,
      label: `Échéance ${i + 1}/${amounts.length}`,
      dueDate: toDueDate(addPeriods(input.firstDueDate, input.frequency, i, input.customIntervalDays)),
      amount,
    })
  })
  return lines
}

// ─────────────────────────────────────────────────────────────
// Situation d'une vente (paiements imputés dans l'ordre des échéances)
// ─────────────────────────────────────────────────────────────

export type InstallmentState = "PAID" | "PARTIAL" | "LATE" | "DUE_SOON" | "UPCOMING"

export type SaleLike = {
  price: number
  status: SaleStatus
  installments: { id?: string; index: number; label: string; dueDate: Date | string; amount: number }[]
  payments: { amount: number; paidAt: Date | string }[]
}

export type ScheduleRow = {
  id?: string
  index: number
  label: string
  dueDate: Date
  amount: number
  paid: number
  remaining: number
  state: InstallmentState
}

export type SaleSummary = {
  price: number
  totalPaid: number
  remaining: number
  progress: number
  overdueAmount: number
  overdueCount: number
  daysLate: number
  paidCount: number
  totalCount: number
  nextDue: ScheduleRow | null
  rows: ScheduleRow[]
  lastPaymentAt: Date | null
  isSettled: boolean
  /** Montant attendu à aujourd'hui (cumul des échéances échues) */
  expectedToDate: number
}

const DUE_SOON_DAYS = 7

export function summarizeSale(sale: SaleLike, now: Date = new Date()): SaleSummary {
  const today = startOfDay(now)
  const price = Math.round(sale.price)
  const totalPaid = sale.payments.reduce((sum, p) => sum + p.amount, 0)
  const sorted = [...sale.installments].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime() || a.index - b.index,
  )

  let pool = totalPaid
  let overdueAmount = 0
  let overdueCount = 0
  let oldestLate: Date | null = null
  let expectedToDate = 0

  const rows: ScheduleRow[] = sorted.map((line) => {
    const dueDate = new Date(line.dueDate)
    const paid = Math.max(0, Math.min(line.amount, pool))
    pool -= paid
    const remaining = Math.round(line.amount - paid)
    const isPast = startOfDay(dueDate) < today
    if (startOfDay(dueDate) <= today) expectedToDate += line.amount
    let state: InstallmentState
    if (remaining <= 0) state = "PAID"
    else if (isPast) {
      state = "LATE"
      overdueAmount += remaining
      overdueCount += 1
      if (!oldestLate) oldestLate = dueDate
    } else if (paid > 0) state = "PARTIAL"
    else if (differenceInCalendarDays(dueDate, today) <= DUE_SOON_DAYS) state = "DUE_SOON"
    else state = "UPCOMING"
    return { id: line.id, index: line.index, label: line.label, dueDate, amount: line.amount, paid, remaining, state }
  })

  const lastPayment = sale.payments.reduce<Date | null>((latest, p) => {
    const d = new Date(p.paidAt)
    return !latest || d > latest ? d : latest
  }, null)

  const remaining = Math.max(0, price - totalPaid)
  const active = sale.status === "ACTIVE"

  return {
    price,
    totalPaid,
    remaining,
    progress: price > 0 ? Math.min(1, totalPaid / price) : 0,
    overdueAmount: active ? overdueAmount : 0,
    overdueCount: active ? overdueCount : 0,
    daysLate: active && oldestLate ? differenceInCalendarDays(today, oldestLate) : 0,
    paidCount: rows.filter((r) => r.state === "PAID").length,
    totalCount: rows.length,
    nextDue: active ? (rows.find((r) => r.remaining > 0) ?? null) : null,
    rows,
    lastPaymentAt: lastPayment,
    isSettled: remaining <= 0,
    expectedToDate,
  }
}

/** Montant restant à encaisser sur une période donnée (prévisionnel) */
export function expectedBetween(summary: SaleSummary, from: Date, to: Date) {
  return summary.rows
    .filter((r) => r.remaining > 0 && r.dueDate >= from && r.dueDate < to)
    .reduce((sum, r) => sum + r.remaining, 0)
}
