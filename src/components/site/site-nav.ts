export type SiteNavItem = { href: string; label: string; id: string }

export const SITE_NAV: SiteNavItem[] = [
  { href: "/", label: "Accueil", id: "accueil" },
  { href: "/#domaine", label: "Le domaine", id: "domaine" },
  { href: "/terrains", label: "Nos terrains", id: "terrains" },
  { href: "/#avancement", label: "Avancement", id: "avancement" },
  { href: "/#a-propos", label: "À propos", id: "a-propos" },
  { href: "/terrains#faq", label: "FAQ", id: "faq" },
  { href: "/#contact", label: "Contact", id: "contact" },
]
