import Link from "next/link"
import { formatDateLong } from "@/lib/format"
import type { PublicMedia, PublicUpdate } from "@/lib/queries/public"
import { Container, SectionHeading, SectionLink } from "@/components/site/section-heading"
import { Carousel } from "@/components/site/carousel"
import { MediaFallback, MediaView } from "@/components/site/media"
import { Reveal } from "@/components/site/reveal"
import { frenchText } from "@/components/site/typography"

/** Avancement (accueil) : carrousel des dernières actualités du chantier. */
export function ProgressShowcase({ updates }: { updates: PublicUpdate[] }) {
  const items = updates.map((update) => ({ update, media: update.media.find((m) => m.type === "IMAGE") ?? update.media[0] ?? null }))
  return (
    <section id="avancement" className="scroll-mt-20 py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="Avancement du projet"
          title="Un projet qui avance, en toute transparence"
          description="Suivez les grandes étapes de la viabilisation de notre domaine. Nous partageons régulièrement des photos, des vidéos et des actualités pour vous tenir informé."
          action={<SectionLink href="/avancement">Voir toutes les actualités</SectionLink>}
        />
        {items.length > 0 ? (
          <Carousel
            label="Actualités du chantier"
            arrows="sides"
            className="mt-10"
            itemClassName="w-[78%] sm:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-3.75rem)/4)]"
          >
            {items.map(({ update, media }, i) => (
              <ProgressCard key={update.id} update={update} media={media} index={i} />
            ))}
          </Carousel>
        ) : (
          <p className="mt-10 rounded-lg border border-dashed bg-card p-10 text-center text-muted-foreground">Les premières actualités du chantier arrivent bientôt.</p>
        )}
      </Container>
    </section>
  )
}

function ProgressCard({ update, media, index }: { update: PublicUpdate; media: PublicMedia | null; index: number }) {
  return (
    <Reveal delay={index * 0.05} className="group h-full overflow-hidden rounded-lg border bg-card shadow-xs transition-shadow duration-300 hover:shadow-[0_24px_50px_-28px_rgb(0_0_0/0.4)]">
      <Link href={`/avancement#${update.id}`} className="block h-full">
        <div className="aspect-[4/3] overflow-hidden bg-muted">
          {media ? (
            <MediaView media={media} controls={false} className="transition-transform duration-700 group-hover:scale-[1.04]" />
          ) : (
            <MediaFallback label={update.milestone} />
          )}
        </div>
        <div className="p-4">
          <p className="leading-snug font-semibold transition-colors group-hover:text-primary">{frenchText(update.title)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{formatDateLong(update.publishedAt)}</p>
        </div>
      </Link>
    </Reveal>
  )
}
