import { Suspense } from "react"
import type { Metadata } from "next"
import { Check, HardHat, Lock, Newspaper, Pin } from "lucide-react"
import { requireBuyer } from "@/lib/auth/client"
import { getOwnerUpdates, getWorksProgress } from "@/lib/queries/portal"
import { formatDate, formatDateLong, formatMonth } from "@/lib/format"
import { MILESTONE_STATUS } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { ToneBadge } from "@/components/shared/badges"
import { PageTitle, PortalCard } from "@/components/portal/card"
import { MediaGallery } from "@/components/portal/media-gallery"
import { ProgressRing } from "@/components/portal/progress-ring"

export const metadata: Metadata = { title: "Avancement du chantier" }

export default function ProgressPage() {
  return (
    <>
      <PageTitle title="Avancement du chantier" description="Suivez étape par étape la viabilisation de votre site." />
      <Suspense fallback={<ProgressSkeleton />}>
        <ProgressContent />
      </Suspense>
    </>
  )
}

async function ProgressContent() {
  await requireBuyer()
  const [works, updates] = await Promise.all([getWorksProgress(), getOwnerUpdates()])
  const current = works.milestones.find((m) => m.status === "IN_PROGRESS")

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[1.75rem] bg-pine-deep p-5 text-white sm:p-7">
        <div aria-hidden className="absolute -right-10 -bottom-24 size-72 rounded-full bg-gold/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <ProgressRing value={works.overall / 100} size={128} stroke={11}>
            <span>
              <span className="block text-3xl font-extrabold tabular">{works.overall}%</span>
              <span className="block text-[0.62rem] font-semibold tracking-wide text-white/60 uppercase">réalisé</span>
            </span>
          </ProgressRing>
          <div className="flex-1">
            <p className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">Viabilisation du site</p>
            <p className="mt-1 text-xl font-bold sm:text-2xl">
              {works.done} étape{works.done > 1 ? "s" : ""} terminée{works.done > 1 ? "s" : ""} sur {works.milestones.length}
            </p>
            {current && (
              <p className="mt-1 text-sm text-white/70">
                En cours : <span className="font-semibold text-white">{current.title}</span> ({current.progress}%)
              </p>
            )}
            <div className="mt-4 flex gap-1.5">
              {works.milestones.map((m) => (
                <span
                  key={m.id}
                  title={m.title}
                  className={cn(
                    "h-2 flex-1 overflow-hidden rounded-full bg-white/12",
                  )}
                >
                  <span className="block h-full rounded-full bg-gold" style={{ width: `${m.progress}%` }} />
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <PortalCard title="Étapes des travaux" icon={HardHat} className="lg:sticky lg:top-24 lg:col-span-2 lg:self-start">
          <ol className="relative">
            {works.milestones.map((m, i) => {
              const last = i === works.milestones.length - 1
              return (
                <li key={m.id} className="relative flex gap-4 pb-6 last:pb-0">
                  {!last && <span aria-hidden className={cn("absolute top-8 bottom-0 left-[15px] w-0.5", m.status === "DONE" ? "bg-status-available/60" : "bg-border")} />}
                  <span
                    className={cn(
                      "relative z-10 grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ring-4 ring-card",
                      m.status === "DONE" && "bg-status-available text-white",
                      m.status === "IN_PROGRESS" && "bg-gold text-gold-foreground",
                      m.status === "PLANNED" && "border-2 border-dashed border-border bg-card text-muted-foreground",
                    )}
                  >
                    {m.status === "DONE" ? <Check className="size-4" strokeWidth={3} /> : i + 1}
                    {m.status === "IN_PROGRESS" && <span className="absolute inset-0 animate-ping rounded-full bg-gold/40" />}
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="font-semibold">{m.title}</p>
                      <ToneBadge tone={MILESTONE_STATUS[m.status].tone} className="h-5 px-2 text-[0.68rem]">
                        {MILESTONE_STATUS[m.status].label}
                      </ToneBadge>
                    </div>
                    {m.description && <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>}
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full", m.status === "DONE" ? "bg-status-available" : "bg-gold")}
                          style={{ width: `${m.progress}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-xs font-bold tabular">{m.progress}%</span>
                    </div>
                    {(m.startDate || m.endDate) && (
                      <p className="mt-1.5 text-xs text-muted-foreground first-letter:uppercase">
                        {m.startDate && formatMonth(m.startDate)}
                        {m.startDate && m.endDate && " → "}
                        {m.endDate && `${m.status === "DONE" ? "" : "prévu "}${formatMonth(m.endDate)}`}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </PortalCard>

        <div className="space-y-5 lg:col-span-3">
          <h2 className="flex items-center gap-2 text-[0.95rem] font-bold">
            <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
              <Newspaper className="size-4" />
            </span>
            Actualités du chantier
          </h2>
          {updates.length === 0 ? (
            <p className="rounded-3xl border bg-card p-8 text-center text-sm text-muted-foreground">Aucune actualité publiée pour le moment.</p>
          ) : (
            updates.map((u) => (
              <article key={u.id} className="overflow-hidden rounded-3xl border bg-card shadow-xs">
                <div className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <time dateTime={u.publishedAt.toISOString()} className="font-semibold text-muted-foreground" title={formatDateLong(u.publishedAt)}>
                      {formatDate(u.publishedAt)}
                    </time>
                    {u.pinned && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 font-semibold text-gold-strong">
                        <Pin className="size-3" />À la une
                      </span>
                    )}
                    {u.visibility === "CLIENTS" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                        <Lock className="size-3" />
                        Réservé aux propriétaires
                      </span>
                    )}
                    {u.milestone && <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">{u.milestone.title}</span>}
                  </div>
                  <h3 className="text-lg leading-snug font-bold">{u.title}</h3>
                  <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{u.body}</p>
                </div>
                {u.media.length > 0 && (
                  <div className="px-5 pb-5">
                    <MediaGallery media={u.media.map((m) => ({ id: m.id, type: m.type, url: m.url, caption: m.caption }))} />
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function ProgressSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-44 rounded-[1.75rem]" />
      <div className="grid gap-6 lg:grid-cols-5">
        <Skeleton className="h-[520px] rounded-3xl lg:col-span-2" />
        <div className="space-y-5 lg:col-span-3">
          <Skeleton className="h-56 rounded-3xl" />
          <Skeleton className="h-56 rounded-3xl" />
        </div>
      </div>
    </div>
  )
}
