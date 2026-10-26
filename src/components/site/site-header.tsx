"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowRight, LockKeyhole, Menu, Phone } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatPhone } from "@/lib/phone"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { SITE_NAV } from "@/components/site/site-nav"

const SPY_SECTIONS = ["domaine", "terrains", "avancement", "a-propos", "contact"]

/** En-tête avec l'entrée active (lit l'URL : à placer sous <Suspense>). */
export function SiteHeader({ phone }: { phone: string | null }) {
  const pathname = usePathname()
  const [section, setSection] = React.useState<string | null>(null)

  // Sur l'accueil, l'entrée active suit la section visible
  React.useEffect(() => {
    if (pathname !== "/") return
    const elements = SPY_SECTIONS.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el)
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible) setSection(visible.target.id)
        else if (window.scrollY < 200) setSection(null)
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: [0, 0.25, 0.5] },
    )
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [pathname])

  let active = "accueil"
  if (pathname.startsWith("/terrains")) active = "terrains"
  else if (pathname.startsWith("/avancement")) active = "avancement"
  else if (pathname === "/" && section) active = section
  else if (pathname !== "/") active = ""

  return <SiteHeaderBar active={active} phone={phone} />
}

export function SiteHeaderBar({ active, phone }: { active: string | null; phone: string | null }) {
  const [open, setOpen] = React.useState(false)
  const [scrolled, setScrolled] = React.useState(false)

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border/70 bg-background/92 text-foreground backdrop-blur transition-shadow duration-300",
        scrolled && "shadow-[0_10px_30px_-18px_rgb(0_0_0/0.35)]",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-8 px-4 sm:px-6 lg:h-[76px] lg:gap-12 lg:px-8">
        <Link href="/" aria-label="NADI Group — accueil" className="shrink-0">
          <Logo />
        </Link>

        <nav aria-label="Navigation principale" className="hidden flex-1 items-center gap-0.5 lg:flex">
          {SITE_NAV.map((item) => {
            const isActive = item.id === active
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative px-3 py-2 text-[0.9rem] font-medium transition-colors",
                  isActive ? "text-pine-deep" : "text-foreground/65 hover:text-foreground",
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "absolute inset-x-3 -bottom-0.5 h-0.5 origin-left rounded-full bg-pine-deep transition-transform duration-300",
                    isActive ? "scale-x-100" : "scale-x-0",
                  )}
                />
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          {phone && (
            <Button
              asChild
              variant="outline"
              size="icon-lg"
              className="hidden size-11 rounded-full border-border bg-card text-pine-deep shadow-xs hover:bg-sand hover:text-pine-deep md:inline-flex"
            >
              <a href={`tel:${phone}`} aria-label={`Appeler le ${formatPhone(phone)}`}>
                <Phone className="size-[18px]" />
              </a>
            </Button>
          )}
          <Button
            asChild
            className="hidden h-11 rounded-md bg-pine-deep px-5 text-[0.9rem] font-semibold text-white shadow-sm hover:bg-pine-deep/90 sm:inline-flex"
          >
            <Link href="/espace-client">
              <LockKeyhole />
              Espace propriétaire
            </Link>
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-lg" className="text-pine-deep hover:bg-sand lg:hidden" aria-label="Ouvrir le menu">
                <Menu className="size-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[86vw] max-w-sm gap-0 p-0">
              <SheetHeader className="border-b p-5">
                <SheetTitle asChild>
                  <span>
                    <Logo />
                  </span>
                </SheetTitle>
                <SheetDescription className="sr-only">Menu de navigation</SheetDescription>
              </SheetHeader>
              <nav className="flex flex-col p-3">
                {SITE_NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center justify-between rounded-md px-4 py-3.5 text-base font-medium transition-colors hover:bg-sand",
                      item.id === active ? "text-pine-deep" : "text-foreground/80",
                    )}
                  >
                    {item.label}
                    <ArrowRight className="size-4 opacity-40" />
                  </Link>
                ))}
              </nav>
              <div className="mt-auto space-y-2 border-t p-5">
                <Button asChild size="lg" className="h-12 w-full rounded-md bg-pine-deep text-base font-semibold text-white hover:bg-pine-deep/90">
                  <Link href="/espace-client" onClick={() => setOpen(false)}>
                    <LockKeyhole />
                    Espace propriétaire
                  </Link>
                </Button>
                {phone && (
                  <Button asChild size="lg" variant="outline" className="h-12 w-full rounded-md text-base">
                    <a href={`tel:${phone}`}>
                      <Phone />
                      {formatPhone(phone)}
                    </a>
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
