import "server-only"
import { db } from "@/lib/db"
import { getBuyerSales } from "@/lib/queries/sales"

/** Ventes du propriétaire connecté (hors annulées), avec leur situation financière. */
export async function getOwnerSales(buyerId: string) {
  return getBuyerSales(buyerId)
}

export type OwnerSale = Awaited<ReturnType<typeof getOwnerSales>>[number]

/** Avancement global des travaux (moyenne des étapes) et étapes ordonnées. */
export async function getWorksProgress() {
  const milestones = await db.milestone.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] })
  const overall = milestones.length ? Math.round(milestones.reduce((sum, m) => sum + m.progress, 0) / milestones.length) : 0
  return {
    overall,
    milestones,
    done: milestones.filter((m) => m.status === "DONE").length,
    inProgress: milestones.filter((m) => m.status === "IN_PROGRESS").length,
  }
}

/** Actualités visibles par les propriétaires (publiques + réservées aux propriétaires). */
export async function getOwnerUpdates(limit?: number) {
  return db.siteUpdate.findMany({
    where: { visibility: { in: ["PUBLIC", "CLIENTS"] } },
    include: { media: { orderBy: { sortOrder: "asc" } }, milestone: { select: { title: true } } },
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
    take: limit,
  })
}

export type OwnerUpdate = Awaited<ReturnType<typeof getOwnerUpdates>>[number]

/** Documents accessibles : ceux de ses ventes + documents généraux publics ou réservés aux propriétaires. */
export async function getOwnerDocuments(buyerId: string) {
  const [own, general] = await Promise.all([
    db.document.findMany({
      where: { sale: { buyerId, status: { not: "CANCELLED" } } },
      include: { sale: { select: { reference: true, lot: { select: { number: true, block: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
    db.document.findMany({
      where: { saleId: null, visibility: { in: ["PUBLIC", "CLIENTS"] } },
      orderBy: [{ category: "asc" }, { createdAt: "desc" }],
    }),
  ])
  return { own, general }
}
