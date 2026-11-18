import { db } from "@/lib/db"
import { getAdmin } from "@/lib/auth/admin"
import { getBuyer } from "@/lib/auth/client"
import { getObject, objectResponse } from "@/lib/storage"

/**
 * Justificatif d'une dépense (facture, reçu fournisseur — fichier privé) :
 * - administrateurs : toujours
 * - client du chantier : si la dépense lui est visible et que le projet partage ses dépenses
 */
export async function GET(request: Request, ctx: RouteContext<"/api/construction/expenses/[id]">) {
  const { id } = await ctx.params
  const expense = await db.expense.findUnique({
    where: { id },
    select: {
      attachmentKey: true,
      attachmentName: true,
      attachmentMime: true,
      visibleToClient: true,
      project: { select: { buyerId: true, showExpensesToClient: true } },
    },
  })
  if (!expense?.attachmentKey) return new Response("Introuvable", { status: 404 })

  let allowed = !!(await getAdmin())
  if (!allowed && expense.visibleToClient && expense.project?.showExpensesToClient) {
    const buyer = await getBuyer()
    allowed = !!buyer && expense.project.buyerId === buyer.id
  }
  if (!allowed) return new Response("Accès refusé", { status: 403 })

  const object = await getObject(expense.attachmentKey, request.headers.get("range"))
  if (!object) return new Response("Fichier introuvable", { status: 404 })
  return objectResponse(
    { ...object, contentType: expense.attachmentMime || object.contentType },
    { filename: expense.attachmentName ?? undefined, inline: true, cache: "private, max-age=300" },
  )
}
