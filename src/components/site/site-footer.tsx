import Link from "next/link"
import { getSettings } from "@/lib/settings"
import { Logo } from "@/components/brand/logo"
import { CurrentYear } from "@/components/shared/current-year"
import { Container } from "@/components/site/section-heading"
import { SITE_NAV } from "@/components/site/site-nav"
import { WhatsAppFab } from "@/components/site/whatsapp-fab"
import { FacebookIcon, InstagramIcon, LinkedinIcon, YoutubeIcon } from "@/components/site/social-icons"

export async function SiteFooter() {
  const s = await getSettings()
  const socials = [
    { href: s.socialFacebook, label: "Facebook", icon: FacebookIcon },
    { href: s.socialInstagram, label: "Instagram", icon: InstagramIcon },
    { href: s.socialLinkedin, label: "LinkedIn", icon: LinkedinIcon },
    { href: s.socialYoutube, label: "YouTube", icon: YoutubeIcon },
  ].filter((x) => !!x.href)

  return (
    <footer className="border-t bg-background">
      <Container>
        <div className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1.2fr_0.9fr_1fr] lg:gap-8 lg:py-14">
          <div>
            <Logo size="lg" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">{s.companyTagline}</p>
          </div>

          <div>
            <p className="font-semibold">Liens utiles</p>
            <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
              {SITE_NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-muted-foreground transition-colors hover:text-pine-deep">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {socials.length > 0 && (
            <div>
              <p className="font-semibold">Suivez-nous</p>
              <ul className="mt-4 flex items-center gap-2.5">
                {socials.map((social) => (
                  <li key={social.label}>
                    <a
                      href={social.href!}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.label}
                      className="grid size-10 place-items-center rounded-full border border-border bg-card text-pine-deep transition-colors hover:border-pine-deep/40 hover:bg-sand"
                    >
                      <social.icon className="size-[18px]" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-sm text-muted-foreground lg:text-right">
            <p>
              © <CurrentYear /> {s.companyName}.
              <br />
              Tous droits réservés.
            </p>
            <p className="mt-4 flex items-center gap-3 text-xs lg:justify-end">
              <Link href="/mentions-legales" className="transition-colors hover:text-pine-deep">
                Mentions légales
              </Link>
              <span aria-hidden>|</span>
              <Link href="/confidentialite" className="transition-colors hover:text-pine-deep">
                Confidentialité
              </Link>
            </p>
          </div>
        </div>
      </Container>
      <WhatsAppFab phone={s.companyWhatsapp} companyName={s.companyName} />
    </footer>
  )
}
