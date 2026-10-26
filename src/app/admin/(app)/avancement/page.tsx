import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { CheckCircle2, CircleDot, ExternalLink, HardHat, Newspaper } from "lucide-react"
import { db } from "@/lib/db"
import { hasRole, requireAdmin } from "@/lib/auth/admin"
import { formatDateLong } from "@/lib/format"
import { PageHeader } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { MilestonesPanel } from "@/components/admin/progress/milestones-panel"
import { UpdatesPanel } from "@/components/admin/progress/updates-panel"

export const metadata: Metadata = { title: "Avancement du chantier" }

export default function ProgressPage() {
  return (
    <>
      <PageHeader
        title="Avancement du chantier"
        description="Tenez vos clients informés : étapes de viabilisation, photos, vidéos et nouvelles du site."
        actions={
          <Button variant="outline" size="sm" className="h-9" asChild>
            <Link href="/#avancement" target="_blank">
              <ExternalLink /> Voir sur le site
            </Link>
          </Button>
        }
      />
      <Suspense
        fallback={
          <div className="space-y-6">
            <Skeleton className="h-36 rounded-2xl" />
            <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <Skeleton className="h-[480px] rounded-2xl" />
              <Skeleton className="h-[480px] rounded-2xl" />
            </div>
          </div>
        }
      >
        <ProgressContent />
      </Suspense>
    </>
  )
}

async function ProgressContent() {
  const admin = await requireAdmin()
  const [milestones, updates] = await Promise.all([
    db.milestone.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.siteUpdate.findMany({
      orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
      include: { milestone: { select: { title: true } }, media: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    }),
  ])
  const canEdit = hasRole(admin, "ADMIN")
  const overall = milestones.length ? Math.round(milestones.reduce((s, m) => s + m.progress, 0) / milestones.length) : 0
  const done = milestones.filter((m) => m.status === "DONE").length
  const current = milestones.filter((m) => m.status === "IN_PROGRESS")
  const lastUpdate = updates.reduce<Date | null>((d, u) => (!d || u.publishedAt > d ? u.publishedAt : d), null)

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-pine-deep p-5 text-white shadow-sm md:p-7">
        <div aria-hidden className="absolute -top-20 -right-16 size-64 rounded-full bg-gold/15 blur-3xl" />
        <div className="relative grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
          <div className="relative grid size-32 place-items-center">
            <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="10" />
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--gold)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(overall / 100) * 326.7} 326.7`} />
            </svg>
            <div className="text-center">
              <p className="text-3xl font-extrabold tabular">{overall}%</p>
              <p className="text-[0.65rem] tracking-widest text-white/60 uppercase">global</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-gold">
                <HardHat className="size-4" /> Viabilisation du site
              </p>
              <p className="mt-1 text-2xl font-bold">
                {done} étape{done > 1 ? "s" : ""} terminée{done > 1 ? "s" : ""} sur {milestones.length}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {current.map((m) => (
                <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm">
                  <CircleDot className="size-3.5 text-gold" />
                  {m.title} · {m.progress}%
                </span>
              ))}
              {current.length === 0 && done === milestones.length && milestones.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm">
                  <CheckCircle2 className="size-3.5 text-gold" /> Toutes les étapes sont terminées
                </span>
              )}
            </div>
            <p className="flex items-center gap-1.5 text-sm text-white/65">
              <Newspaper className="size-4" />
              {updates.length} actualité{updates.length > 1 ? "s" : ""}
              {lastUpdate ? ` · dernière publication le ${formatDateLong(lastUpdate)}` : ""}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:items-start">
        <MilestonesPanel milestones={milestones} canEdit={canEdit} />
        <UpdatesPanel
          canEdit={canEdit}
          milestones={milestones.map((m) => ({ id: m.id, title: m.title }))}
          updates={updates.map((u) => ({
            id: u.id,
            title: u.title,
            body: u.body,
            visibility: u.visibility,
            pinned: u.pinned,
            milestoneId: u.milestoneId,
            milestoneTitle: u.milestone?.title ?? null,
            publishedAt: u.publishedAt,
            media: u.media.map((m) => ({ id: m.id, type: m.type, url: m.url, caption: m.caption, size: m.size })),
          }))}
        />
      </div>
    </div>
  )
}
