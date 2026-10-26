import Image from "next/image"
import { Check } from "lucide-react"
import type { PlanLot } from "@/components/plan/plan-viewer"
import { Container, Eyebrow } from "@/components/site/section-heading"
import { MiniPlan } from "@/components/site/mini-plan"
import { Reveal } from "@/components/site/reveal"
import { VideoDialog } from "@/components/site/video-dialog"
import { frenchText } from "@/components/site/typography"

const COMMITMENTS = [
  "Terrains viabilisés et prêts à construire",
  "Informations claires et transparentes",
  "Suivi régulier de l'avancement",
  "Un accompagnement personnalisé",
]

/** « Pourquoi choisir NADI Group ? » : photo (ou vidéo) + engagements. */
export function AboutSection({
  companyName,
  about,
  imageUrl,
  videoUrl,
  plan,
  lots,
}: {
  companyName: string
  about: string
  imageUrl: string | null
  videoUrl: string | null
  plan: { imageUrl: string | null; width: number; height: number }
  lots: PlanLot[]
}) {
  return (
    <section id="a-propos" className="scroll-mt-20 py-20 sm:py-24">
      <Container className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal className="min-w-0">
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted shadow-[0_30px_70px_-35px_rgb(0_0_0/0.45)]">
            {imageUrl ? (
              <Image src={imageUrl} unoptimized={imageUrl.endsWith(".svg")} alt="Vue du domaine" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
            ) : (
              <MiniPlan {...plan} lots={lots} className="absolute inset-0 size-full" />
            )}
            {videoUrl && <VideoDialog url={videoUrl} label="Découvrir le domaine en vidéo" />}
          </div>
        </Reveal>
        <Reveal delay={0.08} className="min-w-0">
          <Eyebrow>Pourquoi choisir {companyName} ?</Eyebrow>
          <h2 className="mt-3 font-display text-[2rem] leading-[1.1] font-semibold tracking-tight text-balance sm:text-[2.55rem]">
            Un partenaire de confiance pour votre projet immobilier
          </h2>
          <p className="mt-5 leading-relaxed text-pretty text-muted-foreground">
            {frenchText(about || "Nous nous engageons à offrir des terrains de qualité, un suivi rigoureux et une transparence totale tout au long du processus.")}
          </p>
          <ul className="mt-7 space-y-3.5">
            {COMMITMENTS.map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-pine-deep text-white">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                <span className="font-medium">{frenchText(item)}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </section>
  )
}
