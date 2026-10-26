import { format } from "date-fns"
import { getAdmin } from "@/lib/auth/admin"
import { getAllSalesWithSummary } from "@/lib/queries/sales"
import { buildWorkbook, DATE_FMT, MONEY_FMT, xlsxResponse, type SheetColumn } from "@/lib/excel"
import { frequencyPer } from "@/lib/finance"
import { fullName } from "@/lib/format"
import { INSTALLMENT_STATUS, SALE_STATUS } from "@/lib/labels"
import { formatPhone } from "@/lib/phone"

type Row = Record<string, string | number | Date | null>
const col = (header: string, key: string, width?: number, numFmt?: string): SheetColumn<Row> => ({ header, key, width, numFmt, value: (r) => r[key] })

/** Export Excel des ventes (feuille « Ventes » + feuille « Échéancier ») */
export async function GET() {
  if (!(await getAdmin())) return new Response("Non autorisé", { status: 401 })
  const sales = await getAllSalesWithSummary()
  const salesRows: Row[] = sales.map((s) => ({
    reference: s.reference,
    status: SALE_STATUS[s.status].label,
    signedAt: s.signedAt,
    lot: s.lot.number,
    block: s.lot.block,
    area: s.lot.areaM2,
    buyer: fullName(s.buyer),
    phone: formatPhone(s.buyer.phone),
    price: s.price,
    deposit: s.depositAmount,
    count: s.installmentsCount,
    frequency: frequencyPer(s.frequency, s.customIntervalDays),
    paid: s.summary.totalPaid,
    remaining: s.summary.remaining,
    overdue: s.summary.overdueAmount,
    daysLate: s.summary.daysLate || null,
    nextDate: s.summary.nextDue?.dueDate ?? null,
    nextAmount: s.summary.nextDue?.remaining ?? null,
  }))
  const scheduleRows: Row[] = sales
    .filter((s) => s.status !== "CANCELLED")
    .flatMap((s) =>
      s.summary.rows.map((r) => ({
        reference: s.reference,
        lot: s.lot.number,
        buyer: fullName(s.buyer),
        label: r.label,
        dueDate: r.dueDate,
        amount: r.amount,
        paid: r.paid,
        remaining: r.remaining,
        state: INSTALLMENT_STATUS[r.state].label,
      })),
    )
  const buffer = await buildWorkbook<Row>([
    {
      name: "Ventes",
      rows: salesRows,
      columns: [
        col("Référence", "reference", 16),
        col("Statut", "status", 11),
        col("Signée le", "signedAt", 12, DATE_FMT),
        col("Terrain", "lot", 9),
        col("Îlot", "block", 7),
        col("Surface (m²)", "area", 12),
        col("Acheteur", "buyer", 24),
        col("Téléphone", "phone", 18),
        col("Prix", "price", 15, MONEY_FMT),
        col("Acompte", "deposit", 15, MONEY_FMT),
        col("Échéances", "count", 10),
        col("Périodicité", "frequency", 16),
        col("Payé", "paid", 15, MONEY_FMT),
        col("Reste", "remaining", 15, MONEY_FMT),
        col("En retard", "overdue", 15, MONEY_FMT),
        col("Jours de retard", "daysLate", 14),
        col("Prochaine échéance", "nextDate", 17, DATE_FMT),
        col("Montant prochaine échéance", "nextAmount", 18, MONEY_FMT),
      ],
    },
    {
      name: "Échéancier",
      rows: scheduleRows,
      columns: [
        col("Vente", "reference", 16),
        col("Terrain", "lot", 9),
        col("Acheteur", "buyer", 24),
        col("Échéance", "label", 16),
        col("Date", "dueDate", 12, DATE_FMT),
        col("Montant", "amount", 15, MONEY_FMT),
        col("Payé", "paid", 15, MONEY_FMT),
        col("Reste", "remaining", 15, MONEY_FMT),
        col("Statut", "state", 12),
      ],
    },
  ])
  return xlsxResponse(buffer, `ventes-${format(new Date(), "yyyy-MM-dd")}.xlsx`)
}
