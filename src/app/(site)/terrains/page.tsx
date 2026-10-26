import { Suspense } from "react"
import type { Metadata } from "next"
import { formatNumber } from "@/lib/format"
import { computeLotStats, getPublicDocuments, getPublicLots } from "@/lib/queries/public"
import { getSettings } from "@/lib/settings"
import { Container, Eyebrow } from "@/components/site/section-heading"
import { PageBand } from "@/components/site/skeletons"
import { LotExplorer } from "@/components/site/explorer/lot-explorer"
import { DocumentsSection, FaqSection } from "@/components/site/info-sections"
import { Reveal } from "@/components/site/reveal"

export const metadata: Metadata = {
  title: "Nos terrains",
  description: "Plan interactif des terrains viabilisés : surface, prix, nature du sol, acompte et modalités de paiement de chaque lot. Réservez en ligne.",
  alternates: { canonical: "/terrains" },
}

export default function TerrainsPage({ searchParams }: PageProps<"/terrains">) {
  return (
    <Suspense
      fallback={
        <>
          <PageBand>
            <div className="h-4 w-40 animate-pulse rounded bg-gold/25" />
            <div className="mt-4 h-12 w-96 max-w-full animate-pulse rounded-md bg-white/10" />
          </PageBand>
          <Container className="py-10">
            <div className="h-[560px] animate-pulse rounded-lg bg-muted" />
          </Container>
        </>
      }
    >
      <TerrainsContent searchParams={searchParams} />
    </Suspense>
  )
}

async function TerrainsContent({ searchParams }: { searchParams: PageProps<"/terrains">["searchParams"] }) {
  const [{ settings: s, lots }, documents, full, sp] = await Promise.all([getPublicLots(), getPublicDocuments(), getSettings(), searchParams])
  const stats = computeLotStats(lots)
  const param = (key: string) => (typeof sp[key] === "string" ? (sp[key] as string) : undefined)
  return (
    <>
      <PageBand>
        <Reveal className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <Eyebrow tone="light">Nos terrains</Eyebrow>
            <h1 className="mt-3 font-display text-[2.3rem] leading-[1.08] font-semibold tracking-tight sm:text-5xl">Choisissez votre terrain sur le plan</h1>
            <p className="mt-4 text-white/75">
              Survolez le plan, filtrez selon votre budget et ouvrez la fiche de chaque lot : surface, prix, nature du sol, acompte et modalités de paiement.
            </p>
          </div>
          <dl className="flex gap-8">
            <div>
              <dd className="font-display text-4xl font-semibold text-gold tabular">{formatNumber(stats.byStatus.AVAILABLE)}</dd>
              <dt className="text-sm text-white/70">disponibles</dt>
            </div>
            <div>
              <dd className="font-display text-4xl font-semibold tabular">{formatNumber(stats.forSale)}</dd>
              <dt className="text-sm text-white/70">terrains au total</dt>
            </div>
          </dl>
        </Reveal>
      </PageBand>

      <section id="plan" className="scroll-mt-20 py-10 sm:py-14">
        <Container>
          <div id="terrains" className="scroll-mt-24">
            <LotExplorer
              lots={lots}
              blocks={stats.blocks}
              initialLotNumber={param("lot") ?? null}
              initialFilters={{ status: param("statut"), area: param("surface"), budget: param("budget"), block: param("ilot") }}
              settings={{
                planImageUrl: s.planImageUrl,
                planWidth: s.planWidth,
                planHeight: s.planHeight,
                currencyLabel: s.currencyLabel,
                showPricesPublicly: s.showPricesPublicly,
                reservationsOpen: s.reservationsOpen,
                companyName: s.companyName,
                companyWhatsapp: s.companyWhatsapp,
              }}
            />
          </div>
        </Container>
      </section>

      <DocumentsSection documents={documents} />
      <FaqSection faq={full.faq} />
    </>
  )
}
