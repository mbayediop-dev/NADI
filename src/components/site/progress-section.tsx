import Link from "next/link"
import { ArrowRight, CheckCircle2, CircleDashed, LoaderCircle } from "lucide-react"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { PublicMilestone, PublicUpdate } from "@/lib/queries/public"
import { Button } from "@/components/ui/button"
import { Container, SectionHeading } from "@/components/site/section-heading"
import { Reveal } from "@/components/site/reveal"
import { UpdateCard } from "@/components/site/update-card"

export function ProgressRing({ value, size = 132, className }: { value: number; size?: number; className?: string }) {
  const r = 52
  const c = 2 * Math.PI * r
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeOpacity={0.12} strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="var(--gold)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(100, Math.max(0, value)) / 100)}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display text-3xl font-medium tabular">{value}%</p>
          <p className="text-[0.65rem] font-semibold tracking-[0.16em] uppercase opacity-60">réalisé</p>
        </div>
      </div>
    </div>
  )
}

const STATUS_ICON = { DONE: CheckCircle2, IN_PROGRESS: LoaderCircle, PLANNED: CircleDashed }
const STATUS_LABEL = { DONE: "Terminé", IN_PROGRESS: "En cours", PLANNED: "À venir" }

export function MilestoneTimeline({ milestones, tone = "dark" }: { milestones: PublicMilestone[]; tone?: "dark" | "light" }) {
  const dark = tone === "dark"
  return (
    <ol className="relative space-y-1">
      {milestones.map((m, i) => {
        const Icon = STATUS_ICON[m.status]
        return (
          <Reveal as="li" key={m.id} delay={i * 0.04} className="relative flex gap-4 pb-5 last:pb-0">
            {i < milestones.length - 1 && (
              <span aria-hidden className={cn("absolute top-9 bottom-0 left-[17px] w-px", dark ? "bg-white/12" : "bg-border")} />
            )}
            <span
              className={cn(
                "relative z-10 grid size-9 shrink-0 place-items-center rounded-full",
                m.status === "DONE" && "bg-status-available text-white",
                m.status === "IN_PROGRESS" && "bg-gold text-gold-foreground",
                m.status === "PLANNED" && (dark ? "bg-white/10 text-white/60" : "bg-muted text-muted-foreground"),
              )}
            >
              <Icon className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className={cn("font-semibold", dark ? "text-white" : "text-foreground")}>{m.title}</p>
                <p className={cn("text-xs font-semibold tabular", dark ? "text-white/60" : "text-muted-foreground")}>
                  {STATUS_LABEL[m.status]} · {m.progress}%
                </p>
              </div>
              {m.description && <p className={cn("mt-1 text-sm", dark ? "text-white/55" : "text-muted-foreground")}>{m.description}</p>}
              <div className={cn("mt-2.5 h-1.5 overflow-hidden rounded-full", dark ? "bg-white/10" : "bg-muted")}>
                <div
                  className={cn("h-full rounded-full", m.status === "DONE" ? "bg-status-available" : "bg-gold")}
                  style={{ width: `${m.progress}%` }}
                />
              </div>
              {(m.startDate || m.endDate) && (
                <p className={cn("mt-1.5 text-xs", dark ? "text-white/40" : "text-muted-foreground")}>
                  {m.startDate ? formatDate(m.startDate, "MMM yyyy") : "…"} → {m.endDate ? formatDate(m.endDate, "MMM yyyy") : "…"}
                </p>
              )}
            </div>
          </Reveal>
        )
      })}
    </ol>
  )
}

export function ProgressSection({
  overall,
  milestones,
  updates,
}: {
  overall: number
  milestones: PublicMilestone[]
  updates: PublicUpdate[]
}) {
  if (milestones.length === 0 && updates.length === 0) return null
  const [featured, ...others] = updates
  return (
    <section id="avancement" className="relative scroll-mt-20 overflow-hidden bg-pine-deep py-20 text-white sm:py-28">
      <div aria-hidden className="bg-grain pointer-events-none absolute inset-0 opacity-60" />
      <div aria-hidden className="pointer-events-none absolute top-0 -left-40 size-[520px] rounded-full bg-primary/40 blur-[120px]" />
      <Container className="relative">
        <SectionHeading
          tone="light"
          eyebrow="Avancement des travaux"
          title="Le chantier avance, suivez-le en toute transparence."
          description="Chaque étape de la viabilisation est documentée : photos, vidéos et comptes rendus réguliers."
          action={
            milestones.length > 0 ? (
              <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.05] p-4 pr-6">
                <ProgressRing value={overall} size={104} />
                <div>
                  <p className="text-sm font-semibold">Avancement global</p>
                  <p className="text-xs text-white/60">
                    {milestones.filter((m) => m.status === "DONE").length} étape(s) terminée(s) sur {milestones.length}
                  </p>
                </div>
              </div>
            ) : undefined
          }
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          {milestones.length > 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-7">
              <MilestoneTimeline milestones={milestones} />
            </div>
          )}
          {featured && (
            <Reveal delay={0.1} className="flex">
              <UpdateCard update={featured} featured />
            </Reveal>
          )}
        </div>

        {others.length > 0 && (
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {others.slice(0, 3).map((u, i) => (
              <Reveal as="li" key={u.id} delay={i * 0.06} className={i > 0 ? "hidden sm:block" : undefined}>
                <UpdateCard update={u} />
              </Reveal>
            ))}
          </ul>
        )}

        <div className="mt-10 text-center">
          <Button asChild variant="outline" className="h-11 rounded-full border-white/25 bg-white/5 px-6 text-white hover:bg-white/10 hover:text-white">
            <Link href="/avancement">
              Toutes les actualités du chantier
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </Container>
    </section>
  )
}
