"use client"

import * as React from "react"
import { TransformComponent, TransformWrapper, useControls, type ReactZoomPanPinchContentRef } from "react-zoom-pan-pinch"
import { Expand, Minus, Plus, Scan, Shrink } from "lucide-react"
import type { LotStatus } from "@/generated/prisma/enums"
import { cn } from "@/lib/utils"
import { LOT_STATUS } from "@/lib/labels"
import { bbox, centroid, toSvgPoints, type Point } from "@/lib/plan"
import { Button } from "@/components/ui/button"

export type PlanLot = {
  id: string
  number: string
  status: LotStatus
  polygon: Point[] | null
  areaM2: number
  price: number | null
  block?: string | null
}

type PlanViewerProps = {
  imageUrl: string | null
  width: number
  height: number
  lots: PlanLot[]
  selectedId?: string | null
  onSelect?: (lot: PlanLot) => void
  /** Terrains estompés (ne correspondant pas aux filtres) */
  isDimmed?: (lot: PlanLot) => boolean
  /** Terrains mis en évidence (ex. : les terrains du propriétaire connecté) */
  highlightIds?: string[]
  tooltip?: (lot: PlanLot) => React.ReactNode
  /** Zoom à la molette (désactivé par défaut pour ne pas bloquer le défilement de la page) */
  wheelZoom?: boolean
  /** Zoomer automatiquement sur le terrain sélectionné */
  focusSelected?: boolean
  showLabels?: boolean
  className?: string
  /** Contenu superposé (légende, filtres…) */
  children?: React.ReactNode
  /** Contenu supplémentaire dessiné dans le SVG, en coordonnées du plan */
  overlay?: React.ReactNode
  /** Rend la couche SVG interactive pour l'édition (clics transmis) */
  onCanvasPointer?: (event: React.PointerEvent<SVGSVGElement>, point: Point, phase: "down" | "move" | "up") => void
  panningDisabled?: boolean
  cursor?: string
}

/** Statuts à fond clair : numéro écrit en foncé */
const DARK_LABEL = new Set<LotStatus>(["RESERVED", "UNAVAILABLE"])

const STATUS_FILL: Record<LotStatus, string> = {
  AVAILABLE: "var(--status-available)",
  RESERVED: "var(--status-reserved)",
  SOLD: "var(--status-sold)",
  UNAVAILABLE: "url(#plan-hatch)",
}

export function PlanViewer({
  imageUrl,
  width,
  height,
  lots,
  selectedId,
  onSelect,
  isDimmed,
  highlightIds,
  tooltip,
  wheelZoom = false,
  focusSelected = false,
  showLabels = true,
  className,
  children,
  overlay,
  onCanvasPointer,
  panningDisabled = false,
  cursor,
}: PlanViewerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const controlsRef = React.useRef<ReactZoomPanPinchContentRef>(null)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [size, setSize] = React.useState<{ w: number; h: number } | null>(null)
  const [expanded, setExpanded] = React.useState(false)
  const [hover, setHover] = React.useState<{ lot: PlanLot; x: number; y: number } | null>(null)
  const pointerStart = React.useRef<{ x: number; y: number } | null>(null)

  // Mesure du conteneur pour calculer l'échelle « tout afficher »
  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry.contentRect
      setSize((prev) => (prev && Math.abs(prev.w - w) < 2 && Math.abs(prev.h - h) < 2 ? prev : { w, h }))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false)
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [expanded])

  const fitScale = size ? Math.min(size.w / width, size.h / height) : 1

  const shapes = React.useMemo(
    () =>
      lots
        .filter((lot) => lot.polygon && lot.polygon.length >= 3)
        .map((lot) => {
          const pts = lot.polygon as Point[]
          const [cx, cy] = centroid(pts)
          const box = bbox(pts)
          const minSide = Math.min((box.maxX - box.minX) * width, (box.maxY - box.minY) * height)
          return {
            lot,
            points: toSvgPoints(pts, width, height),
            cx: cx * width,
            cy: cy * height,
            fontSize: Math.max(10, Math.min(30, minSide * 0.34)),
          }
        }),
    [lots, width, height],
  )

  // Zoom sur le terrain sélectionné (y compris au premier affichage, une fois le zoom initialisé)
  const [initCount, setInitCount] = React.useState(0)
  React.useEffect(() => {
    if (!focusSelected || !selectedId || !controlsRef.current || !size || initCount === 0) return
    const shape = lots.find((lot) => lot.id === selectedId)?.polygon
    if (!shape || shape.length < 3) return
    const box = bbox(shape)
    const bw = Math.max(1, (box.maxX - box.minX) * width)
    const bh = Math.max(1, (box.maxY - box.minY) * height)
    const scale = Math.max(fitScale, Math.min(fitScale * 3.2, (0.55 * size.w) / bw, (0.55 * size.h) / bh))
    const cx = ((box.minX + box.maxX) / 2) * width
    const cy = ((box.minY + box.maxY) / 2) * height
    controlsRef.current.setTransform(size.w / 2 - cx * scale, size.h / 2 - cy * scale, scale, 450)
  }, [focusSelected, selectedId, fitScale, initCount, size, lots, width, height])

  const highlight = React.useMemo(() => new Set(highlightIds ?? []), [highlightIds])

  function toPlanPoint(event: React.PointerEvent<SVGSVGElement>): Point {
    const svg = svgRef.current
    if (!svg) return [0, 0]
    const rect = svg.getBoundingClientRect()
    return [(event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height]
  }

  function handleLotPointerUp(event: React.PointerEvent, lot: PlanLot) {
    const start = pointerStart.current
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return
    onSelect?.(lot)
  }

  function handleHover(event: React.PointerEvent, lot: PlanLot | null) {
    if (!tooltip || event.pointerType === "touch") return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || !lot) return setHover(null)
    setHover({ lot, x: event.clientX - rect.left, y: event.clientY - rect.top })
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative isolate overflow-hidden bg-[oklch(0.95_0.02_95)] select-none",
        expanded ? "fixed inset-0 z-50 h-dvh w-screen rounded-none" : "rounded-2xl",
        className,
      )}
      onPointerLeave={() => setHover(null)}
    >
      {size && (
        <TransformWrapper
          key={`${Math.round(size.w)}x${Math.round(size.h)}`}
          ref={controlsRef}
          initialScale={fitScale}
          minScale={fitScale}
          maxScale={fitScale * 8}
          centerOnInit
          centerZoomedOut
          limitToBounds
          wheel={{ disabled: !wheelZoom && !expanded, step: 0.12 }}
          panning={{ disabled: panningDisabled, velocityDisabled: true }}
          doubleClick={{ disabled: !!onCanvasPointer, mode: "zoomIn", step: 0.8 }}
          pinch={{ step: 6 }}
          onInit={() => setInitCount((n) => n + 1)}
        >
          <TransformComponent
            wrapperStyle={{ width: "100%", height: "100%" }}
            contentStyle={{ width, height }}
          >
            <div className="relative" style={{ width, height }}>
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="Plan du lotissement" draggable={false} className="pointer-events-none absolute inset-0 size-full" />
              ) : (
                <div className="bg-dots absolute inset-0 text-foreground/40" />
              )}
              <svg
                ref={svgRef}
                viewBox={`0 0 ${width} ${height}`}
                className="absolute inset-0 size-full"
                style={{ cursor }}
                onPointerDown={(e) => {
                  pointerStart.current = { x: e.clientX, y: e.clientY }
                  onCanvasPointer?.(e, toPlanPoint(e), "down")
                }}
                onPointerMove={onCanvasPointer ? (e) => onCanvasPointer(e, toPlanPoint(e), "move") : undefined}
                onPointerUp={onCanvasPointer ? (e) => onCanvasPointer(e, toPlanPoint(e), "up") : undefined}
              >
                <defs>
                  <pattern id="plan-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="10" height="10" fill="oklch(0.86 0.01 240)" />
                    <line x1="0" y1="0" x2="0" y2="10" stroke="oklch(0.7 0.01 240)" strokeWidth="4" />
                  </pattern>
                  <filter id="plan-glow" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="oklch(0.25 0.04 170)" floodOpacity="0.45" />
                  </filter>
                </defs>
                {shapes.map(({ lot, points, cx, cy, fontSize }) => {
                  const dimmed = isDimmed?.(lot) ?? false
                  const selected = lot.id === selectedId
                  const highlighted = highlight.has(lot.id)
                  return (
                    <g
                      key={lot.id}
                      id={`plan-lot-${lot.id}`}
                      className={cn("group/lot transition-opacity", onSelect && "cursor-pointer")}
                      style={{ opacity: dimmed ? 0.28 : 1 }}
                      onPointerUp={onSelect ? (e) => handleLotPointerUp(e, lot) : undefined}
                      onPointerMove={(e) => handleHover(e, lot)}
                      onPointerLeave={() => setHover(null)}
                      role={onSelect ? "button" : undefined}
                      aria-label={`Terrain ${lot.number}, ${LOT_STATUS[lot.status].label}`}
                    >
                      <polygon
                        points={points}
                        fill={STATUS_FILL[lot.status]}
                        fillOpacity={lot.status === "UNAVAILABLE" ? 0.85 : selected ? 0.95 : lot.status === "RESERVED" ? 0.9 : 0.72}
                        stroke={selected || highlighted ? "var(--gold)" : "white"}
                        strokeWidth={selected ? 6 : highlighted ? 5 : 2}
                        strokeLinejoin="round"
                        filter={selected ? "url(#plan-glow)" : undefined}
                        className="transition-[fill-opacity] duration-150 group-hover/lot:[fill-opacity:0.92]"
                      />
                      {showLabels && (
                        <text
                          x={cx}
                          y={cy}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={fontSize}
                          fontWeight={700}
                          fill={DARK_LABEL.has(lot.status) ? "oklch(0.3 0.03 80)" : "white"}
                          className="pointer-events-none tabular"
                          style={
                            DARK_LABEL.has(lot.status)
                              ? undefined
                              : { paintOrder: "stroke", stroke: "oklch(0.2 0.03 170 / 0.35)", strokeWidth: fontSize * 0.12 }
                          }
                        >
                          {lot.number}
                        </text>
                      )}
                      {highlighted && (
                        <circle cx={cx} cy={cy} r={fontSize * 1.4} fill="none" stroke="var(--gold)" strokeWidth={3} className="pointer-events-none origin-center animate-pulse" />
                      )}
                    </g>
                  )
                })}
                {overlay}
              </svg>
            </div>
          </TransformComponent>
          <PlanControls fitScale={fitScale} expanded={expanded} onToggleExpand={() => setExpanded((v) => !v)} />
        </TransformWrapper>
      )}

      {hover && tooltip && (
        <div
          className="pointer-events-none absolute z-20 w-max max-w-64 -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-xl border bg-popover/95 px-3 py-2 text-sm shadow-lg backdrop-blur"
          style={{ left: hover.x, top: hover.y }}
        >
          {tooltip(hover.lot)}
        </div>
      )}

      {children}
    </div>
  )
}

function PlanControls({
  fitScale,
  expanded,
  onToggleExpand,
}: {
  fitScale: number
  expanded: boolean
  onToggleExpand: () => void
}) {
  const { zoomIn, zoomOut, centerView } = useControls()
  return (
    <div className="absolute right-3 bottom-3 z-10 flex flex-col overflow-hidden rounded-xl border bg-background/90 shadow-sm backdrop-blur">
      <Button variant="ghost" size="icon" className="rounded-none" onClick={() => zoomIn(0.6)} aria-label="Zoomer">
        <Plus />
      </Button>
      <Button variant="ghost" size="icon" className="rounded-none border-t" onClick={() => zoomOut(0.6)} aria-label="Dézoomer">
        <Minus />
      </Button>
      <Button variant="ghost" size="icon" className="rounded-none border-t" onClick={() => centerView(fitScale, 300)} aria-label="Recentrer le plan">
        <Scan />
      </Button>
      <Button variant="ghost" size="icon" className="rounded-none border-t" onClick={onToggleExpand} aria-label={expanded ? "Quitter le plein écran" : "Plein écran"}>
        {expanded ? <Shrink /> : <Expand />}
      </Button>
    </div>
  )
}

export function PlanLegend({
  counts,
  className,
}: {
  counts?: Partial<Record<LotStatus, number>>
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-medium", className)}>
      {(Object.keys(LOT_STATUS) as LotStatus[]).map((status) => (
        <span key={status} className="inline-flex items-center gap-1.5">
          <span
            className="size-3 rounded-[4px] ring-1 ring-black/5"
            style={{
              background:
                status === "UNAVAILABLE"
                  ? "repeating-linear-gradient(45deg, oklch(0.86 0.01 240) 0 3px, oklch(0.7 0.01 240) 3px 5px)"
                  : LOT_STATUS[status].color,
            }}
          />
          {LOT_STATUS[status].label}
          {counts?.[status] != null && <span className="text-muted-foreground tabular">({counts[status]})</span>}
        </span>
      ))}
    </div>
  )
}
