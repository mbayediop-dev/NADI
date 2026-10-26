import "server-only"
import { addDays, differenceInCalendarDays, startOfDay } from "date-fns"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { summarizeSale } from "@/lib/finance"
import { formatDate, formatMoney } from "@/lib/format"
import { formatPhone } from "@/lib/phone"
import { getSettings } from "@/lib/settings"
import { sendSms } from "@/lib/sms"
import { logActivity } from "@/lib/activity"

/** Les espaces insécables forceraient l'encodage UCS-2 (70 caractères par SMS) : on les remplace. */
function smsText(text: string) {
  return text.replace(/[  ]/g, " ")
}

const money = (value: number, currency: string) => smsText(formatMoney(value, currency))

const saleInclude = {
  lot: { select: { number: true } },
  buyer: { select: { id: true, firstName: true, lastName: true, phone: true } },
  installments: true,
  payments: { select: { amount: true, paidAt: true } },
} as const

/** SMS de confirmation après l'enregistrement d'un versement. */
export async function sendPaymentConfirmation(paymentId: string) {
  const payment = await db.payment.findUnique({ where: { id: paymentId }, include: { sale: { include: saleInclude } } })
  if (!payment) return { ok: false as const, error: "Versement introuvable" }
  const settings = await getSettings()
  const { sale } = payment
  const summary = summarizeSale(sale)
  const remaining = summary.remaining
  const body = smsText(
    `${settings.companyName} : nous confirmons la réception de ${money(payment.amount, settings.currencyLabel)} pour le terrain n°${sale.lot.number} (reçu ${payment.receiptNumber}). ` +
      (remaining > 0 ? `Reste à payer : ${money(remaining, settings.currencyLabel)}. Merci !` : "Votre terrain est entièrement payé. Félicitations et merci !"),
  )
  return sendSms(sale.buyer.phone, body, "PAYMENT")
}

/** SMS de bienvenue après l'attribution d'un terrain. */
export async function sendWelcomeSms(saleId: string) {
  const sale = await db.sale.findUnique({ where: { id: saleId }, include: saleInclude })
  if (!sale) return { ok: false as const, error: "Vente introuvable" }
  const settings = await getSettings()
  const body = smsText(
    `Bienvenue chez ${settings.companyName}, ${sale.buyer.firstName} ! Le terrain n°${sale.lot.number} vous est attribué (réf. ${sale.reference}). ` +
      `Suivez vos paiements et l'avancement du site sur ${env.appUrl}/espace-client avec votre numéro de téléphone.`,
  )
  return sendSms(sale.buyer.phone, body, "MANUAL")
}

function reminderBody(
  sale: { lot: { number: string } },
  summary: ReturnType<typeof summarizeSale>,
  settings: Awaited<ReturnType<typeof getSettings>>,
) {
  const contact = settings.companyWhatsapp || settings.companyPhone
  const contactText = contact ? ` Contact : ${formatPhone(contact)}.` : ""
  if (summary.overdueAmount > 0) {
    const late = summary.rows.find((r) => r.state === "LATE")
    return smsText(
      `Rappel ${settings.companyName} : un montant de ${money(summary.overdueAmount, settings.currencyLabel)} est en retard pour le terrain n°${sale.lot.number}` +
        (late ? ` (échéance du ${formatDate(late.dueDate, "d MMMM yyyy")})` : "") +
        `. Merci de régulariser ou de nous contacter.${contactText}`,
    )
  }
  if (summary.nextDue) {
    return smsText(
      `Rappel ${settings.companyName} : votre prochain versement de ${money(summary.nextDue.remaining, settings.currencyLabel)} pour le terrain n°${sale.lot.number} est attendu le ${formatDate(summary.nextDue.dueDate, "d MMMM yyyy")}. Merci !${contactText}`,
    )
  }
  return null
}

/** Relance manuelle (retard ou prochaine échéance). */
export async function sendReminder(saleId: string, actorId?: string) {
  const sale = await db.sale.findUnique({ where: { id: saleId }, include: saleInclude })
  if (!sale) return { ok: false as const, error: "Vente introuvable" }
  if (sale.status !== "ACTIVE") return { ok: false as const, error: "Cette vente n'est plus en cours de paiement." }
  const settings = await getSettings()
  const summary = summarizeSale(sale)
  const body = reminderBody(sale, summary, settings)
  if (!body) return { ok: false as const, error: "Aucune échéance à rappeler." }
  const result = await sendSms(sale.buyer.phone, body, "REMINDER")
  if (result.ok) {
    const ids = summary.rows.filter((r) => r.remaining > 0 && (r.state === "LATE" || r === summary.nextDue)).map((r) => r.id!)
    await db.installment.updateMany({ where: { id: { in: ids } }, data: { lastReminderAt: new Date() } })
    await logActivity({
      type: "reminder",
      message: `Relance SMS envoyée à ${sale.buyer.firstName} ${sale.buyer.lastName} (terrain n°${sale.lot.number})`,
      actorId,
      entityType: "sale",
      entityId: sale.id,
    })
  }
  return result
}

/**
 * Relances automatiques (à appeler chaque jour via /api/cron/reminders) :
 * - échéances arrivant dans `smsReminderDaysBefore` jours (une seule fois par échéance)
 * - échéances en retard (si activé), au plus une fois tous les 7 jours
 * Au plus un SMS par vente et par exécution.
 */
export async function runAutomaticReminders() {
  const settings = await getSettings()
  const now = new Date()
  const today = startOfDay(now)
  const horizon = addDays(today, Math.max(0, settings.smsReminderDaysBefore))
  const sales = await db.sale.findMany({ where: { status: "ACTIVE" }, include: saleInclude })
  let upcoming = 0
  let overdue = 0
  let failed = 0

  for (const sale of sales) {
    const summary = summarizeSale(sale, now)
    const byId = new Map(sale.installments.map((i) => [i.id, i]))
    const lateRows = summary.rows.filter((r) => r.state === "LATE")
    const dueLate =
      settings.smsOverdueReminders &&
      lateRows.length > 0 &&
      lateRows.some((r) => {
        const last = byId.get(r.id!)?.lastReminderAt
        return !last || differenceInCalendarDays(today, last) >= 7
      })
    const next = summary.nextDue
    const dueSoon =
      settings.smsReminderDaysBefore > 0 &&
      next &&
      next.state !== "LATE" &&
      next.dueDate >= today &&
      next.dueDate <= horizon &&
      !byId.get(next.id!)?.lastReminderAt

    if (!dueLate && !dueSoon) continue
    const body = reminderBody(sale, summary, settings)
    if (!body) continue
    const result = await sendSms(sale.buyer.phone, body, "REMINDER")
    if (!result.ok) {
      failed++
      continue
    }
    const ids = dueLate ? lateRows.map((r) => r.id!) : [next!.id!]
    await db.installment.updateMany({ where: { id: { in: ids } }, data: { lastReminderAt: now } })
    if (dueLate) overdue++
    else upcoming++
  }

  if (upcoming + overdue > 0) {
    await logActivity({ type: "reminder", message: `Relances automatiques : ${upcoming} échéance(s) à venir, ${overdue} retard(s)` })
  }
  return { upcoming, overdue, failed, checked: sales.length }
}
