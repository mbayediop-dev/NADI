import "server-only"
import { db } from "@/lib/db"
import { summarizeSale } from "@/lib/finance"

const saleInclude = {
  lot: true,
  buyer: true,
  installments: { orderBy: { index: "asc" as const } },
  payments: { orderBy: { paidAt: "desc" as const }, include: { recordedBy: { select: { name: true } } } },
  documents: { orderBy: { createdAt: "desc" as const } },
}

/** Vente complète avec sa situation financière calculée. */
export async function getSaleDetail(id: string) {
  const sale = await db.sale.findUnique({ where: { id }, include: saleInclude })
  if (!sale) return null
  return { ...sale, summary: summarizeSale(sale) }
}

export type SaleDetail = NonNullable<Awaited<ReturnType<typeof getSaleDetail>>>

/** Ventes d'un acheteur (hors annulées par défaut) avec leur situation. */
export async function getBuyerSales(buyerId: string, opts: { includeCancelled?: boolean } = {}) {
  const sales = await db.sale.findMany({
    where: { buyerId, ...(opts.includeCancelled ? {} : { status: { not: "CANCELLED" } }) },
    include: saleInclude,
    orderBy: { signedAt: "asc" },
  })
  return sales.map((sale) => ({ ...sale, summary: summarizeSale(sale) }))
}

/** Toutes les ventes (légères) avec leur situation — base des statistiques. */
export async function getAllSalesWithSummary() {
  const sales = await db.sale.findMany({
    include: {
      lot: { select: { id: true, number: true, block: true, areaM2: true } },
      buyer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      installments: { select: { id: true, index: true, label: true, dueDate: true, amount: true } },
      payments: { select: { id: true, amount: true, paidAt: true, method: true } },
    },
    orderBy: { signedAt: "desc" },
  })
  return sales.map((sale) => ({ ...sale, summary: summarizeSale(sale) }))
}
