import { Container } from "@/components/site/section-heading"

/** Squelette de la page d'accueil (coquille statique pendant le chargement des données). */
export function LandingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Chargement">
      <section className="bg-background">
        <Container className="py-14 sm:py-20 lg:min-h-[660px] lg:py-24">
          <div className="max-w-xl space-y-5">
            <div className="h-3.5 w-64 animate-pulse rounded bg-muted" />
            <div className="h-14 w-4/5 animate-pulse rounded-md bg-muted" />
            <div className="h-14 w-3/5 animate-pulse rounded-md bg-muted" />
            <div className="h-9 w-2/3 animate-pulse rounded-md bg-muted" />
            <div className="h-20 w-full animate-pulse rounded-md bg-muted/70" />
            <div className="flex gap-3">
              <div className="h-12 w-52 animate-pulse rounded-md bg-pine-deep/15" />
              <div className="h-12 w-44 animate-pulse rounded-md bg-muted" />
            </div>
          </div>
        </Container>
      </section>
      <Container className="py-24">
        <div className="h-10 w-80 animate-pulse rounded-md bg-muted" />
        <div className="mt-10 h-[460px] animate-pulse rounded-lg bg-muted" />
      </Container>
    </div>
  )
}

/** Bandeau sombre des pages intérieures. */
export function PageBand({ children }: { children?: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-pine-deep text-white">
      <div aria-hidden className="bg-grain pointer-events-none absolute inset-0 opacity-60" />
      <div aria-hidden className="pointer-events-none absolute -top-24 right-[10%] size-[380px] rounded-full bg-gold/15 blur-[100px]" />
      <Container className="relative py-12 sm:py-16">{children}</Container>
    </section>
  )
}
