import "server-only"
import { db } from "@/lib/db"
import type { NavCounts } from "@/components/admin/nav-config"

/** Compteurs affichés dans la navigation : nouvelles demandes et ventes en retard. */
export async function getNavCounts(): Promise<NavCounts> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [newRequests, sales] = await Promise.all([
    db.reservationRequest.count({ where: { status: "NEW" } }),
    db.sale.findMany({
      where: { status: "ACTIVE" },
      select: {
        installments: { where: { dueDate: { lt: today } }, select: { amount: true } },
        payments: { select: { amount: true } },
      },
    }),
  ])
  const lateSales = sales.filter((s) => {
    const due = s.installments.reduce((sum, i) => sum + i.amount, 0)
    const paid = s.payments.reduce((sum, p) => sum + p.amount, 0)
    return due - paid > 0.5
  }).length
  return { newRequests, lateSales }
}
