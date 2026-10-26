import { Suspense } from "react"
import type { Metadata } from "next"
import { format } from "date-fns"
import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/auth/admin"
import { getSettings, planDefaults } from "@/lib/settings"
import { resolvePlan } from "@/lib/finance"
import { compareLotNumbers, fullName } from "@/lib/format"
import { normalizePhone } from "@/lib/phone"
import { env } from "@/lib/env"
import { PageHeader } from "@/components/admin/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { NewSaleForm, type NewSaleLot } from "@/components/admin/sales/new-sale-form"

export const metadata: Metadata = { title: "Nouvelle vente" }

export default function NewSalePage({ searchParams }: PageProps<"/admin/ventes/nouvelle">) {
  return (
    <>
      <PageHeader
        title="Attribuer un terrain"
        description="Associez un terrain à un acheteur, définissez le prix, l'acompte et l'échéancier de paiement."
        back={{ href: "/admin/ventes", label: "Ventes" }}
      />
      <Suspense fallback={<FormSkeleton />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Content({ searchParams }: { searchParams: PageProps<"/admin/ventes/nouvelle">["searchParams"] }) {
  await requireAdmin("ADMIN")
  const sp = await searchParams
  const param = (key: string) => (typeof sp[key] === "string" ? (sp[key] as string) : undefined)
  const [settings, lots, buyers, request] = await Promise.all([
    getSettings(),
    db.lot.findMany({ where: { status: { in: ["AVAILABLE", "RESERVED"] } } }),
    db.buyer.findMany({ select: { id: true, firstName: true, lastName: true, phone: true } }),
    param("request") ? db.reservationRequest.findUnique({ where: { id: param("request") } }) : null,
  ])
  const defaults = planDefaults(settings)

  const lotOptions: NewSaleLot[] = lots
    .map((lot) => {
      const plan = resolvePlan(lot, defaults)
      return {
        id: lot.id,
        number: lot.number,
        block: lot.block,
        areaM2: lot.areaM2,
        status: lot.status,
        price: lot.price,
        plan: plan
          ? { deposit: plan.deposit, count: plan.count, frequency: plan.frequency, customIntervalDays: plan.customIntervalDays, installmentAmount: lot.installmentAmount }
          : null,
      }
    })
    .sort((a, b) => compareLotNumbers(a.number, b.number))

  const buyerOptions = buyers
    .map((b) => ({ id: b.id, name: fullName(b), phone: b.phone }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"))

  // Préremplissage depuis une demande de réservation
  let buyerId = param("buyer")
  let prefillBuyer: { firstName: string; lastName: string; phone: string; email: string } | null = null
  let lotId = param("lot")
  if (request) {
    const candidates = [request.proposedLotId, request.lotId].filter(Boolean) as string[]
    lotId ??= candidates.find((id) => lotOptions.some((l) => l.id === id))
    const phone = normalizePhone(request.phone, env.defaultCountry)
    const match = phone ? buyers.find((b) => b.phone === phone) : undefined
    if (match) buyerId ??= match.id
    else if (!buyerId) {
      const parts = request.fullName.trim().split(/\s+/)
      prefillBuyer = {
        firstName: parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0],
        lastName: parts.length > 1 ? parts[parts.length - 1] : "",
        phone: phone ?? request.phone,
        email: request.email ?? "",
      }
    }
  }

  return (
    <NewSaleForm
      lots={lotOptions}
      buyers={buyerOptions}
      currency={settings.currencyLabel}
      today={format(new Date(), "yyyy-MM-dd")}
      initialLotId={lotOptions.some((l) => l.id === lotId) ? lotId : undefined}
      initialBuyerId={buyerOptions.some((b) => b.id === buyerId) ? buyerId : undefined}
      prefillBuyer={prefillBuyer}
      request={request ? { id: request.id, fullName: request.fullName } : null}
      smsDefault={settings.smsOnPayment}
    />
  )
}

function FormSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  )
}
