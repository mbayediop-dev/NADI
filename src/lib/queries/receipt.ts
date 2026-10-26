import "server-only"
import { db } from "@/lib/db"
import { fullName } from "@/lib/format"
import type { AppSettings } from "@/lib/settings"
import type { ReceiptData } from "@/components/shared/receipt"

/** Données d'un reçu de versement. `buyerId` restreint l'accès à l'acheteur concerné (espace client). */
export async function getReceiptData(paymentId: string, settings: AppSettings, opts: { buyerId?: string } = {}): Promise<ReceiptData | null> {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { sale: { include: { lot: true, buyer: true, payments: { select: { id: true, amount: true, paidAt: true, createdAt: true } } } } },
  })
  if (!payment) return null
  if (opts.buyerId && payment.sale.buyerId !== opts.buyerId) return null
  const paidToDate = payment.sale.payments
    .filter((p) => p.paidAt < payment.paidAt || (p.paidAt.getTime() === payment.paidAt.getTime() && p.createdAt <= payment.createdAt))
    .reduce((sum, p) => sum + p.amount, 0)
  return {
    company: { name: settings.companyName, address: settings.companyAddress, phone: settings.companyPhone, email: settings.companyEmail },
    currency: settings.currencyLabel,
    payment: {
      receiptNumber: payment.receiptNumber,
      amount: payment.amount,
      paidAt: payment.paidAt,
      method: payment.method,
      reference: payment.reference,
      note: payment.note,
    },
    sale: { reference: payment.sale.reference, price: payment.sale.price },
    lot: { number: payment.sale.lot.number, block: payment.sale.lot.block, areaM2: payment.sale.lot.areaM2 },
    buyer: { name: fullName(payment.sale.buyer), phone: payment.sale.buyer.phone },
    paidToDate,
  }
}
