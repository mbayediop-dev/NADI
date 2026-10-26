import "server-only"
import type { Prisma } from "@/generated/prisma/client"

type Tx = Prisma.TransactionClient

/** Prochaine référence de vente : VTE-2026-0027 */
export async function nextSaleReference(tx: Tx, date = new Date()) {
  const prefix = `VTE-${date.getFullYear()}-`
  const last = await tx.sale.findFirst({ where: { reference: { startsWith: prefix } }, orderBy: { reference: "desc" }, select: { reference: true } })
  const n = last ? Number(last.reference.slice(prefix.length)) + 1 : 1
  return `${prefix}${String(n).padStart(4, "0")}`
}

/** Prochain numéro de reçu : REC-2026-00159 */
export async function nextReceiptNumber(tx: Tx, date = new Date()) {
  const prefix = `REC-${date.getFullYear()}-`
  const last = await tx.payment.findFirst({ where: { receiptNumber: { startsWith: prefix } }, orderBy: { receiptNumber: "desc" }, select: { receiptNumber: true } })
  const n = last ? Number(last.receiptNumber.slice(prefix.length)) + 1 : 1
  return `${prefix}${String(n).padStart(5, "0")}`
}
