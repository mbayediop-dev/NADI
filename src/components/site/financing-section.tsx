import { Banknote, CalendarRange, Clock3, HeartHandshake } from "lucide-react"
import { formatMoney } from "@/lib/format"
import { Container, SectionHeading } from "@/components/site/section-heading"
import { Reveal } from "@/components/site/reveal"

/** Modalités de paiement (accueil) : acompte, échelonnement, durée, accompagnement. */
export function FinancingSection({
  companyName,
  currency,
  minDeposit,
  maxInstallments,
}: {
  companyName: string
  currency: string
  /** Acompte le plus bas parmi les terrains disponibles */
  minDeposit: number | null
  /** Nombre de versements le plus élevé proposé */
  maxInstallments: number | null
}) {
  const items = [
    { icon: Banknote, title: "Acompte", text: minDeposit ? `À partir de ${formatMoney(minDeposit, currency)}` : "Un premier versement à la réservation" },
    { icon: CalendarRange, title: "Paiement échelonné", text: "Mensuel, trimestriel, semestriel ou annuel" },
    { icon: Clock3, title: "Durée personnalisée", text: maxInstallments ? `Jusqu'à ${maxInstallments} versements, selon votre profil` : "Selon votre profil" },
    { icon: HeartHandshake, title: "Accompagnement", text: "Notre équipe vous guide à chaque étape" },
  ]
  return (
    <section id="financement" className="scroll-mt-20 bg-sand py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="Des modalités de paiement flexibles"
          title="Un financement adapté à vos besoins"
          description={`${companyName} vous propose des solutions de paiement simples et flexibles pour faciliter l'acquisition de votre terrain.`}
        />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, i) => (
            <Reveal as="li" key={item.title} delay={i * 0.05} className="flex items-start gap-4 rounded-lg border bg-card p-5 shadow-xs">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-sand text-pine-deep">
                <item.icon className="size-5" strokeWidth={1.7} />
              </span>
              <div>
                <p className="font-semibold">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  )
}
