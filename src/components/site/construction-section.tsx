import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Building2, Camera, Check, FileCheck2, MapPinned, ReceiptText, Search, Wallet } from "lucide-react"
import { Container, Eyebrow } from "@/components/site/section-heading"
import { Reveal } from "@/components/site/reveal"

// Visuels de la rubrique « Construction » (public/images/construction) : rendu du projet et photos de nos chantiers.
export const CONSTRUCTION_HERO = "/images/construction/immeuble-perspective.jpg"
export const CONSTRUCTION_GALLERY = [
  { src: "/images/construction/chantier-10.jpg", alt: "Murs élevés et chaînages en attente" },
  { src: "/images/construction/chantier-03.jpg", alt: "Fondations et soubassement d'une maison" },
  { src: "/images/construction/chantier-05.jpg", alt: "Élévation d'un mur en agglos" },
  { src: "/images/construction/chantier-09.jpg", alt: "Préparation du mortier sur le chantier" },
  { src: "/images/construction/chantier-02.jpg", alt: "Équipe sur les fondations" },
  { src: "/images/construction/chantier-07.jpg", alt: "Murs du rez-de-chaussée et ferraillage des poteaux" },
]

export const SITUATIONS = [
  { icon: Building2, title: "Vous avez un terrain chez nous", text: "Vous avez acquis un terrain dans notre lotissement : nous y bâtissons votre maison, du plan à la remise des clés." },
  { icon: MapPinned, title: "Vous avez un terrain ailleurs", text: "Votre terrain est situé hors du lotissement ? Nous étudions le site et construisons chez vous." },
  { icon: Search, title: "Vous n'avez pas encore de terrain", text: "Nous vous aidons à choisir le terrain adapté à votre maison, puis nous la construisons." },
]

export const TRANSPARENCY = [
  { icon: FileCheck2, title: "Offre détaillée", text: "Chaque poste de travaux et son prix. Vous l'acceptez en ligne, sans surprise." },
  { icon: Camera, title: "Chantier en photos", text: "Les étapes, leur avancement et les photos publiées au fil des travaux." },
  { icon: Wallet, title: "Versements et reçus", text: "Vos appels de fonds, vos versements et un reçu pour chacun." },
  { icon: ReceiptText, title: "Dépenses partagées", text: "Matériaux, main-d'œuvre, achats : vous voyez ce qui est dépensé pour votre maison, justificatifs à l'appui." },
]

/** Rubrique « Construction » de la page d'accueil : promesse, garanties de transparence et lien vers la page dédiée. */
export function ConstructionTeaser({ companyName, imageUrl }: { companyName: string; imageUrl: string | null }) {
  return (
    <section id="construction" className="scroll-mt-20 py-20 sm:py-24">
      <Container className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal className="min-w-0 lg:order-2">
          <div className="relative mx-auto aspect-[4/5] max-w-md overflow-hidden rounded-lg bg-muted shadow-[0_30px_70px_-35px_rgb(0_0_0/0.45)] lg:max-w-none">
            <Image src={imageUrl ?? CONSTRUCTION_HERO} alt="Projet de construction en perspective" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
            <div className="absolute inset-x-4 bottom-4 rounded-md bg-background/95 p-4 shadow-lg backdrop-blur">
              <p className="text-sm font-semibold">Votre chantier, suivi en ligne</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Offre, versements, photos et dépenses dans votre espace client.</p>
            </div>
          </div>
        </Reveal>
        <Reveal delay={0.08} className="min-w-0">
          <Eyebrow>Construction clés en main</Eyebrow>
          <h2 className="mt-3 font-display text-[2rem] leading-[1.1] font-semibold tracking-tight text-balance sm:text-[2.55rem]">Nous construisons aussi votre maison</h2>
          <p className="mt-5 leading-relaxed text-pretty text-muted-foreground">
            Sur votre terrain du lotissement, sur un terrain que vous possédez ailleurs, ou même si vous n&apos;avez pas encore de terrain : {companyName} conçoit et bâtit
            votre maison, et vous montre tout.
          </p>
          <ul className="mt-7 space-y-3.5">
            {TRANSPARENCY.map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-pine-deep text-white">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                <span>
                  <span className="font-medium">{item.title}</span>
                  <span className="block text-sm text-muted-foreground">{item.text}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/construction#demande"
              className="group inline-flex h-12 items-center gap-2 rounded-md bg-pine-deep px-6 text-[0.95rem] font-semibold text-white transition-colors hover:bg-pine"
            >
              Demander une étude gratuite
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/construction" className="inline-flex h-12 items-center rounded-md border border-border bg-card px-6 text-[0.95rem] font-semibold transition-colors hover:border-pine-deep/40">
              Découvrir l&apos;offre
            </Link>
          </div>
        </Reveal>
      </Container>
    </section>
  )
}
