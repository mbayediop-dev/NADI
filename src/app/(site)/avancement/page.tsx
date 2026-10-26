import { Suspense } from "react"
import type { Metadata } from "next"
import { getPublicProgress } from "@/lib/queries/public"
import { getSettings } from "@/lib/settings"
import { Container } from "@/components/site/section-heading"
import { PageBand } from "@/components/site/skeletons"
import { MilestoneTimeline, ProgressRing } from "@/components/site/progress-section"
import { UpdateCard } from "@/components/site/update-card"
import { Eyebrow } from "@/components/site/section-heading"

export const metadata: Metadata = {
  title: "Avancement des travaux",
  description: "Suivez l'avancement de la viabilisation du lotissement : étapes, photos, vidéos et actualités du chantier.",
}

export default function ProgressPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageBand>
            <div className="h-12 w-80 animate-pulse rounded-md bg-white/10" />
          </PageBand>
          <Container className="py-12">
            <div className="h-96 animate-pulse rounded-lg bg-muted" />
          </Container>
        </>
      }
    >
      <ProgressContent />
    </Suspense>
  )
}

async function ProgressContent() {
  const [{ overall, milestones, updates }, settings] = await Promise.all([getPublicProgress(), getSettings()])
  return (
    <>
      <PageBand>
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <Eyebrow tone="light">{settings.siteName}</Eyebrow>
            <h1 className="mt-3 font-display text-4xl leading-tight font-medium sm:text-5xl">Avancement des travaux</h1>
            <p className="mt-3 text-white/70">
              Toutes les étapes de la viabilisation et les actualités du chantier, publiées au fil de l&apos;eau.
            </p>
          </div>
          {milestones.length > 0 && <ProgressRing value={overall} size={120} className="text-white" />}
        </div>
      </PageBand>
      <Container className="grid items-start gap-10 py-12 lg:grid-cols-[380px_1fr] lg:py-16">
        {milestones.length > 0 && (
          <aside className="rounded-lg border bg-card p-6 shadow-xs lg:sticky lg:top-24">
            <h2 className="mb-5 font-display text-xl">Étapes de viabilisation</h2>
            <MilestoneTimeline milestones={milestones} tone="light" />
          </aside>
        )}
        <div>
          <h2 className="mb-5 font-display text-2xl">Actualités du chantier</h2>
          {updates.length === 0 ? (
            <p className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">Aucune actualité publiée pour le moment.</p>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2">
              {updates.map((u) => (
                <li key={u.id}>
                  <UpdateCard update={u} tone="light" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </>
  )
}
