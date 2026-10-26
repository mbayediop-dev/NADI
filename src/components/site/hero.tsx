import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Check, ChevronRight, Landmark } from "lucide-react"
import { formatHectares, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { PlanLot } from "@/components/plan/plan-viewer"
import { Button } from "@/components/ui/button"
import { MiniPlan } from "@/components/site/mini-plan"
import { Reveal } from "@/components/site/reveal"
import { Container } from "@/components/site/section-heading"
import { frenchText } from "@/components/site/typography"

/** « Construisez votre avenir | sur un domaine d'exception » → titre principal + seconde ligne plus discrète */
function splitTitle(title: string): { main: string; tail: string | null } {
  const [main, ...rest] = title.split("|")
  if (rest.length > 0) return { main: main.trim(), tail: rest.join("|").trim() || null }
  const sentences = title
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (sentences.length > 1) return { main: sentences[0], tail: sentences.slice(1).join(" ") }
  return { main: title.trim(), tail: null }
}

type HeroProps = {
  eyebrow: string
  title: string
  subtitle: string
  imageUrl: string | null
  /** Vignettes affichées à côté de l'encart « Un cadre de vie idéal » */
  thumbnails: string[]
  /** Équipements listés dans l'encart */
  amenities: string[]
  areaM2: number
  lotCount: number
  plan: { imageUrl: string | null; width: number; height: number }
  lots: PlanLot[]
}

export function Hero({ eyebrow, title, subtitle, imageUrl, thumbnails, amenities, areaM2, lotCount, plan, lots }: HeroProps) {
  const { main, tail } = splitTitle(title)
  const stats = [
    { value: formatHectares(areaM2), label: "Superficie totale" },
    { value: formatNumber(lotCount), label: "Terrains aménagés" },
    { value: "100 %", label: "Viabilisés à terme" },
  ]

  return (
    <section className="relative isolate overflow-hidden bg-background">
      {/* Photo aérienne en pleine largeur, voilée à gauche pour le texte */}
      <div aria-hidden className="absolute inset-0 -z-10">
        {imageUrl ? (
          <Image
            src={imageUrl}
            unoptimized={imageUrl.endsWith(".svg")}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[68%_center] lg:object-[80%_center]"
          />
        ) : (
          <MiniPlan {...plan} lots={lots} className="absolute inset-0 size-full opacity-80" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-background from-40% via-background/85 to-background/25 lg:bg-gradient-to-r lg:from-background lg:from-28% lg:via-background/88 lg:via-50% lg:to-background/0 lg:to-88%" />
      </div>

      <Container>
        <div className="grid gap-10 py-14 sm:py-20 lg:min-h-[660px] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-end lg:py-24">
          <div>
            {eyebrow && (
              <Reveal>
                <p className="text-[0.72rem] font-bold tracking-[0.22em] text-foreground/70 uppercase">{frenchText(eyebrow)}</p>
              </Reveal>
            )}
            <Reveal delay={0.05}>
              <h1 className="mt-4 max-w-xl font-display text-[2.75rem] leading-[1.02] font-semibold tracking-tight text-balance text-pine-deep sm:text-[3.6rem] lg:text-[4.2rem]">
                {frenchText(main)}
              </h1>
              {tail && (
                <p className="mt-2 font-display text-[1.55rem] leading-tight font-semibold text-pine-deep sm:text-[2rem] lg:text-[2.25rem]">{frenchText(tail)}</p>
              )}
            </Reveal>
            {subtitle && (
              <Reveal delay={0.1}>
                <p className="mt-6 max-w-lg text-base leading-relaxed text-pretty text-foreground/80 sm:text-[1.05rem]">{frenchText(subtitle)}</p>
              </Reveal>
            )}
            <Reveal delay={0.15} className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-md bg-pine-deep px-6 text-[0.95rem] font-semibold text-white shadow-[0_14px_30px_-14px_oklch(0.288_0.053_169/0.8)] hover:bg-pine-deep/90"
              >
                <Link href="/terrains">
                  Découvrir les terrains
                  <ArrowRight />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-md border-pine-deep/25 bg-card/85 px-6 text-[0.95rem] font-semibold text-pine-deep backdrop-blur hover:bg-card hover:text-pine-deep"
              >
                <Link href="/#avancement">
                  Voir l&apos;avancement
                  <ChevronRight />
                </Link>
              </Button>
            </Reveal>

            <Reveal delay={0.2} className="mt-10 max-w-2xl">
              <ul className="grid grid-cols-2 gap-x-6 gap-y-6 sm:flex sm:flex-wrap sm:items-center sm:gap-0 sm:divide-x sm:divide-border">
                {stats.map((s) => (
                  <li key={s.label} className="sm:px-6 sm:first:pl-0">
                    <p className="font-display text-[1.9rem] leading-none font-semibold text-pine-deep tabular sm:text-[2.1rem]">{s.value}</p>
                    <p className="mt-1.5 text-xs text-muted-foreground sm:text-[0.8rem]">{s.label}</p>
                  </li>
                ))}
                <li className="flex items-center gap-3 sm:pl-6">
                  <span className="grid size-11 shrink-0 place-items-center rounded-md border border-border bg-card text-pine-deep shadow-xs">
                    <Landmark className="size-5" strokeWidth={1.6} />
                  </span>
                  <p className="text-sm leading-snug">
                    <span className="block font-semibold">Cadre sécurisé</span>
                    <span className="text-muted-foreground">et bien situé</span>
                  </p>
                </li>
              </ul>
            </Reveal>
          </div>

          {amenities.length > 0 && (
            <Reveal delay={0.25} y={24} className="flex items-end gap-4 lg:justify-self-end">
              <div className="w-full max-w-sm rounded-lg border border-border/70 bg-card p-5 shadow-[0_28px_60px_-28px_rgb(0_0_0/0.4)] sm:p-6">
                <p className="font-semibold">Un cadre de vie idéal</p>
                <ul className="mt-3 space-y-2.5">
                  {amenities.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm leading-snug text-foreground/85">
                      <Check className="mt-0.5 size-4 shrink-0 text-gold-strong" strokeWidth={3} />
                      {frenchText(item)}
                    </li>
                  ))}
                </ul>
              </div>
              {thumbnails.length > 0 && (
                <div className="hidden shrink-0 items-end gap-2 sm:flex">
                  {thumbnails.map((src, i) => (
                    <span key={src} className={cn("relative block size-[4.5rem] overflow-hidden rounded-md border-[3px] border-white bg-muted shadow-lg", i === 1 && "mb-7")}>
                      <Image src={src} unoptimized={src.endsWith(".svg")} alt="" fill sizes="72px" className="object-cover" />
                    </span>
                  ))}
                </div>
              )}
            </Reveal>
          )}
        </div>
      </Container>
    </section>
  )
}
