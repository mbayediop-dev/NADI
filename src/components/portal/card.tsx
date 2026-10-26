import Link from "next/link"
import { ChevronRight, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/** Carte de section de l'espace client. */
export function PortalCard({
  title,
  icon: Icon,
  action,
  className,
  bodyClassName,
  children,
}: {
  title?: React.ReactNode
  icon?: LucideIcon
  action?: { href: string; label: string }
  className?: string
  bodyClassName?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn("overflow-hidden rounded-3xl border bg-card shadow-xs", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-5">
          {title && (
            <h2 className="flex items-center gap-2 text-[0.95rem] font-bold tracking-tight">
              {Icon && (
                <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
              )}
              {title}
            </h2>
          )}
          {action && (
            <Link href={action.href} className="inline-flex shrink-0 items-center gap-0.5 text-sm font-semibold text-primary hover:underline underline-offset-4">
              {action.label}
              <ChevronRight className="size-4" />
            </Link>
          )}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  )
}

export function PageTitle({ title, description, children }: { title: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[1.6rem] leading-tight font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground sm:text-base">{description}</p>}
      </div>
      {children}
    </div>
  )
}
