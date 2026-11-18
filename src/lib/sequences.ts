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

/** Prochaine référence de projet de construction : CST-2026-0004 */
export async function nextConstructionReference(tx: Tx, date = new Date()) {
  const prefix = `CST-${date.getFullYear()}-`
  const last = await tx.constructionProject.findFirst({ where: { reference: { startsWith: prefix } }, orderBy: { reference: "desc" }, select: { reference: true } })
  const n = last ? Number(last.reference.slice(prefix.length)) + 1 : 1
  return `${prefix}${String(n).padStart(4, "0")}`
}

/** Prochain numéro d'offre de construction : OFF-2026-0007 */
export async function nextQuoteNumber(tx: Tx, date = new Date()) {
  const prefix = `OFF-${date.getFullYear()}-`
  const last = await tx.constructionQuote.findFirst({ where: { number: { startsWith: prefix } }, orderBy: { number: "desc" }, select: { number: true } })
  const n = last ? Number(last.number.slice(prefix.length)) + 1 : 1
  return `${prefix}${String(n).padStart(4, "0")}`
}

/** Prochain numéro de reçu d'un versement de construction : RCC-2026-00012 (série distincte des reçus de terrain) */
export async function nextConstructionReceiptNumber(tx: Tx, date = new Date()) {
  const prefix = `RCC-${date.getFullYear()}-`
  const last = await tx.constructionPayment.findFirst({ where: { receiptNumber: { startsWith: prefix } }, orderBy: { receiptNumber: "desc" }, select: { receiptNumber: true } })
  const n = last ? Number(last.receiptNumber.slice(prefix.length)) + 1 : 1
  return `${prefix}${String(n).padStart(5, "0")}`
}
