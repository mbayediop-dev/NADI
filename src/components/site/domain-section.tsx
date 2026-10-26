import { Route, ShieldCheck, Sparkles, TreePine, TrendingUp, type LucideIcon } from "lucide-react"
import { formatHectares, formatNumber } from "@/lib/format"
import type { PlanLot } from "@/components/plan/plan-viewer"
import { Container, Eyebrow } from "@/components/site/section-heading"
import { DomainPlan } from "@/components/site/domain-plan"
import { Reveal } from "@/components/site/reveal"
import { RichText } from "@/components/site/rich-text"
import { frenchText } from "@/components/site/typography"

const ICONS: LucideIcon[] = [Route, TreePine, ShieldCheck, TrendingUp]

export function DomainSection({
  description,
  areaM2,
  lotCount,
  highlights,
  plan,
  lots,
  currency,
}: {
  description: string
  areaM2: number
  lotCount: number
  /** Points forts du domaine (Paramètres → Site), 4 au maximum */
  highlights: { title: string; text: string }[]
  plan: { imageUrl: string | null; width: number; height: number }
  lots: PlanLot[]
  currency: string
}) {
  return (
    <section id="domaine" className="scroll-mt-20 py-20 sm:py-24">
      <Container className="grid items-center gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
        <Reveal className="min-w-0">
          <Eyebrow>Le domaine</Eyebrow>
          <h2 className="mt-3 font-display text-[2.1rem] leading-[1.1] font-semibold tracking-tight text-balance sm:text-[2.6rem]">Un emplacement stratégique</h2>
          <div className="mt-5 space-y-4 leading-relaxed text-muted-foreground">
            <RichText text={description} />
          </div>
          {highlights.length > 0 && (
            <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
              {highlights.slice(0, 4).map((item, i) => {
                const Icon = ICONS[i] ?? Sparkles
                return (
                  <li key={item.title} className="flex items-center gap-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-card text-pine-deep shadow-xs">
                      <Icon className="size-5" strokeWidth={1.6} />
                    </span>
                    <div>
                      <p className="font-semibold">{frenchText(item.title)}</p>
                      {item.text && <p className="text-sm text-muted-foreground">{frenchText(item.text)}</p>}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Reveal>
        <Reveal delay={0.08} y={24} className="min-w-0">
          <DomainPlan {...plan} lots={lots} currency={currency} caption={`${formatHectares(areaM2)} – ${formatNumber(lotCount)} terrains`} />
        </Reveal>
      </Container>
    </section>
  )
}
