import { BRAND } from "@/lib/brand"
import { cn } from "@/lib/utils"
import { LOGO } from "./logo-paths"

/** Symbole FUTURIA GROUP : le F biseauté (couleur du texte courant) et sa barre orange. Hauteur : 1em. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox={LOGO.mark.viewBox} className={cn("h-[1em] w-auto shrink-0", className)} aria-hidden="true">
      <path d={LOGO.mark.stem} fill="currentColor" />
      <path d={LOGO.mark.bar} fill={BRAND.colors.orange} />
    </svg>
  )
}

/**
 * Logo FUTURIA GROUP : symbole + « FUTURIA » / « GROUP » et filet orange.
 * Le texte est en tracés (pas de police à charger) ; la hauteur du logo suit `size`.
 * Le mot-symbole est le dernier `<span>` enfant : la barre latérale repliée de l'administration le masque.
 */
export function Logo({
  className,
  tone = "default",
  size = "default",
}: {
  className?: string
  tone?: "default" | "light"
  size?: "default" | "lg"
}) {
  const { rule } = LOGO.wordmark
  return (
    <span
      role="img"
      aria-label={BRAND.name}
      className={cn(
        "inline-flex items-center leading-none",
        size === "lg" ? "text-[2.75rem]" : "text-[2.125rem]",
        tone === "light" ? "text-white" : "text-pine-deep dark:text-white",
        className,
      )}
      style={{ gap: `${LOGO.gap}em` }}
    >
      <LogoMark />
      <span className="inline-flex shrink-0">
        <svg viewBox={LOGO.wordmark.viewBox} className="h-[1em] w-auto" aria-hidden="true">
          <path d={LOGO.wordmark.futuria} fill="currentColor" />
          <path d={LOGO.wordmark.group} fill="currentColor" />
          <rect x={rule.x} y={rule.y} width={rule.width} height={rule.height} fill={BRAND.colors.orange} />
        </svg>
      </span>
    </span>
  )
}
