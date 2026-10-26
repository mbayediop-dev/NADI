"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText, HardHat, Home, UserRound, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"

export const PORTAL_NAV = [
  { href: "/espace-client", label: "Accueil", icon: Home, exact: true },
  { href: "/espace-client/paiements", label: "Paiements", icon: Wallet },
  { href: "/espace-client/documents", label: "Documents", icon: FileText },
  { href: "/espace-client/avancement", label: "Chantier", longLabel: "Avancement", icon: HardHat },
  { href: "/espace-client/profil", label: "Profil", icon: UserRound },
]

function isActive(pathname: string | null, item: (typeof PORTAL_NAV)[number]) {
  if (!pathname) return false
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`) || (item.href.endsWith("paiements") && pathname.startsWith("/espace-client/recus"))
}

/** Navigation horizontale (écran large) — présentation pure */
export function DesktopNavList({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Navigation principale" className="hidden items-center gap-1 md:flex">
      {PORTAL_NAV.filter((item) => item.href !== "/espace-client/profil").map((item) => {
        const active = isActive(pathname, item)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <item.icon className="size-4" />
            {item.longLabel ?? item.label}
          </Link>
        )
      })}
    </nav>
  )
}

/** Barre d'onglets fixée en bas (mobile) — présentation pure */
export function MobileTabBarList({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="Navigation principale"
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t bg-background/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {PORTAL_NAV.map((item) => {
          const active = isActive(pathname, item)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[0.68rem] font-semibold transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-12 place-items-center rounded-full transition-colors",
                    active ? "bg-primary/12 text-primary" : "text-muted-foreground",
                  )}
                >
                  <item.icon className="size-[1.15rem]" strokeWidth={active ? 2.4 : 2} />
                </span>
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** Versions qui lisent l'URL (à placer sous <Suspense>) */
export function DesktopNav() {
  return <DesktopNavList pathname={usePathname()} />
}

export function MobileTabBar() {
  return <MobileTabBarList pathname={usePathname()} />
}
