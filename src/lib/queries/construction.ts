import "server-only"
import { z } from "zod"
import { db } from "@/lib/db"
import { parseQuoteItems, summarizeProject } from "@/lib/construction"
import { compareLotNumbers, fullName } from "@/lib/format"
import type { AppSettings } from "@/lib/settings"
import { signatureUrl } from "@/lib/signature"
import type { ReceiptData } from "@/components/shared/receipt"

const imagesSchema = z.array(z.string().min(1)).catch([])

/** Images d'un modèle de maison lues depuis la base (JSON). */
export function modelImages(value: unknown) {
  return imagesSchema.parse(value)
}

// ─────────────────────────────────────────────────────────────
// Modèles de maisons (plans proposés)
// ─────────────────────────────────────────────────────────────

export async function getHouseModels(opts: { publishedOnly?: boolean } = {}) {
  const models = await db.houseModel.findMany({
    where: opts.publishedOnly ? { published: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { projects: true } } },
  })
  return models.map((m) => ({ ...m, images: modelImages(m.images) }))
}

export type HouseModelRow = Awaited<ReturnType<typeof getHouseModels>>[number]

// ─────────────────────────────────────────────────────────────
// Administration
// ─────────────────────────────────────────────────────────────

/** Tous les projets (légers) avec leur situation — liste et statistiques. */
export async function getProjects() {
  const projects = await db.constructionProject.findMany({
    include: {
      buyer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      lot: { select: { id: true, number: true, block: true } },
      houseModel: { select: { name: true } },
      installments: { select: { id: true, index: true, label: true, dueDate: true, amount: true } },
      payments: { select: { amount: true, paidAt: true } },
      expenses: { select: { amount: true, category: true } },
      phases: { select: { progress: true, weight: true } },
    },
    orderBy: { createdAt: "desc" },
  })
  return projects.map((p) => ({ ...p, summary: summarizeProject(p) }))
}

/** Projet complet : chaque volet est lu en parallèle (base distante : un seul aller-retour par volet). */
export async function getProjectDetail(id: string) {
  const project = await db.constructionProject.findUnique({
    where: { id },
    include: {
      buyer: true,
      lot: { select: { id: true, number: true, block: true, areaM2: true } },
      houseModel: { select: { id: true, name: true, images: true, levels: true, bedrooms: true, livingAreaM2: true } },
    },
  })
  if (!project) return null
  const where = { projectId: id }
  const [quotes, phases, installments, payments, expenses, updates, documents] = await Promise.all([
    db.constructionQuote.findMany({ where, orderBy: { createdAt: "desc" } }),
    db.constructionPhase.findMany({ where, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.constructionInstallment.findMany({ where, orderBy: { index: "asc" } }),
    db.constructionPayment.findMany({ where, orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }], include: { recordedBy: { select: { name: true } } } }),
    db.expense.findMany({ where, orderBy: [{ spentAt: "desc" }, { createdAt: "desc" }], include: { phase: { select: { title: true } } } }),
    db.constructionUpdate.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      include: { media: { orderBy: { sortOrder: "asc" } }, phase: { select: { title: true } } },
    }),
    db.document.findMany({ where: { constructionProjectId: id }, orderBy: { createdAt: "desc" } }),
  ])
  return {
    ...project,
    houseModel: project.houseModel ? { ...project.houseModel, images: modelImages(project.houseModel.images) } : null,
    quotes: quotes.map((q) => ({ ...q, items: parseQuoteItems(q.items) })),
    phases,
    installments,
    payments,
    expenses,
    updates,
    documents,
    summary: summarizeProject({ ...project, installments, payments, expenses, phases }),
  }
}

export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof getProjectDetail>>>

/** Listes de choix du formulaire de projet : clients, terrains du lotissement (avec leur propriétaire), modèles. */
export async function getProjectFormOptions() {
  const [buyers, lots, models] = await Promise.all([
    db.buyer.findMany({ select: { id: true, firstName: true, lastName: true, phone: true } }),
    db.lot.findMany({
      select: {
        id: true,
        number: true,
        block: true,
        areaM2: true,
        sales: { where: { status: { not: "CANCELLED" } }, select: { buyer: { select: { id: true, firstName: true, lastName: true } } }, take: 1 },
      },
    }),
    db.houseModel.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, levels: true, bedrooms: true } }),
  ])
  return {
    buyers: buyers.map((b) => ({ id: b.id, name: fullName(b), phone: b.phone })).sort((a, b) => a.name.localeCompare(b.name, "fr")),
    lots: lots
      .map((l) => ({
        id: l.id,
        number: l.number,
        block: l.block,
        areaM2: l.areaM2,
        owner: l.sales[0] ? fullName(l.sales[0].buyer) : null,
        ownerId: l.sales[0]?.buyer.id ?? null,
      }))
      .sort((a, b) => compareLotNumbers(a.number, b.number)),
    models: models.map((m) => ({
      id: m.id,
      name: m.name,
      detail: [m.levels, m.bedrooms ? `${m.bedrooms} chambre${m.bedrooms > 1 ? "s" : ""}` : null].filter(Boolean).join(" · "),
    })),
  }
}

/** Toutes les dépenses (lotissement et chantiers), les plus récentes d'abord. */
export async function getExpenses() {
  return db.expense.findMany({
    include: {
      project: { select: { id: true, reference: true, title: true, contactName: true } },
      phase: { select: { title: true } },
      recordedBy: { select: { name: true } },
    },
    orderBy: [{ spentAt: "desc" }, { createdAt: "desc" }],
  })
}

// ─────────────────────────────────────────────────────────────
// Espace client
// ─────────────────────────────────────────────────────────────

/** Projets de construction du client connecté (hors abandonnés), avec leur situation. */
export async function getBuyerProjects(buyerId: string) {
  const projects = await db.constructionProject.findMany({
    where: { buyerId, status: { not: "CANCELLED" } },
    include: {
      lot: { select: { number: true, block: true } },
      houseModel: { select: { name: true, images: true } },
      installments: { select: { id: true, index: true, label: true, dueDate: true, amount: true } },
      payments: { select: { amount: true, paidAt: true } },
      phases: { select: { progress: true, weight: true } },
      // Dernière photo de chantier visible : sert d'image de couverture
      updates: {
        where: { visibleToClient: true, media: { some: { type: "IMAGE" } } },
        orderBy: { publishedAt: "desc" },
        take: 1,
        select: { media: { where: { type: "IMAGE" }, orderBy: { sortOrder: "asc" }, take: 1, select: { id: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  })
  return projects.map(({ updates, ...p }) => ({
    ...p,
    houseModel: p.houseModel ? { name: p.houseModel.name, images: modelImages(p.houseModel.images) } : null,
    /** Photo de chantier (fichier privé, à afficher avec <img>) */
    coverMediaId: updates[0]?.media[0]?.id ?? null,
    summary: summarizeProject({ ...p, expenses: [] }),
  }))
}

/**
 * Projet vu par son client : uniquement ce qui lui est destiné (offres envoyées, dépenses et journal visibles,
 * documents non internes). Renvoie null si le projet n'appartient pas à ce client.
 */
export async function getBuyerProject(buyerId: string, id: string) {
  const project = await db.constructionProject.findFirst({
    where: { id, buyerId },
    include: {
      lot: { select: { number: true, block: true, areaM2: true } },
      houseModel: { select: { name: true, images: true, levels: true, bedrooms: true, bathrooms: true, livingAreaM2: true } },
    },
  })
  if (!project) return null
  const where = { projectId: id }
  const [quotes, phases, installments, payments, expenses, updates, documents] = await Promise.all([
    db.constructionQuote.findMany({ where: { ...where, status: { not: "DRAFT" } }, orderBy: { createdAt: "desc" } }),
    db.constructionPhase.findMany({ where, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.constructionInstallment.findMany({ where, orderBy: { index: "asc" } }),
    db.constructionPayment.findMany({ where, orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }] }),
    project.showExpensesToClient
      ? db.expense.findMany({ where: { ...where, visibleToClient: true }, orderBy: [{ spentAt: "desc" }, { createdAt: "desc" }], include: { phase: { select: { title: true } } } })
      : Promise.resolve([]),
    db.constructionUpdate.findMany({
      where: { ...where, visibleToClient: true },
      orderBy: { publishedAt: "desc" },
      include: { media: { orderBy: { sortOrder: "asc" } }, phase: { select: { title: true } } },
    }),
    db.document.findMany({ where: { constructionProjectId: id, visibility: { not: "PRIVATE" } }, orderBy: { createdAt: "desc" } }),
  ])
  // Les notes internes ne quittent pas le serveur
  const { notes: _notes, ...visible } = project
  void _notes
  return {
    ...visible,
    houseModel: project.houseModel ? { ...project.houseModel, images: modelImages(project.houseModel.images) } : null,
    quotes: quotes.map((q) => ({ ...q, items: parseQuoteItems(q.items) })),
    phases,
    installments,
    payments,
    expenses,
    updates,
    documents,
    summary: summarizeProject({ ...project, installments, payments, expenses, phases }),
  }
}

export type BuyerProject = NonNullable<Awaited<ReturnType<typeof getBuyerProject>>>

// ─────────────────────────────────────────────────────────────
// Reçu d'un versement de construction
// ─────────────────────────────────────────────────────────────

/** Données du reçu. `buyerId` restreint l'accès au client concerné (espace client). */
export async function getConstructionReceiptData(paymentId: string, settings: AppSettings, opts: { buyerId?: string } = {}): Promise<(ReceiptData & { projectId: string }) | null> {
  const payment = await db.constructionPayment.findUnique({
    where: { id: paymentId },
    include: {
      project: {
        include: {
          buyer: true,
          installments: { select: { amount: true } },
          payments: { select: { id: true, amount: true, paidAt: true, createdAt: true } },
        },
      },
    },
  })
  if (!payment) return null
  const { project } = payment
  if (opts.buyerId && project.buyerId !== opts.buyerId) return null
  const paidToDate = project.payments
    .filter((p) => p.paidAt < payment.paidAt || (p.paidAt.getTime() === payment.paidAt.getTime() && p.createdAt <= payment.createdAt))
    .reduce((sum, p) => sum + p.amount, 0)
  const contract = Math.round(project.contractAmount ?? project.installments.reduce((sum, i) => sum + i.amount, 0))
  return {
    projectId: project.id,
    company: {
      name: settings.companyName,
      address: settings.companyAddress,
      phone: settings.companyPhone,
      email: settings.companyEmail,
      signatureUrl: settings.signatureKey ? signatureUrl(settings.signatureKey) : null,
    },
    currency: settings.currencyLabel,
    payment: {
      receiptNumber: payment.receiptNumber,
      amount: payment.amount,
      paidAt: payment.paidAt,
      method: payment.method,
      reference: payment.reference,
      note: payment.note,
    },
    sale: { reference: project.reference, price: Math.max(contract, paidToDate) },
    subject: { title: project.title, detail: `Construction · Projet ${project.reference}`, totalLabel: "Montant du contrat" },
    buyer: { name: project.buyer ? fullName(project.buyer) : project.contactName, phone: project.buyer?.phone ?? project.contactPhone },
    paidToDate,
  }
}
