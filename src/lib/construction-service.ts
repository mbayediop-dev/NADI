import "server-only"
import { Prisma } from "@/generated/prisma/client"
import type { ConstructionStatus, LandOrigin } from "@/generated/prisma/enums"
import { UserError } from "@/lib/action"
import { PRE_CONTRACT } from "@/lib/construction"
import { db } from "@/lib/db"
import { nextConstructionReference } from "@/lib/sequences"

// Opérations partagées par l'administration, l'espace client et le site public.

export function isUniqueError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

export type NewProjectData = {
  title: string
  status: ConstructionStatus
  source: "ADMIN" | "SITE" | "PORTAL"
  buyerId: string | null
  contactName: string
  contactPhone: string
  contactEmail: string | null
  landOrigin: LandOrigin
  lotId: string | null
  landAddress: string | null
  landAreaM2: number | null
  landReference: string | null
  houseModelId: string | null
  customPlan: boolean
  requirements: string | null
  budget: number | null
}

/** Crée un projet avec la prochaine référence libre (nouvel essai si deux créations se croisent). */
export async function createConstructionProject(data: NewProjectData) {
  const attempt = () =>
    db.$transaction(async (tx) => tx.constructionProject.create({ data: { ...data, reference: await nextConstructionReference(tx) } }))
  try {
    return await attempt()
  } catch (error) {
    if (!isUniqueError(error)) throw error
    return attempt()
  }
}

/**
 * Réponse à une offre envoyée. Acceptée : son montant devient le montant du contrat et le projet passe à
 * « offre acceptée » s'il n'était pas déjà engagé ; les autres offres encore en attente sont classées refusées.
 */
export async function respondToQuote(quoteId: string, accepted: boolean, opts: { buyerId?: string } = {}) {
  return db.$transaction(async (tx) => {
    const quote = await tx.constructionQuote.findUnique({
      where: { id: quoteId },
      include: { project: { select: { id: true, status: true, buyerId: true, reference: true, title: true, contactName: true } } },
    })
    if (!quote || (opts.buyerId && quote.project.buyerId !== opts.buyerId)) throw new UserError("Offre introuvable")
    if (quote.status !== "SENT") throw new UserError("Cette offre n'est plus en attente de réponse.")
    if (quote.project.status === "CANCELLED") throw new UserError("Ce projet est classé sans suite.")
    const now = new Date()
    await tx.constructionQuote.update({ where: { id: quoteId }, data: { status: accepted ? "ACCEPTED" : "DECLINED", respondedAt: now } })
    if (accepted) {
      await tx.constructionQuote.updateMany({
        where: { projectId: quote.projectId, status: "SENT", id: { not: quoteId } },
        data: { status: "DECLINED", respondedAt: now },
      })
      await tx.constructionProject.update({
        where: { id: quote.projectId },
        data: { contractAmount: Math.round(quote.amount), ...(PRE_CONTRACT.includes(quote.project.status) ? { status: "SIGNED" } : {}) },
      })
    }
    return quote
  })
}
