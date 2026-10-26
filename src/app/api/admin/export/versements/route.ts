import { format } from "date-fns"
import type { PaymentMethod } from "@/generated/prisma/enums"
import { db } from "@/lib/db"
import { getAdmin } from "@/lib/auth/admin"
import { buildWorkbook, DATE_FMT, MONEY_FMT, xlsxResponse } from "@/lib/excel"
import { fullName } from "@/lib/format"
import { PAYMENT_METHOD } from "@/lib/labels"
import { formatPhone } from "@/lib/phone"

/** Export Excel du journal des versements (filtres : from, to au format AAAA-MM-JJ, method) */
export async function GET(request: Request) {
  if (!(await getAdmin())) return new Response("Non autorisé", { status: 401 })
  const params = new URL(request.url).searchParams
  const from = params.get("from")
  const to = params.get("to")
  const method = params.get("method") as PaymentMethod | null
  const payments = await db.payment.findMany({
    where: {
      paidAt: { ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}) },
      ...(method && method in PAYMENT_METHOD ? { method } : {}),
    },
    orderBy: [{ paidAt: "asc" }, { receiptNumber: "asc" }],
    include: {
      recordedBy: { select: { name: true } },
      sale: { select: { reference: true, lot: { select: { number: true } }, buyer: { select: { firstName: true, lastName: true, phone: true } } } },
    },
  })
  type P = (typeof payments)[number]
  const buffer = await buildWorkbook<P>([
    {
      name: "Versements",
      rows: payments,
      columns: [
        { header: "Date", key: "date", width: 12, numFmt: DATE_FMT, value: (p) => p.paidAt },
        { header: "N° de reçu", key: "receipt", width: 17, value: (p) => p.receiptNumber },
        { header: "Acheteur", key: "buyer", width: 24, value: (p) => fullName(p.sale.buyer) },
        { header: "Téléphone", key: "phone", width: 18, value: (p) => formatPhone(p.sale.buyer.phone) },
        { header: "Terrain", key: "lot", width: 9, value: (p) => p.sale.lot.number },
        { header: "Vente", key: "sale", width: 16, value: (p) => p.sale.reference },
        { header: "Montant", key: "amount", width: 15, numFmt: MONEY_FMT, value: (p) => p.amount },
        { header: "Mode", key: "method", width: 17, value: (p) => PAYMENT_METHOD[p.method] },
        { header: "Référence", key: "reference", width: 16, value: (p) => p.reference },
        { header: "Note", key: "note", width: 30, value: (p) => p.note },
        { header: "Saisi par", key: "by", width: 18, value: (p) => p.recordedBy?.name },
      ],
    },
  ])
  const suffix = from || to ? `${from ?? "debut"}_${to ?? format(new Date(), "yyyy-MM-dd")}` : format(new Date(), "yyyy-MM-dd")
  return xlsxResponse(buffer, `versements-${suffix}.xlsx`)
}
