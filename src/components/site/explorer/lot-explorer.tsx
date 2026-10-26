"use client"

import * as React from "react"
import { ArrowLeft, ArrowRight, LayoutGrid, Map as MapIcon, RotateCcw, Search, SlidersHorizontal } from "lucide-react"
import type { LotStatus } from "@/generated/prisma/enums"
import { formatArea, formatMoney, formatNumber } from "@/lib/format"
import { LOT_STATUS } from "@/lib/labels"
import { whatsappLink } from "@/lib/phone"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { PlanLegend, PlanViewer, type PlanLot } from "@/components/plan/plan-viewer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { LotCard } from "@/components/site/explorer/lot-card"
import { LotDetails } from "@/components/site/explorer/lot-details"
import type { ExplorerSettings } from "@/components/site/explorer/types"
import { OPEN_LOT_EVENT } from "@/components/site/explorer/open-lot"
import { areaRanges, budgetRanges, similarLots, type PublicLot } from "@/components/site/lot-utils"
import { ReservationForm } from "@/components/site/reservation-form"
import { WhatsAppIcon } from "@/components/site/whatsapp-fab"

type StatusFilter = "all" | Exclude<LotStatus, "UNAVAILABLE">
const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "AVAILABLE", label: "Disponibles" },
  { value: "RESERVED", label: "Réservés" },
  { value: "SOLD", label: "Vendus" },
]

const LIST_STEP = 12

export function LotExplorer({
  lots,
  settings,
  blocks,
  initialLotNumber,
  initialFilters,
}: {
  lots: PublicLot[]
  settings: ExplorerSettings
  blocks: string[]
  initialLotNumber?: string | null
  /** Filtres transmis par l'URL (?statut=&surface=&budget=&ilot=) */
  initialFilters?: { status?: string; area?: string; budget?: string; block?: string }
}) {
  const isMobile = useIsMobile()
  const currency = settings.currencyLabel
  const [view, setView] = React.useState<"plan" | "list">("plan")
  const [status, setStatus] = React.useState<StatusFilter>(() =>
    STATUS_FILTERS.some((f) => f.value === initialFilters?.status) ? (initialFilters!.status as StatusFilter) : "all",
  )
  const [block, setBlock] = React.useState(() => (initialFilters?.block && blocks.includes(initialFilters.block) ? initialFilters.block : "all"))
  const [area, setArea] = React.useState(() =>
    initialFilters?.area && areaRanges(lots).some((r) => r.id === initialFilters.area) ? initialFilters.area : "all",
  )
  const [budget, setBudget] = React.useState(() =>
    initialFilters?.budget && settings.showPricesPublicly && budgetRanges(lots, settings.currencyLabel).some((r) => r.id === initialFilters.budget)
      ? initialFilters.budget
      : "all",
  )
  const [query, setQuery] = React.useState("")
  // Lien direct ?lot=<numéro> : fiche ouverte dès le chargement
  const [selectedId, setSelectedId] = React.useState<string | null>(
    () => lots.find((l) => l.number === initialLotNumber)?.id ?? null,
  )
  const [focus, setFocus] = React.useState(() => selectedId !== null)
  const [step, setStep] = React.useState<"details" | "reserve" | "done">("details")
  const [listLimit, setListLimit] = React.useState(LIST_STEP)

  const areas = React.useMemo(() => areaRanges(lots), [lots])
  const budgets = React.useMemo(() => (settings.showPricesPublicly ? budgetRanges(lots, currency) : []), [lots, currency, settings.showPricesPublicly])
  const byId = React.useMemo(() => new Map(lots.map((l) => [l.id, l])), [lots])
  const selected = selectedId ? (byId.get(selectedId) ?? null) : null

  const counts = React.useMemo(() => {
    const c: Partial<Record<LotStatus, number>> = { AVAILABLE: 0, RESERVED: 0, SOLD: 0, UNAVAILABLE: 0 }
    for (const l of lots) c[l.status] = (c[l.status] ?? 0) + 1
    return c
  }, [lots])

  const matches = React.useCallback(
    (lot: PublicLot) => {
      if (status !== "all" && lot.status !== status) return false
      if (block !== "all" && lot.block !== block) return false
      if (area !== "all") {
        const r = areas.find((a) => a.id === area)
        if (r && (lot.areaM2 < r.min || lot.areaM2 > r.max)) return false
      }
      if (budget !== "all") {
        const r = budgets.find((b) => b.id === budget)
        if (r && (lot.price == null || lot.price < r.min || lot.price > r.max)) return false
      }
      const q = query.trim().toLowerCase()
      if (q && !lot.number.toLowerCase().includes(q.replace(/^n°?\s*/, ""))) return false
      return true
    },
    [status, block, area, budget, query, areas, budgets],
  )

  const filtered = React.useMemo(
    () =>
      lots
        .filter((l) => l.status !== "UNAVAILABLE" && matches(l))
        .sort((a, b) => Number(b.status === "AVAILABLE") - Number(a.status === "AVAILABLE") || a.number.localeCompare(b.number, "fr", { numeric: true })),
    [lots, matches],
  )
  const filtersActive = status !== "all" || block !== "all" || area !== "all" || budget !== "all" || query.trim() !== ""

  const select = React.useCallback(
    (lot: PublicLot | PlanLot, opts: { focus?: boolean } = {}) => {
      setSelectedId(lot.id)
      setFocus(!!opts.focus)
      setStep("details")
      const url = new URL(window.location.href)
      url.searchParams.set("lot", lot.number)
      window.history.replaceState(window.history.state, "", url)
    },
    [],
  )

  function close() {
    setSelectedId(null)
    const url = new URL(window.location.href)
    url.searchParams.delete("lot")
    window.history.replaceState(window.history.state, "", url)
  }

  React.useEffect(() => {
    if (initialLotNumber && lots.some((l) => l.number === initialLotNumber)) {
      document.getElementById("terrains")?.scrollIntoView({ behavior: "smooth" })
    }
  }, [initialLotNumber, lots])

  // Ouverture depuis une autre section (simulateur, hero…)
  React.useEffect(() => {
    function onOpen(event: Event) {
      const number = (event as CustomEvent<string>).detail
      const lot = lots.find((l) => l.number === number)
      if (lot) {
        setView("plan")
        select(lot, { focus: true })
      }
    }
    window.addEventListener(OPEN_LOT_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_LOT_EVENT, onOpen)
  }, [lots, select])

  function resetFilters() {
    setStatus("all")
    setBlock("all")
    setArea("all")
    setBudget("all")
    setQuery("")
  }

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return
    const exact = lots.find((l) => l.number.toLowerCase() === query.trim().toLowerCase())
    if (exact) select(exact, { focus: true })
  }

  const similar = selected && selected.status !== "AVAILABLE" ? similarLots(selected, lots) : []
  const canReserve = !!selected && selected.status === "AVAILABLE" && settings.reservationsOpen

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-[0_30px_80px_-40px_rgb(0_0_0/0.35)]">
      {/* Barre de filtres */}
      <div className="flex flex-col gap-3 border-b p-3 sm:p-4 xl:flex-row xl:items-center">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1 xl:w-44 xl:flex-none">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKey}
              placeholder="N° de terrain"
              inputMode="search"
              className="h-10 rounded-md pl-9"
              aria-label="Rechercher un terrain par numéro"
            />
          </div>
          <div className="flex shrink-0 rounded-md bg-muted p-1" role="tablist" aria-label="Affichage">
            {[
              { v: "plan" as const, label: "Plan", icon: MapIcon },
              { v: "list" as const, label: "Liste", icon: LayoutGrid },
            ].map((t) => (
              <button
                key={t.v}
                role="tab"
                aria-selected={view === t.v}
                onClick={() => setView(t.v)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-colors",
                  view === t.v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <t.icon className="size-4" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="scrollbar-none -mx-3 flex items-center gap-2 overflow-x-auto px-3 sm:-mx-4 sm:px-4 xl:mx-0 xl:flex-1 xl:px-0">
          <div className="flex shrink-0 rounded-md border p-0.5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatus(f.value)}
                aria-pressed={status === f.value}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors",
                  status === f.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.value !== "all" && <span className="size-2 rounded-full" style={{ background: LOT_STATUS[f.value].color }} />}
                {f.label}
              </button>
            ))}
          </div>
          {blocks.length > 1 && (
            <Select value={block} onValueChange={setBlock}>
              <SelectTrigger className="h-10! shrink-0 rounded-md px-4" aria-label="Îlot">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les îlots</SelectItem>
                {blocks.map((b) => (
                  <SelectItem key={b} value={b}>
                    Îlot {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {areas.length > 1 && (
            <Select value={area} onValueChange={setArea}>
              <SelectTrigger className="h-10! shrink-0 rounded-md px-4" aria-label="Surface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes surfaces</SelectItem>
                {areas.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {budgets.length > 0 && (
            <Select value={budget} onValueChange={setBudget}>
              <SelectTrigger className="h-10! shrink-0 rounded-md px-4" aria-label="Budget">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous budgets</SelectItem>
                {budgets.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {filtersActive && (
            <Button variant="ghost" className="h-10 shrink-0 rounded-md" onClick={resetFilters}>
              <RotateCcw />
              Réinitialiser
            </Button>
          )}
        </div>
      </div>

      {view === "plan" && (
        <div className="border-b px-3 py-2.5 sm:hidden">
          <PlanLegend counts={counts} className="gap-x-3 text-[0.7rem]" />
          <p className="mt-1 text-[0.7rem] text-muted-foreground">Touchez un terrain pour ouvrir sa fiche · pincez pour zoomer</p>
        </div>
      )}
      {view === "plan" ? (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="relative min-w-0">
            <PlanViewer
              imageUrl={settings.planImageUrl}
              width={settings.planWidth}
              height={settings.planHeight}
              lots={lots}
              selectedId={selectedId}
              onSelect={(lot) => select(lot)}
              isDimmed={filtersActive ? (lot) => !matches(lot as PublicLot) : undefined}
              focusSelected={focus}
              tooltip={(lot) => <PlanTooltip lot={byId.get(lot.id) ?? lot} currency={currency} />}
              className="aspect-[16/11] rounded-none sm:aspect-auto sm:h-[600px] lg:h-[660px]"
            >
              <div className="pointer-events-none absolute top-3 left-3 z-10 hidden max-w-[calc(100%-1.5rem)] rounded-lg border bg-background/90 px-3 py-2 shadow-sm backdrop-blur sm:block">
                <PlanLegend counts={counts} className="gap-x-3 text-[0.7rem] sm:text-xs" />
              </div>
              <p className="pointer-events-none absolute bottom-3 left-3 z-10 hidden rounded-md bg-background/85 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur sm:block">
                Cliquez sur un terrain pour voir sa fiche · double-clic pour zoomer
              </p>
            </PlanViewer>
          </div>

          <aside className="hidden flex-col border-l lg:flex">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="text-sm font-bold">
                {formatNumber(filtered.length)} terrain{filtered.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-muted-foreground">{formatNumber(filtered.filter((l) => l.status === "AVAILABLE").length)} disponibles</p>
            </div>
            <ul className="h-[612px] space-y-2 overflow-y-auto p-3">
              {filtered.length === 0 ? (
                <EmptyResults onReset={resetFilters} />
              ) : (
                filtered.map((lot) => (
                  <li key={lot.id}>
                    <LotCard lot={lot} currency={currency} selected={lot.id === selectedId} onSelect={() => select(lot, { focus: true })} compact />
                  </li>
                ))
              )}
            </ul>
          </aside>

          <div className="flex items-center justify-between gap-3 border-t px-4 py-3 lg:hidden">
            <p className="text-sm">
              <strong>{formatNumber(filtered.length)}</strong> terrain{filtered.length > 1 ? "s" : ""} ·{" "}
              <span className="text-muted-foreground">{formatNumber(filtered.filter((l) => l.status === "AVAILABLE").length)} disponibles</span>
            </p>
            <Button variant="outline" size="sm" className="rounded-md" onClick={() => setView("list")}>
              Voir la liste
              <ArrowRight />
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-3 sm:p-5">
          {filtered.length === 0 ? (
            <EmptyResults onReset={resetFilters} />
          ) : (
            <>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.slice(0, listLimit).map((lot) => (
                  <li key={lot.id}>
                    <LotCard lot={lot} currency={currency} selected={lot.id === selectedId} onSelect={() => select(lot, { focus: true })} />
                  </li>
                ))}
              </ul>
              {filtered.length > listLimit && (
                <div className="mt-5 text-center">
                  <Button variant="outline" className="h-10 rounded-md px-5" onClick={() => setListLimit((n) => n + LIST_STEP)}>
                    Afficher plus de terrains ({formatNumber(filtered.length - listLimit)})
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(open) => !open && close()}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={cn(
            "gap-0 p-0",
            isMobile ? "max-h-[92dvh] rounded-t-[1.75rem]" : "w-full data-[side=right]:sm:max-w-[480px]",
          )}
        >
          {selected && (
            <>
              <SheetHeader className="border-b px-5 py-4 pr-14">
                {isMobile && <span aria-hidden className="mx-auto -mt-1 mb-2 h-1.5 w-10 rounded-full bg-muted-foreground/25" />}
                <SheetTitle className="text-base">
                  {step === "details" ? `Terrain n° ${selected.number}` : `Réserver le terrain n° ${selected.number}`}
                </SheetTitle>
                <SheetDescription>
                  {step !== "details"
                    ? "Laissez vos coordonnées : un conseiller vous rappelle pour finaliser."
                    : `${formatArea(selected.areaM2)}${selected.block ? ` · Îlot ${selected.block}` : ""}${selected.price != null ? ` · ${formatMoney(selected.price, currency)}` : ""}`}
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-5 py-5">
                {step === "details" ? (
                  <LotDetails
                    lot={selected}
                    currency={currency}
                    similar={similar}
                    onSelectSimilar={(lot) => select(lot, { focus: true })}
                    companyName={settings.companyName}
                    companyWhatsapp={settings.companyWhatsapp}
                    showTitle={!isMobile}
                  />
                ) : (
                  <>
                    {step === "reserve" && (
                      <button onClick={() => setStep("details")} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="size-4" />
                        Retour à la fiche
                      </button>
                    )}
                    <ReservationForm
                      lot={selected}
                      companyName={settings.companyName}
                      companyWhatsapp={settings.companyWhatsapp}
                      onSuccess={() => setStep("done")}
                    />
                    {step === "done" && (
                      <Button variant="outline" className="mt-2 h-11 w-full rounded-md" onClick={close}>
                        Continuer à explorer le plan
                      </Button>
                    )}
                  </>
                )}
              </div>
              {step === "details" && (
                <div className="border-t bg-background/95 p-4 backdrop-blur">
                  {canReserve ? (
                    <Button onClick={() => setStep("reserve")} className="h-12 w-full rounded-md bg-gold text-base font-semibold text-gold-foreground hover:bg-gold/90">
                      Réserver ce terrain
                      <ArrowRight />
                    </Button>
                  ) : selected.status === "AVAILABLE" && settings.companyWhatsapp ? (
                    <Button asChild className="h-12 w-full rounded-md text-base">
                      <a
                        href={whatsappLink(settings.companyWhatsapp, `Bonjour, je suis intéressé(e) par le terrain n° ${selected.number}.`)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <WhatsAppIcon className="size-5" />
                        Nous contacter pour ce terrain
                      </a>
                    </Button>
                  ) : (
                    <Button variant="outline" className="h-12 w-full rounded-md text-base" onClick={() => setStatus("AVAILABLE")}>
                      <SlidersHorizontal />
                      Voir uniquement les terrains disponibles
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function PlanTooltip({ lot, currency }: { lot: PlanLot; currency: string }) {
  return (
    <div className="space-y-0.5">
      <p className="flex items-center gap-2 font-bold">
        Terrain n° {lot.number}
        <span className="size-2 rounded-full" style={{ background: LOT_STATUS[lot.status].color }} />
        <span className="text-xs font-medium text-muted-foreground">{LOT_STATUS[lot.status].label}</span>
      </p>
      <p className="text-xs text-muted-foreground tabular">
        {formatArea(lot.areaM2)}
        {lot.price != null && ` · ${formatMoney(lot.price, currency)}`}
      </p>
    </div>
  )
}

function EmptyResults({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <p className="font-semibold">Aucun terrain ne correspond à vos critères.</p>
      <p className="mt-1 text-sm text-muted-foreground">Élargissez votre recherche pour voir plus de terrains.</p>
      <Button variant="outline" className="mt-4 rounded-md" onClick={onReset}>
        <RotateCcw />
        Réinitialiser les filtres
      </Button>
    </div>
  )
}
