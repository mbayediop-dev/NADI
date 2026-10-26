import "server-only"
import { addDays, addMonths, differenceInCalendarDays, endOfMonth, format, isBefore, startOfDay, startOfMonth, subMonths } from "date-fns"
import { fr } from "date-fns/locale"
import type { LotStatus, PaymentMethod } from "@/generated/prisma/enums"
import { db } from "@/lib/db"
import { fullName } from "@/lib/format"
import { getSettings } from "@/lib/settings"
import { getAllSalesWithSummary } from "@/lib/queries/sales"

export type MonthPoint = { key: string; label: string; collected: number; expected: number }
export type ForecastPoint = { key: string; label: string; amount: number; count: number }
export type CumulativePoint = { key: string; label: string; lots: number; contracted: number }
export type MethodPoint = { method: PaymentMethod; amount: number; count: number; share: number }
export type AgingBucket = { key: string; label: string; amount: number; count: number }

const monthKey = (d: Date) => format(d, "yyyy-MM")
const monthLabel = (d: Date) => format(d, "MMM yy", { locale: fr }).replace(".", "")

/** Toutes les données du tableau de bord (à appeler dans un sous-arbre dynamique). */
export async function getDashboardData() {
  const now = new Date()
  const today = startOfDay(now)

  const [settings, sales, lots, requestGroups, buyersCount, recentRequests, recentPayments, activities] = await Promise.all([
    getSettings(),
    getAllSalesWithSummary(),
    db.lot.findMany({ select: { id: true, status: true, areaM2: true, price: true } }),
    db.reservationRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    db.buyer.count({ where: { sales: { some: { status: { not: "CANCELLED" } } } } }),
    db.reservationRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { lot: { select: { number: true, status: true } } },
    }),
    db.payment.findMany({
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      take: 6,
      include: { sale: { select: { id: true, lot: { select: { number: true } }, buyer: { select: { firstName: true, lastName: true } } } } },
    }),
    db.activity.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { actor: { select: { name: true } } } }),
  ])

  const live = sales.filter((s) => s.status !== "CANCELLED")
  const active = sales.filter((s) => s.status === "ACTIVE")
  const livePayments = live.flatMap((s) => s.payments)
  const cancelledCollected = sales.filter((s) => s.status === "CANCELLED").reduce((sum, s) => sum + s.summary.totalPaid, 0)

  // ── Finances ─────────────────────────────────────────────
  const contracted = live.reduce((sum, s) => sum + s.price, 0)
  const collected = livePayments.reduce((sum, p) => sum + p.amount, 0)
  const remaining = live.reduce((sum, s) => sum + s.summary.remaining, 0)
  const expectedToDate = live.reduce((sum, s) => sum + s.summary.expectedToDate, 0)
  const collectedOnExpected = live.reduce((sum, s) => sum + Math.min(s.summary.totalPaid, s.summary.expectedToDate), 0)
  const overdue = active.reduce((sum, s) => sum + s.summary.overdueAmount, 0)
  const lateSales = active.filter((s) => s.summary.overdueAmount > 0)

  const thisMonthStart = startOfMonth(now)
  const lastMonthStart = subMonths(thisMonthStart, 1)
  const collectedThisMonth = livePayments.filter((p) => p.paidAt >= thisMonthStart).reduce((s, p) => s + p.amount, 0)
  const collectedLastMonth = livePayments
    .filter((p) => p.paidAt >= lastMonthStart && p.paidAt < thisMonthStart)
    .reduce((s, p) => s + p.amount, 0)
  const expectedThisMonth = live
    .flatMap((s) => s.installments)
    .filter((i) => i.dueDate >= thisMonthStart && i.dueDate <= endOfMonth(now))
    .reduce((s, i) => s + i.amount, 0)

  // ── Terrains ─────────────────────────────────────────────
  const lotCounts: Record<LotStatus, number> = { AVAILABLE: 0, RESERVED: 0, SOLD: 0, UNAVAILABLE: 0 }
  const lotArea: Record<LotStatus, number> = { AVAILABLE: 0, RESERVED: 0, SOLD: 0, UNAVAILABLE: 0 }
  const lotValue: Record<LotStatus, number> = { AVAILABLE: 0, RESERVED: 0, SOLD: 0, UNAVAILABLE: 0 }
  for (const lot of lots) {
    lotCounts[lot.status]++
    lotArea[lot.status] += lot.areaM2
    lotValue[lot.status] += lot.price ?? 0
  }
  const sellable = lots.length - lotCounts.UNAVAILABLE
  const soldArea = live.reduce((sum, s) => sum + s.lot.areaM2, 0)
  const pricedAvailable = lots.filter((l) => l.status === "AVAILABLE" && l.price)
  const catalogueArea = pricedAvailable.reduce((s, l) => s + l.areaM2, 0)
  const avgPriceM2Sold = soldArea > 0 ? contracted / soldArea : null
  const avgPriceM2Catalogue = catalogueArea > 0 ? pricedAvailable.reduce((s, l) => s + (l.price ?? 0), 0) / catalogueArea : null

  // ── Demandes ─────────────────────────────────────────────
  const requestCount = Object.fromEntries(requestGroups.map((g) => [g.status, g._count._all])) as Record<string, number>
  const totalRequests = requestGroups.reduce((s, g) => s + g._count._all, 0)
  const pendingRequests = (requestCount.NEW ?? 0) + (requestCount.CONTACTED ?? 0) + (requestCount.ALTERNATIVE_PROPOSED ?? 0)
  const closedRequests = (requestCount.CONVERTED ?? 0) + (requestCount.DECLINED ?? 0)

  // ── Séries mensuelles (12 derniers mois) ─────────────────
  const firstMonth = startOfMonth(subMonths(now, 11))
  const months: MonthPoint[] = Array.from({ length: 12 }, (_, i) => {
    const d = addMonths(firstMonth, i)
    return { key: monthKey(d), label: monthLabel(d), collected: 0, expected: 0 }
  })
  const monthIndex = new Map(months.map((m, i) => [m.key, i]))
  for (const p of livePayments) {
    const i = monthIndex.get(monthKey(p.paidAt))
    if (i != null) months[i].collected += p.amount
  }
  for (const s of live) {
    for (const inst of s.installments) {
      const i = monthIndex.get(monthKey(inst.dueDate))
      if (i != null) months[i].expected += inst.amount
    }
  }

  // ── Prévision (12 prochains mois, reste dû sur échéances non échues) ──
  const forecast: ForecastPoint[] = Array.from({ length: 12 }, (_, i) => {
    const d = addMonths(thisMonthStart, i)
    return { key: monthKey(d), label: monthLabel(d), amount: 0, count: 0 }
  })
  const forecastIndex = new Map(forecast.map((m, i) => [m.key, i]))
  for (const s of active) {
    for (const row of s.summary.rows) {
      if (row.remaining <= 0 || isBefore(row.dueDate, today)) continue
      const i = forecastIndex.get(monthKey(row.dueDate))
      if (i != null) {
        forecast[i].amount += row.remaining
        forecast[i].count++
      }
    }
  }
  const forecastTotal = forecast.reduce((s, f) => s + f.amount, 0)

  // ── Ventes cumulées ──────────────────────────────────────
  const cumulative: CumulativePoint[] = []
  if (live.length > 0) {
    const first = startOfMonth(live.reduce((min, s) => (s.signedAt < min ? s.signedAt : min), live[0].signedAt))
    for (let d = first; d <= now; d = addMonths(d, 1)) {
      const end = endOfMonth(d)
      const upTo = live.filter((s) => s.signedAt <= end)
      cumulative.push({ key: monthKey(d), label: monthLabel(d), lots: upTo.length, contracted: upTo.reduce((sum, s) => sum + s.price, 0) })
    }
  }

  // ── Modes de paiement ────────────────────────────────────
  const methodMap = new Map<PaymentMethod, { amount: number; count: number }>()
  for (const p of livePayments) {
    const entry = methodMap.get(p.method) ?? { amount: 0, count: 0 }
    entry.amount += p.amount
    entry.count++
    methodMap.set(p.method, entry)
  }
  const methods: MethodPoint[] = [...methodMap.entries()]
    .map(([method, v]) => ({ method, ...v, share: collected > 0 ? v.amount / collected : 0 }))
    .sort((a, b) => b.amount - a.amount)

  // ── Balance âgée des retards ─────────────────────────────
  const aging: AgingBucket[] = [
    { key: "0-30", label: "1–30 j", amount: 0, count: 0 },
    { key: "31-60", label: "31–60 j", amount: 0, count: 0 },
    { key: "61-90", label: "61–90 j", amount: 0, count: 0 },
    { key: "90+", label: "+ 90 j", amount: 0, count: 0 },
  ]
  for (const s of active) {
    for (const row of s.summary.rows) {
      if (row.state !== "LATE") continue
      const days = differenceInCalendarDays(today, row.dueDate)
      const bucket = days <= 30 ? aging[0] : days <= 60 ? aging[1] : days <= 90 ? aging[2] : aging[3]
      bucket.amount += row.remaining
      bucket.count++
    }
  }

  // ── Listes ───────────────────────────────────────────────
  const horizon = addDays(today, 30)
  const upcoming = active
    .flatMap((s) =>
      s.summary.rows
        .filter((r) => r.remaining > 0 && r.dueDate >= today && r.dueDate <= horizon)
        .map((r) => ({
          saleId: s.id,
          reference: s.reference,
          buyerName: fullName(s.buyer),
          phone: s.buyer.phone,
          lotNumber: s.lot.number,
          label: r.label,
          dueDate: r.dueDate,
          amount: r.remaining,
          daysLeft: differenceInCalendarDays(r.dueDate, today),
        })),
    )
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())

  const late = lateSales
    .map((s) => ({
      saleId: s.id,
      reference: s.reference,
      buyerName: fullName(s.buyer),
      phone: s.buyer.phone,
      lotNumber: s.lot.number,
      overdueAmount: s.summary.overdueAmount,
      overdueCount: s.summary.overdueCount,
      daysLate: s.summary.daysLate,
    }))
    .sort((a, b) => b.overdueAmount - a.overdueAmount)

  return {
    now,
    currency: settings.currencyLabel,
    finance: {
      contracted,
      collected,
      cancelledCollected,
      remaining,
      expectedToDate,
      recoveryToDate: expectedToDate > 0 ? collectedOnExpected / expectedToDate : null,
      paidRatio: contracted > 0 ? collected / contracted : null,
      overdue,
      lateSalesCount: lateSales.length,
      activeSalesCount: active.length,
      completedSalesCount: sales.filter((s) => s.status === "COMPLETED").length,
      collectedThisMonth,
      collectedLastMonth,
      expectedThisMonth,
      monthDelta: collectedLastMonth > 0 ? (collectedThisMonth - collectedLastMonth) / collectedLastMonth : null,
      forecastTotal,
    },
    lots: {
      total: lots.length,
      sellable,
      counts: lotCounts,
      area: lotArea,
      soldArea,
      soldRatio: sellable > 0 ? lotCounts.SOLD / sellable : null,
      stockValue: lotValue.AVAILABLE,
      reservedValue: lotValue.RESERVED,
      avgPriceM2Sold,
      avgPriceM2Catalogue,
    },
    buyersCount,
    requests: {
      total: totalRequests,
      pending: pendingRequests,
      fresh: requestCount.NEW ?? 0,
      converted: requestCount.CONVERTED ?? 0,
      conversion: closedRequests > 0 ? (requestCount.CONVERTED ?? 0) / closedRequests : null,
    },
    series: { months, forecast, cumulative, methods, aging },
    lists: {
      upcoming,
      upcomingTotal: upcoming.reduce((s, u) => s + u.amount, 0),
      late,
      recentRequests,
      recentPayments,
      activities,
    },
  }
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>
