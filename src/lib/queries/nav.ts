import "server-only"
import { db } from "@/lib/db"
import type { NavCounts } from "@/components/admin/nav-config"

/** Compteurs affichés dans la navigation : nouvelles demandes, ventes en retard, demandes de construction à étudier. */
export async function getNavCounts(): Promise<NavCounts> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [newRequests, newConstruction, sales] = await Promise.all([
    db.reservationRequest.count({ where: { status: "NEW" } }),
    db.constructionProject.count({ where: { status: "REQUESTED" } }),
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
  return { newRequests, lateSales, newConstruction }
}
