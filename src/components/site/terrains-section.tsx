import type { PlanLot } from "@/components/plan/plan-viewer"
import { Container, SectionHeading, SectionLink } from "@/components/site/section-heading"
import { Carousel } from "@/components/site/carousel"
import { FeaturedLotCard, pickFeaturedLots } from "@/components/site/featured-lots"
import { LotFilterBar } from "@/components/site/lot-filter-bar"
import { Reveal } from "@/components/site/reveal"
import { areaRanges, budgetRanges, type PublicLot } from "@/components/site/lot-utils"

export function TerrainsSection({
  lots,
  photos,
  plan,
  currency,
  showPrices,
}: {
  lots: PublicLot[]
  photos: string[]
  plan: { imageUrl: string | null; width: number; height: number }
  currency: string
  showPrices: boolean
}) {
  const featured = pickFeaturedLots(lots, 6)
  const planLots: PlanLot[] = lots
  return (
    <section id="terrains" className="scroll-mt-20 bg-sand py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="Nos terrains"
          title="Trouvez le terrain qui vous correspond"
          description="Des terrains de différentes superficies et des prix adaptés à votre projet."
          action={<SectionLink href="/terrains">Voir le plan complet</SectionLink>}
        />
        <Reveal className="mt-8" y={20}>
          <LotFilterBar areas={areaRanges(lots)} budgets={showPrices ? budgetRanges(lots, currency) : []} />
        </Reveal>
        {featured.length > 0 ? (
          <Carousel label="Terrains disponibles" className="mt-8" itemClassName="w-[84%] sm:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-2.5rem)/3)]">
            {featured.map((lot, i) => (
              <FeaturedLotCard
                key={lot.id}
                lot={lot}
                index={i}
                photo={photos.length ? photos[i % photos.length] : null}
                plan={plan}
                planLots={planLots}
                currency={currency}
              />
            ))}
          </Carousel>
        ) : (
          <p className="mt-8 rounded-lg border bg-card p-8 text-center text-muted-foreground">
            Tous les terrains sont actuellement réservés ou vendus. Contactez-nous pour être informé des prochaines disponibilités.
          </p>
        )}
      </Container>
    </section>
  )
}
