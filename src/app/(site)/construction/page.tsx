import { Suspense } from "react"
import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, BedDouble, Layers, PencilRuler, Ruler } from "lucide-react"
import { BRAND } from "@/lib/brand"
import { formatArea, formatMoney } from "@/lib/format"
import { getHouseModels } from "@/lib/queries/construction"
import { getSettings } from "@/lib/settings"
import { Container, Eyebrow, SectionHeading } from "@/components/site/section-heading"
import { CONSTRUCTION_GALLERY, CONSTRUCTION_HERO, SITUATIONS, TRANSPARENCY } from "@/components/site/construction-section"
import { ConstructionRequestForm } from "@/components/site/construction-request-form"
import { Reveal } from "@/components/site/reveal"

export const metadata: Metadata = {
  title: "Construction de maisons",
  description: `${BRAND.name} construit votre maison sur votre terrain, dans notre lotissement ou ailleurs : offre détaillée, chantier suivi en photos, versements et dépenses consultables en ligne.`,
  alternates: { canonical: "/construction" },
}

const STEPS = [
  { title: "Votre demande", text: "Vous décrivez votre projet : terrain, type de maison, budget. C'est gratuit et sans engagement." },
  { title: "Étude et offre", text: "Nous visitons le terrain, proposons un plan (modèle ou sur mesure) et vous remettons une offre détaillée." },
  { title: "Contrat et échéancier", text: "Vous acceptez l'offre : le prix est fixé et le paiement est réparti en appels de fonds liés à l'avancement." },
  { title: "Chantier suivi en ligne", text: "Étapes, photos, versements et dépenses : tout est consultable dans votre espace client." },
  { title: "Remise des clés", text: "Nous vérifions ensemble la maison terminée et vous remettons vos clés et vos documents." },
]

export default function ConstructionPage({ searchParams }: PageProps<"/construction">) {
  return (
    <Suspense fallback={<div className="min-h-[70vh] animate-pulse bg-muted/40" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  )
}

async function Content({ searchParams }: { searchParams: PageProps<"/construction">["searchParams"] }) {
  const [sp, settings, models] = await Promise.all([searchParams, getSettings(), getHouseModels({ publishedOnly: true })])
  // « Demander ce modèle » : le modèle choisi est présélectionné dans le formulaire
  const wanted = typeof sp.modele === "string" && models.some((m) => m.id === sp.modele) ? sp.modele : undefined
  const company = settings.companyName
  const currency = settings.currencyLabel
  const heroImage = models.find((m) => m.images.length)?.images[0] ?? CONSTRUCTION_HERO
  const modelDetail = (m: (typeof models)[number]) =>
    [m.levels, m.bedrooms ? `${m.bedrooms} chambre${m.bedrooms > 1 ? "s" : ""}` : null, m.livingAreaM2 ? formatArea(m.livingAreaM2) : null].filter(Boolean).join(" · ")

  return (
    <>
      {/* En-tête */}
      <section className="relative isolate overflow-hidden bg-pine-deep text-white">
        <div aria-hidden className="bg-grain pointer-events-none absolute inset-0 -z-10 opacity-60" />
        <Container className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16 lg:py-24">
          <Reveal>
            <Eyebrow tone="light">Construction clés en main</Eyebrow>
            <h1 className="mt-4 font-display text-[2.4rem] leading-[1.05] font-semibold tracking-tight text-balance sm:text-[3.4rem]">
              Votre maison, construite en toute transparence
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-pretty text-white/80 sm:text-lg">
              {company} conçoit et bâtit votre maison : sur un terrain de notre lotissement, sur le vôtre, ou en vous aidant à trouver le bon terrain. Vous suivez le
              chantier, les versements et les dépenses depuis votre espace client.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="#demande"
                className="group inline-flex h-12 items-center gap-2 rounded-md bg-gold px-6 text-[0.95rem] font-semibold text-gold-foreground transition-opacity hover:opacity-90"
              >
                Demander une étude gratuite
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link href="#modeles" className="inline-flex h-12 items-center rounded-md border border-white/25 px-6 text-[0.95rem] font-semibold text-white transition-colors hover:bg-white/10">
                Voir nos plans
              </Link>
            </div>
          </Reveal>
          <Reveal delay={0.1} className="min-w-0">
            <div className="relative mx-auto aspect-[4/5] max-w-sm overflow-hidden rounded-lg bg-white/5 shadow-[0_40px_90px_-40px_rgb(0_0_0/0.8)] lg:max-w-none">
              <Image src={heroImage} alt="Perspective d'un projet de construction" fill priority sizes="(min-width: 1024px) 45vw, 90vw" className="object-cover" />
            </div>
          </Reveal>
        </Container>
      </section>

      {/* Trois situations */}
      <section className="py-20 sm:py-24">
        <Container>
          <SectionHeading eyebrow="Pour qui ?" title="Avec ou sans terrain, nous construisons pour vous" description="Trois situations, la même exigence de qualité et de suivi." />
          <ul className="mt-10 grid gap-4 md:grid-cols-3">
            {SITUATIONS.map((item, i) => (
              <Reveal as="li" key={item.title} delay={i * 0.05} className="rounded-lg border bg-card p-6 shadow-xs">
                <span className="grid size-12 place-items-center rounded-full bg-sand text-pine-deep">
                  <item.icon className="size-5" strokeWidth={1.7} />
                </span>
                <p className="mt-5 text-lg font-semibold">{item.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
              </Reveal>
            ))}
          </ul>
        </Container>
      </section>

      {/* Modèles et plans */}
      <section id="modeles" className="scroll-mt-20 bg-sand py-20 sm:py-24">
        <Container>
          <SectionHeading
            eyebrow="Nos plans"
            title="Un modèle à adapter, ou un plan sur mesure"
            description="Partez d'un de nos plans, à ajuster à votre terrain et à votre budget, ou confiez-nous le dessin de votre maison."
          />
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {models.map((model, i) => (
              <Reveal as="li" key={model.id} delay={i * 0.05} className="flex flex-col overflow-hidden rounded-lg border bg-card shadow-xs">
                <div className="relative aspect-[4/3] bg-muted">
                  {model.images[0] && <Image src={model.images[0]} alt={model.name} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-lg font-semibold">{model.name}</p>
                  {model.tagline && <p className="mt-1 text-sm text-muted-foreground">{model.tagline}</p>}
                  <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-foreground/80">
                    {model.levels && (
                      <span className="inline-flex items-center gap-1.5">
                        <Layers className="size-4 text-gold-strong" />
                        {model.levels}
                      </span>
                    )}
                    {model.bedrooms != null && (
                      <span className="inline-flex items-center gap-1.5">
                        <BedDouble className="size-4 text-gold-strong" />
                        {model.bedrooms} chambre{model.bedrooms > 1 ? "s" : ""}
                      </span>
                    )}
                    {model.livingAreaM2 != null && (
                      <span className="inline-flex items-center gap-1.5">
                        <Ruler className="size-4 text-gold-strong" />
                        {formatArea(model.livingAreaM2)}
                      </span>
                    )}
                  </p>
                  {model.features.length > 0 && <p className="mt-3 text-sm text-muted-foreground">{model.features.slice(0, 4).join(" · ")}</p>}
                  <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                    <p className="text-sm">
                      {model.basePrice != null && settings.showPricesPublicly ? (
                        <>
                          <span className="text-muted-foreground">À partir de</span>
                          <span className="block text-lg font-bold tabular">{formatMoney(model.basePrice, currency)}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Prix sur étude</span>
                      )}
                    </p>
                    <Link href={`/construction?modele=${model.id}#demande`} className="group inline-flex items-center gap-1.5 text-sm font-semibold text-pine-deep hover:underline">
                      Demander ce modèle
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </div>
              </Reveal>
            ))}
            <Reveal as="li" delay={models.length * 0.05} className="flex flex-col justify-between rounded-lg border border-dashed border-pine-deep/30 bg-card p-6">
              <div>
                <span className="grid size-12 place-items-center rounded-full bg-pine-deep text-gold">
                  <PencilRuler className="size-5" strokeWidth={1.7} />
                </span>
                <p className="mt-5 text-lg font-semibold">Plan sur mesure</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Vous avez une idée précise, un croquis ou votre propre plan ? Nous dessinons la maison selon vos besoins, votre terrain et votre budget.
                </p>
              </div>
              <Link href="#demande" className="group mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-pine-deep hover:underline">
                Décrire mon projet
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Reveal>
          </ul>
        </Container>
      </section>

      {/* Déroulé */}
      <section className="py-20 sm:py-24">
        <Container>
          <SectionHeading eyebrow="Comment ça marche" title="De votre demande à la remise des clés" />
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((step, i) => (
              <Reveal as="li" key={step.title} delay={i * 0.05} className="relative rounded-lg border bg-card p-5 shadow-xs">
                <span className="font-display text-3xl font-semibold text-gold-strong tabular">{i + 1}</span>
                <p className="mt-3 font-semibold">{step.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
              </Reveal>
            ))}
          </ol>
        </Container>
      </section>

      {/* Transparence + chantiers en images */}
      <section className="bg-pine-deep py-20 text-white sm:py-24">
        <Container>
          <SectionHeading
            tone="light"
            eyebrow="Transparence"
            title="Tout voir, depuis votre espace client"
            description="Vous n'attendez pas la fin du chantier pour savoir où en est votre maison ni ce qui a été dépensé."
          />
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TRANSPARENCY.map((item, i) => (
              <Reveal as="li" key={item.title} delay={i * 0.05} className="rounded-lg border border-white/12 bg-white/[0.06] p-5">
                <item.icon className="size-6 text-gold" strokeWidth={1.7} />
                <p className="mt-4 font-semibold">{item.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-white/70">{item.text}</p>
              </Reveal>
            ))}
          </ul>
          <ul className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3">
            {CONSTRUCTION_GALLERY.map((photo, i) => (
              <Reveal as="li" key={photo.src} delay={i * 0.04} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-white/5">
                <Image src={photo.src} alt={photo.alt} fill sizes="(min-width: 768px) 33vw, 50vw" className="object-cover" />
              </Reveal>
            ))}
          </ul>
          <p className="mt-4 text-sm text-white/60">Photos de nos chantiers en cours.</p>
        </Container>
      </section>

      {/* Demande */}
      <section id="demande" className="scroll-mt-20 py-20 sm:py-24">
        <Container className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <Reveal>
            <Eyebrow>Votre projet</Eyebrow>
            <h2 className="mt-3 font-display text-[2rem] leading-[1.1] font-semibold tracking-tight text-balance sm:text-[2.55rem]">Demandez votre étude gratuite</h2>
            <p className="mt-5 leading-relaxed text-pretty text-muted-foreground">
              Décrivez-nous votre projet en quelques lignes. Un conseiller vous rappelle pour le préciser, puis nous vous remettons une offre détaillée, sans engagement.
            </p>
            <p className="mt-6 rounded-lg bg-sand p-5 text-sm leading-relaxed text-foreground/80">
              Déjà propriétaire d&apos;un terrain chez {company} ?{" "}
              <Link href="/espace-client/construction" className="font-semibold text-pine-deep underline underline-offset-4">
                Faites votre demande depuis votre espace client
              </Link>{" "}
              : elle sera directement rattachée à votre terrain.
            </p>
          </Reveal>
          <Reveal delay={0.08} className="rounded-lg border bg-card p-5 shadow-[0_30px_80px_-40px_rgb(0_0_0/0.3)] sm:p-8">
            <ConstructionRequestForm
              key={wanted ?? "libre"}
              defaultModelId={wanted}
              companyName={company}
              companyWhatsapp={settings.companyWhatsapp}
              currency={currency}
              models={models.map((m) => ({ id: m.id, name: m.name, detail: modelDetail(m) }))}
            />
          </Reveal>
        </Container>
      </section>
    </>
  )
}
