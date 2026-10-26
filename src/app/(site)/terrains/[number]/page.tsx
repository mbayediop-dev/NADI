import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { formatArea, formatMoney } from "@/lib/format"
import { LOT_STATUS } from "@/lib/labels"
import { getPublicLots, similarLots } from "@/lib/queries/public"
import { LotStatusBadge } from "@/components/shared/badges"
import { Container } from "@/components/site/section-heading"
import { PageBand } from "@/components/site/skeletons"
import { LotPageDetails, LotPagePlan, SimilarLots } from "@/components/site/explorer/lot-page-client"

async function findLot(params: PageProps<"/terrains/[number]">["params"]) {
  const { number } = await params
  const data = await getPublicLots()
  const lot = data.lots.find((l) => l.number === decodeURIComponent(number))
  return { ...data, lot }
}

export async function generateMetadata({ params }: PageProps<"/terrains/[number]">): Promise<Metadata> {
  const { settings, lot } = await findLot(params)
  if (!lot) return { title: "Terrain introuvable" }
  const price = lot.price != null ? ` — ${formatMoney(lot.price, settings.currencyLabel)}` : ""
  const title = `Terrain n° ${lot.number} · ${formatArea(lot.areaM2)}${price}`
  const description = `${LOT_STATUS[lot.status].label} : terrain n° ${lot.number}${lot.block ? `, îlot ${lot.block}` : ""}, ${formatArea(lot.areaM2)} à ${settings.siteName}${lot.soilType ? `. Sol ${lot.soilType.toLowerCase()}` : ""}.${lot.plan ? ` Acompte de ${formatMoney(lot.plan.deposit, settings.currencyLabel)}, puis ${lot.plan.count} versements.` : ""}`
  return { title, description, openGraph: { title, description }, alternates: { canonical: `/terrains/${encodeURIComponent(lot.number)}` } }
}

export default function LotPage({ params }: PageProps<"/terrains/[number]">) {
  return (
    <Suspense fallback={<LotSkeleton />}>
      <LotContent params={params} />
    </Suspense>
  )
}

async function LotContent({ params }: { params: PageProps<"/terrains/[number]">["params"] }) {
  const { settings: s, lots, lot } = await findLot(params)
  if (!lot) notFound()
  const similar = similarLots(lot, lots, 4)
  const settings = {
    planImageUrl: s.planImageUrl,
    planWidth: s.planWidth,
    planHeight: s.planHeight,
    currencyLabel: s.currencyLabel,
    showPricesPublicly: s.showPricesPublicly,
    reservationsOpen: s.reservationsOpen,
    companyName: s.companyName,
    companyWhatsapp: s.companyWhatsapp,
  }
  return (
    <>
      <PageBand>
        <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-sm text-white/60">
          <Link href="/" className="hover:text-white">
            Accueil
          </Link>
          <ChevronRight className="size-3.5" />
          <Link href="/terrains" className="hover:text-white">
            Terrains
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="text-white">N° {lot.number}</span>
        </nav>
        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <LotStatusBadge status={lot.status} className="bg-white/90" />
            <h1 className="mt-3 font-display text-4xl font-medium sm:text-5xl">Terrain n° {lot.number}</h1>
            <p className="mt-2 text-white/70">
              {formatArea(lot.areaM2)}
              {lot.block ? ` · Îlot ${lot.block}` : ""} · {s.siteName}
            </p>
          </div>
          {lot.price != null && (
            <div className="sm:text-right">
              <p className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">Prix</p>
              <p className="font-display text-3xl font-medium tabular sm:text-4xl">{formatMoney(lot.price, s.currencyLabel)}</p>
            </div>
          )}
        </div>
      </PageBand>

      <Container className="grid items-start gap-8 py-10 lg:grid-cols-[1.2fr_1fr] lg:grid-rows-[auto_1fr] lg:py-14">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <LotPagePlan lot={lot} lots={lots} settings={settings} />
        </div>
        <aside className="rounded-lg border bg-card p-5 shadow-[0_30px_80px_-40px_rgb(0_0_0/0.3)] sm:p-7 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <LotPageDetails lot={lot} similar={similar} settings={settings} />
        </aside>
        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          {similar.length > 0 && (
            <section>
              <h2 className="font-display text-2xl">
                {lot.status === "AVAILABLE" ? "Terrains similaires" : "Terrains disponibles comparables"}
              </h2>
              <p className="mt-1 mb-5 text-sm text-muted-foreground">Même gamme de surface et de prix, disponibles dès maintenant.</p>
              <SimilarLots lots={similar} currency={s.currencyLabel} />
            </section>
          )}
        </div>
      </Container>
    </>
  )
}

function LotSkeleton() {
  return (
    <>
      <PageBand>
        <div className="h-4 w-48 animate-pulse rounded bg-white/10" />
        <div className="mt-8 h-12 w-72 animate-pulse rounded-md bg-white/10" />
      </PageBand>
      <Container className="grid gap-8 py-12 lg:grid-cols-[1.2fr_1fr]">
        <div className="h-[460px] animate-pulse rounded-lg bg-muted" />
        <div className="h-[560px] animate-pulse rounded-lg bg-muted" />
      </Container>
    </>
  )
}
