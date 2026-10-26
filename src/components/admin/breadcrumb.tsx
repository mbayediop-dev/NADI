"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ADMIN_TITLES } from "@/components/admin/nav-config"

/** Fil d'Ariane déduit de l'URL (à placer sous <Suspense>) */
export function AdminBreadcrumb() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)
  const crumbs = segments.map((segment, i) => ({
    href: "/" + segments.slice(0, i + 1).join("/"),
    label: ADMIN_TITLES[segment] ?? (segment.length > 16 ? "Détail" : decodeURIComponent(segment)),
  }))
  const visible = crumbs.length > 1 ? crumbs.slice(1) : crumbs
  return (
    <nav aria-label="Fil d'Ariane" className="flex min-w-0 items-center gap-1.5 text-sm">
      {crumbs.length > 1 && (
        <>
          <Link href="/admin" className="hidden text-muted-foreground hover:text-foreground sm:inline">
            Accueil
          </Link>
          <span className="hidden text-muted-foreground/50 sm:inline">/</span>
        </>
      )}
      {visible.map((crumb, i) => (
        <span key={crumb.href} className="flex min-w-0 items-center gap-1.5">
          {i > 0 && <span className="text-muted-foreground/50">/</span>}
          {i === visible.length - 1 ? (
            <span className="truncate font-semibold">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="truncate text-muted-foreground hover:text-foreground">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
