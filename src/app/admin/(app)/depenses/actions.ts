"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { assertAdmin } from "@/lib/auth/admin"
import { fail, ok, run, type ActionResult } from "@/lib/action"
import { logActivity } from "@/lib/activity"
import { toDueDate } from "@/lib/finance"
import { formatMoney } from "@/lib/format"
import { deleteObject } from "@/lib/storage"

const METHODS = ["CASH", "WAVE", "ORANGE_MONEY", "FREE_MONEY", "BANK_TRANSFER", "CHECK", "OTHER"] as const
const CATEGORIES = ["MATERIALS", "LABOR", "EQUIPMENT", "TRANSPORT", "SUBCONTRACTING", "STUDIES", "PERMITS", "UTILITIES", "OTHER"] as const

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable()
const optionalNumber = z.number().finite().nonnegative().optional().nullable()

const expenseSchema = z
  .object({
    id: z.string().optional().nullable(),
    scope: z.enum(["SITE", "PROJECT"]),
    projectId: z.string().optional().nullable(),
    phaseId: z.string().optional().nullable(),
    category: z.enum(CATEGORIES),
    label: z.string().trim().min(2, "Désignation requise").max(200),
    supplier: optionalText(120),
    quantity: optionalNumber,
    unit: optionalText(20),
    unitPrice: optionalNumber,
    amount: z.number({ error: "Montant requis" }).finite().positive("Montant requis"),
    spentAt: z
      .string()
      .min(1, "Date requise")
      .refine((v) => !Number.isNaN(new Date(v).getTime()), "Date invalide"),
    method: z.enum(METHODS).optional().nullable(),
    reference: optionalText(80),
    note: optionalText(1000),
    visibleToClient: z.boolean().default(true),
    /** undefined : justificatif inchangé · null : retiré · objet : nouveau fichier téléversé */
    attachment: z
      .object({ key: z.string().startsWith("private/"), filename: z.string().min(1).max(200), mimeType: z.string().min(1) })
      .nullable()
      .optional(),
  })
  .refine((v) => v.scope !== "PROJECT" || !!v.projectId, { path: ["projectId"], message: "Choisissez le chantier concerné" })

export type ExpenseInput = z.input<typeof expenseSchema>

function revalidateExpenses(projectId?: string | null) {
  revalidatePath("/admin")
  revalidatePath("/admin/depenses")
  revalidatePath("/admin/construction")
  if (projectId) revalidatePath(`/admin/construction/${projectId}`)
}

/** Enregistre une dépense du lotissement ou du chantier d'un client (création ou modification). */
export async function saveExpense(input: ExpenseInput): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const data = expenseSchema.parse(input)
    const projectId = data.scope === "PROJECT" ? data.projectId! : null
    if (projectId) {
      const project = await db.constructionProject.findUnique({ where: { id: projectId }, select: { status: true } })
      if (!project) return fail("Chantier introuvable")
      if (project.status === "CANCELLED") return fail("Ce projet est classé sans suite : aucune dépense ne peut y être ajoutée.")
      if (data.phaseId && !(await db.constructionPhase.findFirst({ where: { id: data.phaseId, projectId }, select: { id: true } }))) {
        return fail("Cette étape n'appartient pas au chantier choisi.")
      }
    }
    const values = {
      scope: data.scope,
      projectId,
      phaseId: projectId ? data.phaseId || null : null,
      category: data.category,
      label: data.label,
      supplier: data.supplier || null,
      quantity: data.quantity ?? null,
      unit: data.unit || null,
      unitPrice: data.unitPrice ?? null,
      amount: Math.round(data.amount),
      spentAt: toDueDate(data.spentAt),
      method: data.method ?? null,
      reference: data.reference || null,
      note: data.note || null,
      visibleToClient: projectId ? data.visibleToClient : false,
      ...(data.attachment === undefined
        ? {}
        : { attachmentKey: data.attachment?.key ?? null, attachmentName: data.attachment?.filename ?? null, attachmentMime: data.attachment?.mimeType ?? null }),
    }

    if (data.id) {
      const previous = await db.expense.findUnique({ where: { id: data.id }, select: { attachmentKey: true, projectId: true } })
      if (!previous) return fail("Dépense introuvable")
      await db.expense.update({ where: { id: data.id }, data: values })
      if (data.attachment !== undefined && previous.attachmentKey && previous.attachmentKey !== data.attachment?.key) {
        await deleteObject(previous.attachmentKey).catch(() => undefined)
      }
      revalidateExpenses(previous.projectId)
      revalidateExpenses(projectId)
      return ok({ id: data.id }, "Dépense modifiée")
    }

    const expense = await db.expense.create({ data: { ...values, recordedById: admin.id }, select: { id: true } })
    await logActivity({
      type: "expense",
      message: `Dépense de ${formatMoney(values.amount)} : ${values.label}${values.supplier ? ` (${values.supplier})` : ""}`,
      actorId: admin.id,
      entityType: projectId ? "construction" : "expense",
      entityId: projectId ?? expense.id,
    })
    revalidateExpenses(projectId)
    return ok({ id: expense.id }, "Dépense enregistrée")
  })
}

export async function deleteExpense(expenseId: string): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const expense = await db.expense.findUnique({ where: { id: expenseId } })
    if (!expense) return fail("Dépense introuvable")
    await db.expense.delete({ where: { id: expenseId } })
    if (expense.attachmentKey) await deleteObject(expense.attachmentKey).catch(() => undefined)
    await logActivity({ type: "expense", message: `Dépense supprimée : ${expense.label} (${formatMoney(expense.amount)})`, actorId: admin.id })
    revalidateExpenses(expense.projectId)
    return ok(null, "Dépense supprimée")
  })
}
