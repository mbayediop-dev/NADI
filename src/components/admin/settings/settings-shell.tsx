"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type SettingsTab = { key: string; label: string; description: string; icon: LucideIcon }

/** Navigation des paramètres : colonne à gauche (grand écran), pastilles défilantes (mobile). */
export function SettingsShell({ tabs, panels, initialTab }: { tabs: SettingsTab[]; panels: Record<string, React.ReactNode>; initialTab?: string }) {
  const [active, setActive] = React.useState(initialTab && panels[initialTab] ? initialTab : tabs[0].key)
  const current = tabs.find((t) => t.key === active) ?? tabs[0]
  const navRef = React.useRef<HTMLElement>(null)

  // Mobile : faire défiler la pastille active dans le champ de vision
  React.useEffect(() => {
    const nav = navRef.current
    const el = nav?.querySelector<HTMLElement>("[aria-current=page]")
    if (nav && el && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: el.offsetLeft - 16, behavior: "smooth" })
  }, [active])

  function select(key: string) {
    setActive(key)
    const url = new URL(window.location.href)
    url.searchParams.set("tab", key)
    window.history.replaceState(null, "", url)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <nav ref={navRef} aria-label="Sections des paramètres" className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-1 lg:self-start lg:px-0 lg:sticky lg:top-20">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => select(tab.key)}
            aria-current={active === tab.key ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors lg:rounded-xl lg:border-transparent lg:px-3 lg:py-2.5",
              active === tab.key ? "border-primary bg-primary text-primary-foreground lg:bg-primary/10 lg:text-primary" : "bg-card hover:bg-muted lg:bg-transparent",
            )}
          >
            <tab.icon className="size-4" />
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="min-w-0 space-y-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight">{current.label}</h2>
          <p className="text-sm text-muted-foreground">{current.description}</p>
        </div>
        {tabs.map((tab) => (
          <div key={tab.key} hidden={tab.key !== active}>
            {panels[tab.key]}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Barre d'enregistrement collante, visible quand le formulaire a été modifié. */
export function SaveBar({ dirty, pending, onReset, label = "Enregistrer les modifications" }: { dirty: boolean; pending: boolean; onReset: () => void; label?: string }) {
  return (
    <div
      className={cn(
        "sticky bottom-3 z-20 flex items-center justify-end gap-2 rounded-2xl border bg-background/95 p-2.5 shadow-lg backdrop-blur transition-all",
        dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
      )}
    >
      <span className="mr-auto pl-2 text-sm text-muted-foreground">Modifications non enregistrées</span>
      <button type="button" onClick={onReset} className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
        Annuler
      </button>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {pending && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
        {label}
      </button>
    </div>
  )
}

/** État de formulaire avec détection des modifications. */
export function useFormState<T>(initial: T) {
  const [saved, setSaved] = React.useState(initial)
  const [value, setValue] = React.useState(initial)
  const dirty = JSON.stringify(saved) !== JSON.stringify(value)
  return {
    value,
    set: <K extends keyof T>(key: K, v: T[K]) => setValue((prev) => ({ ...prev, [key]: v })),
    setValue,
    dirty,
    reset: () => setValue(saved),
    commit: () => setSaved(value),
  }
}
