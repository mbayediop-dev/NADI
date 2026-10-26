import { format } from "date-fns"
import { db } from "@/lib/db"
import { getAdmin } from "@/lib/auth/admin"
import { buildWorkbook, DATE_FMT, MONEY_FMT, xlsxResponse } from "@/lib/excel"
import { summarizeSale } from "@/lib/finance"
import { formatPhone } from "@/lib/phone"

/** Export Excel des acheteurs avec leur situation */
export async function GET() {
  if (!(await getAdmin())) return new Response("Non autorisé", { status: 401 })
  const buyers = await db.buyer.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: { sales: { where: { status: { not: "CANCELLED" } }, include: { lot: { select: { number: true } }, installments: true, payments: { select: { amount: true, paidAt: true } } } } },
  })
  const rows = buyers.map((b) => {
    const summaries = b.sales.map((s) => summarizeSale(s))
    return {
      buyer: b,
      lots: b.sales.map((s) => s.lot.number).join(", "),
      contracted: b.sales.reduce((sum, s) => sum + s.price, 0),
      paid: summaries.reduce((sum, s) => sum + s.totalPaid, 0),
      remaining: summaries.reduce((sum, s) => sum + s.remaining, 0),
      overdue: summaries.reduce((sum, s) => sum + s.overdueAmount, 0),
    }
  })
  type R = (typeof rows)[number]
  const buffer = await buildWorkbook<R>([
    {
      name: "Acheteurs",
      rows,
      columns: [
        { header: "Nom", key: "last", width: 16, value: (r) => r.buyer.lastName },
        { header: "Prénom", key: "first", width: 18, value: (r) => r.buyer.firstName },
        { header: "Téléphone", key: "phone", width: 18, value: (r) => formatPhone(r.buyer.phone) },
        { header: "E-mail", key: "email", width: 26, value: (r) => r.buyer.email },
        { header: "Ville", key: "city", width: 14, value: (r) => r.buyer.city },
        { header: "Pays", key: "country", width: 12, value: (r) => r.buyer.country },
        { header: "Profession", key: "job", width: 18, value: (r) => r.buyer.profession },
        { header: "Pièce", key: "idType", width: 10, value: (r) => r.buyer.idType },
        { header: "N° pièce", key: "idNumber", width: 18, value: (r) => r.buyer.idNumber },
        { header: "Terrains", key: "lots", width: 12, value: (r) => r.lots },
        { header: "Contractualisé", key: "contracted", width: 15, numFmt: MONEY_FMT, value: (r) => r.contracted },
        { header: "Payé", key: "paid", width: 15, numFmt: MONEY_FMT, value: (r) => r.paid },
        { header: "Reste", key: "remaining", width: 15, numFmt: MONEY_FMT, value: (r) => r.remaining },
        { header: "En retard", key: "overdue", width: 15, numFmt: MONEY_FMT, value: (r) => r.overdue },
        { header: "Espace client", key: "portal", width: 13, value: (r) => (r.buyer.portalEnabled ? "Actif" : "Désactivé") },
        { header: "Dernière connexion", key: "login", width: 17, numFmt: DATE_FMT, value: (r) => r.buyer.lastLoginAt },
      ],
    },
  ])
  return xlsxResponse(buffer, `acheteurs-${format(new Date(), "yyyy-MM-dd")}.xlsx`)
}
