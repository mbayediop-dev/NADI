"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

type CarouselProps = {
  children: React.ReactNode
  /** Intitulé accessible de la liste */
  label: string
  className?: string
  /** Largeur des éléments (classes Tailwind) */
  itemClassName?: string
  /** Flèches centrées sous le carrousel, ou de part et d'autre sur grand écran */
  arrows?: "below" | "sides"
}

/** Carrousel à défilement natif (scroll-snap) avec flèches précédent / suivant. */
export function Carousel({ children, label, className, itemClassName, arrows = "below" }: CarouselProps) {
  const ref = React.useRef<HTMLUListElement>(null)
  const [canPrev, setCanPrev] = React.useState(false)
  const [canNext, setCanNext] = React.useState(false)
  const items = React.Children.toArray(children)

  const update = React.useCallback(() => {
    const el = ref.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setCanPrev(el.scrollLeft > 4)
    setCanNext(el.scrollLeft < max - 4)
  }, [])

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    update()
    el.addEventListener("scroll", update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => {
      el.removeEventListener("scroll", update)
      observer.disconnect()
    }
  }, [update, items.length])

  function step(direction: -1 | 1) {
    const el = ref.current
    if (!el) return
    const first = el.firstElementChild as HTMLElement | null
    const gap = Number.parseFloat(getComputedStyle(el).columnGap) || 0
    const distance = first ? first.offsetWidth + gap : el.clientWidth * 0.8
    el.scrollBy({ left: direction * distance, behavior: "smooth" })
  }

  const scrollable = canPrev || canNext
  return (
    <div className={cn("relative", className)}>
      <ul
        ref={ref}
        aria-label={label}
        className="-mx-4 -my-4 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-4 py-4 scroll-px-4 scrollbar-none sm:mx-0 sm:px-0 sm:scroll-px-0"
      >
        {items.map((child, i) => (
          <li key={React.isValidElement(child) && child.key != null ? child.key : i} className={cn("shrink-0 snap-start", itemClassName)}>
            {child}
          </li>
        ))}
      </ul>

      {arrows === "sides" && scrollable && (
        <>
          <ArrowButton direction={-1} disabled={!canPrev} onClick={() => step(-1)} className="absolute top-[38%] left-0 z-10 hidden -translate-x-1/2 lg:grid 2xl:-translate-x-[150%]" />
          <ArrowButton direction={1} disabled={!canNext} onClick={() => step(1)} className="absolute top-[38%] right-0 z-10 hidden translate-x-1/2 lg:grid 2xl:translate-x-[150%]" />
        </>
      )}
      {scrollable && (
        <div className={cn("mt-6 flex justify-center gap-3", arrows === "sides" && "lg:hidden")}>
          <ArrowButton direction={-1} disabled={!canPrev} onClick={() => step(-1)} />
          <ArrowButton direction={1} disabled={!canNext} onClick={() => step(1)} />
        </div>
      )}
    </div>
  )
}

function ArrowButton({ direction, disabled, onClick, className }: { direction: -1 | 1; disabled: boolean; onClick: () => void; className?: string }) {
  const Icon = direction === -1 ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === -1 ? "Précédent" : "Suivant"}
      className={cn(
        "grid size-11 place-items-center rounded-full border border-border bg-card text-foreground shadow-md transition-colors hover:bg-sand disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-card",
        className,
      )}
    >
      <Icon className="size-5" />
    </button>
  )
}
