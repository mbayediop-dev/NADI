import type { PaymentMethod } from "@/generated/prisma/enums"
import { formatArea, formatDate, formatDateLong, formatMoney } from "@/lib/format"
import { PAYMENT_METHOD } from "@/lib/labels"
import { formatPhone } from "@/lib/phone"
import { cn } from "@/lib/utils"
import { numberToFrenchWords } from "@/lib/number-words"
import { Logo } from "@/components/brand/logo"
import { SignatureImage } from "@/components/shared/signature-image"

export type ReceiptData = {
  /** signatureUrl : cachet et signature de l'entreprise (image à fond transparent), s'ils sont renseignés dans les paramètres */
  company: { name: string; address: string; phone: string; email: string; signatureUrl: string | null }
  currency: string
  payment: { receiptNumber: string; amount: number; paidAt: Date; method: PaymentMethod; reference: string | null; note: string | null }
  sale: { reference: string; price: number }
  lot?: { number: string; block: string | null; areaM2: number }
  /** Objet du reçu lorsqu'il ne porte pas sur un terrain (construction) : remplace « Terrain n° … » et l'intitulé du prix */
  subject?: { title: string; detail: string; totalLabel: string }
  buyer: { name: string; phone: string }
  /** Cumul versé à la date de ce reçu (inclus) */
  paidToDate: number
}

/** Reçu de versement imprimable (format A4, une page). */
export function Receipt({ data }: { data: ReceiptData }) {
  const { company, currency, payment, sale, lot, buyer, paidToDate } = data
  const remaining = Math.max(0, sale.price - paidToDate)
  const subject = data.subject ?? {
    title: lot ? `Terrain n° ${lot.number}${lot.block ? ` — îlot ${lot.block}` : ""}` : `Vente ${sale.reference}`,
    detail: lot ? `${formatArea(lot.areaM2)} · Vente ${sale.reference}` : "",
    totalLabel: "Prix du terrain",
  }
  return (
    <article className="mx-auto w-full max-w-[760px] overflow-hidden rounded-2xl border bg-white text-[oklch(0.22_0.02_258)] shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none">
      <header className="flex flex-col gap-6 border-b bg-[oklch(0.972_0.006_255)] p-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Logo />
          <div className="mt-4 space-y-0.5 text-xs text-[oklch(0.45_0.02_258)]">
            {company.address && <p>{company.address}</p>}
            {company.phone && <p>Tél. {formatPhone(company.phone)}</p>}
            {company.email && <p>{company.email}</p>}
          </div>
        </div>
        <div className="sm:text-right">
          <p className="text-[0.7rem] font-bold tracking-[0.25em] text-[oklch(0.55_0.16_42)]">REÇU DE VERSEMENT</p>
          <p className="mt-1 text-2xl font-extrabold tabular">{payment.receiptNumber}</p>
          <p className="mt-1 text-sm text-[oklch(0.45_0.02_258)]">Date : {formatDateLong(payment.paidAt)}</p>
        </div>
      </header>

      <section className="space-y-6 p-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold tracking-wide text-[oklch(0.5_0.02_258)] uppercase">Reçu de</p>
            <p className="mt-1 text-lg font-bold">{buyer.name}</p>
            <p className="text-sm text-[oklch(0.45_0.02_258)] tabular">{formatPhone(buyer.phone)}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold tracking-wide text-[oklch(0.5_0.02_258)] uppercase">Objet</p>
            <p className="mt-1 font-semibold">{subject.title}</p>
            {subject.detail && <p className="text-sm text-[oklch(0.45_0.02_258)]">{subject.detail}</p>}
          </div>
        </div>

        <div className="rounded-xl border-2 border-[oklch(0.3_0.07_257)]/20 bg-[oklch(0.3_0.07_257)]/[0.04] p-5">
          <p className="text-xs font-semibold tracking-wide text-[oklch(0.5_0.02_258)] uppercase">Montant reçu</p>
          <p className="mt-1 text-3xl font-extrabold text-[oklch(0.3_0.07_257)] tabular">{formatMoney(payment.amount, currency)}</p>
          <p className="mt-1 text-sm text-[oklch(0.4_0.02_258)] first-letter:uppercase">
            {numberToFrenchWords(payment.amount)} francs CFA
          </p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span>
              Mode : <strong>{PAYMENT_METHOD[payment.method]}</strong>
            </span>
            {payment.reference && (
              <span>
                Référence : <strong className="tabular">{payment.reference}</strong>
              </span>
            )}
          </div>
          {payment.note && <p className="mt-2 text-sm text-[oklch(0.45_0.02_258)]">{payment.note}</p>}
        </div>

        <dl className="grid grid-cols-3 divide-x overflow-hidden rounded-xl border text-center">
          <div className="p-4">
            <dt className="text-xs text-[oklch(0.5_0.02_258)]">{subject.totalLabel}</dt>
            <dd className="mt-1 font-bold tabular">{formatMoney(sale.price, currency)}</dd>
          </div>
          <div className="p-4">
            <dt className="text-xs text-[oklch(0.5_0.02_258)]">Total versé au {formatDate(payment.paidAt)}</dt>
            <dd className="mt-1 font-bold text-[oklch(0.45_0.12_152)] tabular">{formatMoney(paidToDate, currency)}</dd>
          </div>
          <div className="p-4">
            <dt className="text-xs text-[oklch(0.5_0.02_258)]">Reste à payer</dt>
            <dd className="mt-1 font-bold tabular">{formatMoney(remaining, currency)}</dd>
          </div>
        </dl>

        <div className="flex flex-col gap-6 pt-6 sm:flex-row sm:items-end sm:justify-between print:flex-row print:items-end print:justify-between">
          <p className="max-w-xs text-xs text-[oklch(0.5_0.02_258)]">
            Reçu généré électroniquement par {company.name}. Conservez-le précieusement : il fait foi du versement indiqué.
          </p>
          <div className={cn("shrink-0 self-end text-center", company.signatureUrl ? "w-56" : "w-48")}>
            <div className={cn("relative border-b border-dashed border-[oklch(0.7_0.01_258)]", company.signatureUrl ? "h-32" : "h-16")}>
              {company.signatureUrl && (
                // Le cachet chevauche la ligne de signature, comme un tampon apposé à la main.
                <SignatureImage
                  src={company.signatureUrl}
                  alt={`Cachet et signature de ${company.name}`}
                  className="absolute -bottom-3 left-1/2 h-36 w-auto max-w-none -translate-x-1/2 object-contain"
                />
              )}
            </div>
            <p className="mt-2 text-xs font-semibold">Pour {company.name}</p>
          </div>
        </div>
      </section>
    </article>
  )
}
