import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Reveal } from "@/components/site/reveal"
import { frenchText } from "@/components/site/typography"

export function Eyebrow({ children, tone = "default", className }: { children: React.ReactNode; tone?: "default" | "light"; className?: string }) {
  return (
    <p
      className={cn(
        "text-[0.72rem] font-bold tracking-[0.22em] uppercase",
        tone === "light" ? "text-gold" : "text-gold-strong",
        className,
      )}
    >
      {children}
    </p>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  tone = "default",
  className,
  action,
}: {
  eyebrow?: string
  title: React.ReactNode
  description?: React.ReactNode
  align?: "left" | "center"
  tone?: "default" | "light"
  className?: string
  /** Lien-bouton affiché à droite du titre (voir `SectionLink`) */
  action?: React.ReactNode
}) {
  const fr = (v: React.ReactNode) => (typeof v === "string" ? frenchText(v) : v)
  return (
    <Reveal
      className={cn(
        "flex flex-col gap-5 md:flex-row md:items-start md:justify-between",
        align === "center" && "items-center text-center md:flex-col md:items-center",
        className,
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow && <Eyebrow tone={tone}>{eyebrow}</Eyebrow>}
        <h2
          className={cn(
            "mt-3 font-display text-[2rem] leading-[1.1] font-semibold tracking-tight text-balance sm:text-[2.55rem]",
            tone === "light" ? "text-white" : "text-foreground",
          )}
        >
          {fr(title)}
        </h2>
        {description && (
          <p className={cn("mt-4 text-base leading-relaxed text-pretty sm:text-[1.05rem]", tone === "light" ? "text-white/75" : "text-muted-foreground")}>
            {fr(description)}
          </p>
        )}
      </div>
      {action && <div className="shrink-0 md:mt-7">{action}</div>}
    </Reveal>
  )
}

/** Lien-bouton discret des titres de section (« Voir le plan complet → »). */
export function SectionLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex h-11 items-center gap-2 rounded-md border border-border bg-card px-5 text-sm font-semibold text-foreground shadow-xs transition-colors hover:border-pine-deep/40 hover:bg-sand",
        className,
      )}
    >
      {children}
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

export function Container({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>
}
