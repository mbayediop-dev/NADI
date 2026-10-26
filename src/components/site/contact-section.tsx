import { Mail, MapPin, Phone } from "lucide-react"
import { formatPhone } from "@/lib/phone"
import { Container, Eyebrow } from "@/components/site/section-heading"
import { ContactDialog } from "@/components/site/contact-dialog"
import { Reveal } from "@/components/site/reveal"

export function ContactSection({
  companyName,
  companyPhone,
  companyWhatsapp,
  companyEmail,
  companyAddress,
  businessHours,
  lotOptions,
}: {
  companyName: string
  companyPhone: string
  companyWhatsapp: string
  companyEmail: string
  companyAddress: string
  businessHours: string
  lotOptions: { id: string; number: string; label: string }[]
}) {
  const items = [
    companyPhone && { icon: Phone, value: formatPhone(companyPhone), hint: businessHours || null, href: `tel:${companyPhone}` },
    companyEmail && { icon: Mail, value: companyEmail, hint: "Réponse sous 24 h", href: `mailto:${companyEmail}` },
    companyAddress && { icon: MapPin, value: companyAddress, hint: "Visite sur rendez-vous", href: null },
  ].filter(Boolean) as { icon: typeof Phone; value: string; hint: string | null; href: string | null }[]

  return (
    <section id="contact" className="relative scroll-mt-20 overflow-hidden bg-pine-deep text-white">
      <div aria-hidden className="bg-grain pointer-events-none absolute inset-0 opacity-50" />
      <LeafDecor className="pointer-events-none absolute -bottom-16 -left-12 h-[300px] w-auto text-white/[0.08] sm:h-[380px]" />
      <Container className="relative grid gap-12 py-16 sm:py-20 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-20">
        <Reveal>
          <Eyebrow tone="light">Un projet&nbsp;? Une question&nbsp;?</Eyebrow>
          <h2 className="mt-3 font-display text-[2rem] leading-[1.1] font-semibold tracking-tight text-balance text-white sm:text-[2.55rem]">Parlons de votre projet</h2>
          <p className="mt-5 max-w-lg leading-relaxed text-pretty text-white/75">
            Notre équipe est à votre écoute pour vous fournir toutes les informations et vous accompagner dans votre démarche.
          </p>
          <div className="mt-8">
            <ContactDialog companyName={companyName} companyWhatsapp={companyWhatsapp} lotOptions={lotOptions} />
          </div>
        </Reveal>
        {items.length > 0 && (
          <Reveal delay={0.06} as="div">
            <ul className="space-y-5">
              {items.map((item) => {
                const content = (
                  <>
                    <span className="grid size-11 shrink-0 place-items-center rounded-md bg-white text-pine-deep shadow-md">
                      <item.icon className="size-5" />
                    </span>
                    <span>
                      <span className="block font-semibold">{item.value}</span>
                      {item.hint && <span className="mt-0.5 block text-sm text-white/65">{item.hint}</span>}
                    </span>
                  </>
                )
                return (
                  <li key={item.value}>
                    {item.href ? (
                      <a href={item.href} className="flex items-center gap-4 transition-opacity hover:opacity-85">
                        {content}
                      </a>
                    ) : (
                      <div className="flex items-center gap-4">{content}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          </Reveal>
        )}
      </Container>
    </section>
  )
}

/** Feuillage décoratif (coin inférieur gauche du bandeau contact). */
function LeafDecor({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 320" className={className} fill="currentColor" aria-hidden="true">
      <path d="M40 300C40 180 120 90 250 60c-10 130-90 220-210 240z" />
      <path d="M60 300c0-60 40-120 110-150-20 70-60 120-110 150z" opacity=".7" />
      <path d="M0 230c50-30 110-30 160-10-50 40-110 50-160 10z" opacity=".6" />
      <path d="M10 320c20-50 60-90 120-110-30 50-70 90-120 110z" opacity=".5" />
    </svg>
  )
}
