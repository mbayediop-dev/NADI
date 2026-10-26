"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  BadgeDollarSign,
  Bookmark,
  BookmarkX,
  Check,
  CircleDashed,
  Eraser,
  Eye,
  ImageUp,
  MousePointerClick,
  Pencil,
  PenTool,
  Search,
  SquareDashed,
  Trash2,
  Undo2,
  Wallet,
  X,
} from "lucide-react"
import { toast } from "sonner"
import type { LotStatus } from "@/generated/prisma/enums"
import { centroid, type Point } from "@/lib/plan"
import { formatArea, formatMoney, formatNumber, formatPercent } from "@/lib/format"
import { LOT_STATUS, LOT_STATUS_ORDER } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { uploadFile } from "@/lib/upload-client"
import type { PaymentPlan } from "@/lib/finance"
import { useServerAction } from "@/hooks/use-server-action"
import { saveLotPolygon, updatePlanImage } from "@/app/admin/(app)/plan/actions"
import { setLotReservation } from "@/app/admin/(app)/terrains/actions"
import { PlanViewer, type PlanLot } from "@/components/plan/plan-viewer"
import { LotStatusBadge } from "@/components/shared/badges"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { ReserveDialog } from "@/components/admin/lots/lot-actions"
import { useDraft } from "@/components/admin/plan-editor/use-draft"

export type PanelLot = {
  id: string
  number: string
  block: string | null
  areaM2: number
  price: number | null
  status: LotStatus
  plan: PaymentPlan | null
  hasGeometry: boolean
  openRequests: number
  sale: { id: string; reference: string; buyerId: string; buyerName: string } | null
}

type Props = {
  imageUrl: string | null
  width: number
  height: number
  lots: PlanLot[]
  panel: PanelLot[]
  currency: string
  canEdit: boolean
  initialLotId?: string
  initialEdit?: boolean
}

export function AdminPlan({ imageUrl, width, height, lots, panel, currency, canEdit, initialLotId, initialEdit }: Props) {
  const router = useRouter()
  const [mode, setMode] = React.useState<"view" | "edit">(initialEdit && canEdit ? "edit" : "view")
  const [selectedId, setSelectedId] = React.useState<string | null>(initialLotId ?? null)
  const [statusFilter, setStatusFilter] = React.useState<LotStatus | null>(null)
  const [editingId, setEditingId] = React.useState<string | null>(initialEdit && initialLotId ? initialLotId : null)
  const panelRef = React.useRef<HTMLElement>(null)

  const byId = React.useMemo(() => new Map(panel.map((l) => [l.id, l])), [panel])
  const shapeById = React.useMemo(() => new Map(lots.map((l) => [l.id, l.polygon])), [lots])
  const counts = React.useMemo(() => {
    const c: Partial<Record<LotStatus, number>> = {}
    for (const l of panel) c[l.status] = (c[l.status] ?? 0) + 1
    return c
  }, [panel])

  const draft = useDraft(editingId ? (shapeById.get(editingId) ?? null) : null)
  const editing = editingId ? byId.get(editingId) : null

  function startEditing(id: string | null) {
    if (draft.dirty && !window.confirm("Abandonner les modifications non enregistrées ?")) return
    setEditingId(id)
    draft.reset(id ? (shapeById.get(id) ?? null) : null)
  }

  function select(lot: PlanLot) {
    if (mode === "edit") return startEditing(lot.id)
    setSelectedId(lot.id)
    if (window.innerWidth < 1024) panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  // Raccourcis clavier en édition
  React.useEffect(() => {
    if (mode !== "edit" || !editingId) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return
      if (e.key === "Enter") draft.close()
      else if (e.key === "Escape") draft.reset(shapeById.get(editingId) ?? null)
      else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault()
        draft.undo()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [mode, editingId, draft, shapeById])

  const viewerLots = mode === "edit" && editingId ? lots.filter((l) => l.id !== editingId) : lots
  const drawing = mode === "edit" && !!editingId
  const canPick = mode === "view" || !editingId || (draft.closed && !draft.dirty) || draft.points.length === 0

  return (
    <div className="space-y-4">
      {/* Barre d'outils */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {LOT_STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              disabled={mode === "edit"}
              onClick={() => setStatusFilter((cur) => (cur === s ? null : s))}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm font-medium transition-all disabled:opacity-50",
                statusFilter === s && "border-foreground/30 ring-2 ring-foreground/10",
                statusFilter && statusFilter !== s && "opacity-55",
              )}
            >
              <span
                className="size-2.5 rounded-full"
                style={{ background: s === "UNAVAILABLE" ? "repeating-linear-gradient(45deg,#cfd3d8 0 2px,#9aa1a9 2px 4px)" : LOT_STATUS[s].color }}
              />
              {LOT_STATUS[s].label}
              <span className="text-muted-foreground tabular">{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>
        {canEdit && (
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 md:ml-auto">
            {(["view", "edit"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  if (m === mode) return
                  if (m === "view") startEditing(null)
                  setMode(m)
                }}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all",
                  mode === m ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "view" ? <Eye className="size-4" /> : <PenTool className="size-4" />}
                {m === "view" ? "Consultation" : "Dessiner"}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 lg:h-[calc(100dvh-14.5rem)] lg:min-h-[560px] lg:flex-row">
        <div className="relative h-[58dvh] min-h-[360px] flex-1 lg:h-auto">
          <PlanViewer
            imageUrl={imageUrl}
            width={width}
            height={height}
            lots={viewerLots}
            selectedId={mode === "view" ? selectedId : null}
            focusSelected={mode === "view"}
            onSelect={canPick ? select : undefined}
            isDimmed={(l) => (drawing ? true : statusFilter != null && l.status !== statusFilter)}
            wheelZoom
            tooltip={(l) => <LotTooltip lot={byId.get(l.id)} currency={currency} />}
            className="absolute inset-0 border shadow-xs"
            onCanvasPointer={drawing ? draft.onPointer : undefined}
            panningDisabled={drawing && draft.tool === "rect"}
            cursor={drawing && !draft.closed ? "crosshair" : undefined}
            overlay={drawing ? <DraftOverlay draft={draft} width={width} height={height} label={editing?.number ?? ""} /> : null}
          >
            {drawing && (
              <div className="pointer-events-none absolute top-3 left-3 z-10 max-w-[calc(100%-5rem)] rounded-xl border bg-background/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
                <p className="font-semibold">Terrain n° {editing?.number}</p>
                <p className="text-muted-foreground">
                  {draft.closed
                    ? "Glissez les points pour ajuster · points dorés pour en ajouter"
                    : draft.tool === "rect"
                      ? "Cliquez-glissez pour tracer un rectangle"
                      : draft.points.length < 3
                        ? "Cliquez pour placer les sommets du terrain"
                        : "Cliquez sur le 1er point, double-cliquez ou Entrée pour fermer"}
                </p>
              </div>
            )}
          </PlanViewer>
        </div>

        <aside ref={panelRef} className="flex w-full shrink-0 scroll-mt-20 flex-col overflow-hidden rounded-2xl border bg-card shadow-xs lg:w-[360px]">
          {mode === "view" ? (
            <ViewPanel
              lot={selectedId ? (byId.get(selectedId) ?? null) : null}
              counts={counts}
              total={panel.length}
              missing={panel.filter((l) => !l.hasGeometry).length}
              currency={currency}
              canEdit={canEdit}
              onClose={() => setSelectedId(null)}
              onRedraw={(id) => {
                setMode("edit")
                startEditing(id)
              }}
              onStartEdit={() => setMode("edit")}
            />
          ) : (
            <EditPanel
              panel={panel}
              editing={editing ?? null}
              draft={draft}
              onPick={startEditing}
              onSaved={() => router.refresh()}
              planMeta={{ width, height }}
            />
          )}
        </aside>
      </div>
    </div>
  )
}

function LotTooltip({ lot, currency }: { lot?: PanelLot; currency: string }) {
  if (!lot) return null
  return (
    <div className="space-y-0.5">
      <p className="flex items-center gap-2 font-semibold">
        <span className="size-2 rounded-full" style={{ background: LOT_STATUS[lot.status].color }} />
        Terrain n° {lot.number}
        <span className="font-normal text-muted-foreground">· {LOT_STATUS[lot.status].label}</span>
      </p>
      <p className="text-xs text-muted-foreground tabular">
        {formatArea(lot.areaM2)}
        {lot.price ? ` · ${formatMoney(lot.price, currency)}` : ""}
      </p>
      {lot.sale && <p className="text-xs font-medium">{lot.sale.buyerName}</p>}
    </div>
  )
}

/** Les éléments « draggable » ne déclenchent pas le déplacement du plan (react-zoom-pan-pinch). */
const NO_PAN = { draggable: "true" } as unknown as React.SVGProps<SVGCircleElement>

function DraftOverlay({ draft, width, height, label }: { draft: ReturnType<typeof useDraft>; width: number; height: number; label: string }) {
  const toPx = ([x, y]: Point) => [x * width, y * height] as const
  const pts = draft.points.map(toPx)
  const path = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
  const last = pts[pts.length - 1]
  const cursor = draft.cursor ? toPx(draft.cursor) : null
  const rect =
    draft.rectStart && draft.cursor
      ? {
          x: Math.min(draft.rectStart[0], draft.cursor[0]) * width,
          y: Math.min(draft.rectStart[1], draft.cursor[1]) * height,
          w: Math.abs(draft.cursor[0] - draft.rectStart[0]) * width,
          h: Math.abs(draft.cursor[1] - draft.rectStart[1]) * height,
        }
      : null
  const center = draft.closed && draft.points.length >= 3 ? toPx(centroid(draft.points)) : null

  return (
    <g>
      {pts.length > 0 &&
        (draft.closed ? (
          <polygon points={path} fill="var(--gold)" fillOpacity={0.35} stroke="var(--gold-strong)" strokeWidth={3} strokeLinejoin="round" pointerEvents="none" />
        ) : (
          <polyline points={path} fill="none" stroke="var(--gold-strong)" strokeWidth={3} strokeDasharray="10 6" pointerEvents="none" />
        ))}
      {!draft.closed && last && cursor && draft.tool === "polygon" && (
        <line x1={last[0]} y1={last[1]} x2={cursor[0]} y2={cursor[1]} stroke="var(--gold-strong)" strokeWidth={2} strokeDasharray="4 6" pointerEvents="none" />
      )}
      {rect && <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill="var(--gold)" fillOpacity={0.3} stroke="var(--gold-strong)" strokeWidth={3} strokeDasharray="8 5" pointerEvents="none" />}
      {center && (
        <text x={center[0]} y={center[1]} textAnchor="middle" dominantBaseline="central" fontSize={24} fontWeight={800} fill="white" pointerEvents="none" style={{ paintOrder: "stroke", stroke: "oklch(0.3 0.05 70 / .5)", strokeWidth: 4 }}>
          {label}
        </text>
      )}
      {draft.closed &&
        pts.map(([x, y], i) => {
          const [nx, ny] = pts[(i + 1) % pts.length]
          return (
            <circle key={`m${i}`} data-mid={i} {...NO_PAN} cx={(x + nx) / 2} cy={(y + ny) / 2} r={6} fill="var(--gold)" stroke="white" strokeWidth={2} style={{ cursor: "copy" }} />
          )
        })}
      {pts.map(([x, y], i) => (
        <circle
          key={i}
          data-vertex={i}
          {...NO_PAN}
          cx={x}
          cy={y}
          r={!draft.closed && i === 0 && pts.length >= 3 ? 11 : 8}
          fill={!draft.closed && i === 0 && pts.length >= 3 ? "var(--gold)" : "white"}
          stroke="var(--primary)"
          strokeWidth={3}
          style={{ cursor: "move" }}
        />
      ))}
    </g>
  )
}

function ViewPanel({
  lot,
  counts,
  total,
  missing,
  currency,
  canEdit,
  onClose,
  onRedraw,
  onStartEdit,
}: {
  lot: PanelLot | null
  counts: Partial<Record<LotStatus, number>>
  total: number
  missing: number
  currency: string
  canEdit: boolean
  onClose: () => void
  onRedraw: (id: string) => void
  onStartEdit: () => void
}) {
  const { run, pending } = useServerAction()
  const [reserveOpen, setReserveOpen] = React.useState(false)

  if (!lot) {
    const forSale = total - (counts.UNAVAILABLE ?? 0)
    return (
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Vue d&apos;ensemble</p>
          <p className="mt-1 text-2xl font-bold">{formatNumber(total)} terrains</p>
          <p className="text-sm text-muted-foreground">{formatPercent(forSale ? (counts.SOLD ?? 0) / forSale : 0)} des lots commercialisables sont vendus</p>
        </div>
        <ul className="space-y-3">
          {LOT_STATUS_ORDER.map((s) => (
            <li key={s}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: s === "UNAVAILABLE" ? "#b5bac1" : LOT_STATUS[s].color }} />
                  {LOT_STATUS[s].label}
                </span>
                <span className="font-semibold tabular">{counts[s] ?? 0}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${total ? ((counts[s] ?? 0) / total) * 100 : 0}%`, background: s === "UNAVAILABLE" ? "#b5bac1" : LOT_STATUS[s].color }} />
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-auto space-y-3">
          <p className="flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
            <MousePointerClick className="mt-0.5 size-4 shrink-0" />
            Cliquez sur un terrain du plan pour afficher sa fiche et ses actions.
          </p>
          {canEdit && missing > 0 && (
            <button type="button" onClick={onStartEdit} className="flex w-full items-center gap-3 rounded-xl border border-dashed p-3 text-left text-sm hover:bg-muted/50">
              <CircleDashed className="size-4 shrink-0 text-gold-strong" />
              <span className="flex-1">
                <strong>{missing}</strong> terrain{missing > 1 ? "s" : ""} à dessiner sur le plan
              </span>
              <ArrowRight className="size-4" />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="relative bg-pine-deep p-5 text-white">
        <button type="button" onClick={onClose} className="absolute top-3 right-3 rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Fermer">
          <X className="size-4" />
        </button>
        <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">{lot.block ? `Îlot ${lot.block}` : "Terrain"}</p>
        <p className="mt-1 text-2xl font-bold">Terrain n° {lot.number}</p>
        <p className="text-sm text-white/70">{formatArea(lot.areaM2)}</p>
        <div className="mt-3 flex items-center gap-2">
          <LotStatusBadge status={lot.status} className="bg-white/95" />
          {lot.openRequests > 0 && (
            <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-gold-foreground">
              {lot.openRequests} demande{lot.openRequests > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
      <div className="flex-1 space-y-4 p-5">
        <div>
          <p className="text-xs text-muted-foreground">Prix</p>
          <p className="text-xl font-bold tabular">{lot.price ? formatMoney(lot.price, currency) : "Non défini"}</p>
          {lot.price && (
            <p className="text-xs text-muted-foreground tabular">
              {formatNumber(lot.price / lot.areaM2)} {currency} / m²
            </p>
          )}
        </div>
        {lot.plan && (
          <div className="rounded-xl border bg-muted/30 p-3 text-sm">
            <p>
              Acompte <strong className="tabular">{lot.plan.deposit ? formatMoney(lot.plan.deposit, currency) : "aucun"}</strong>
            </p>
            {lot.plan.count > 0 && (
              <p className="text-muted-foreground">
                puis {lot.plan.count} × <span className="font-medium text-foreground tabular">{formatMoney(lot.plan.perInstallment, currency)}</span> {lot.plan.per}
              </p>
            )}
          </div>
        )}
        {lot.sale && (
          <div className="rounded-xl border p-3 text-sm">
            <p className="text-xs text-muted-foreground">Acheteur</p>
            <Link href={`/admin/acheteurs/${lot.sale.buyerId}`} className="font-semibold hover:text-primary">
              {lot.sale.buyerName}
            </Link>
            <p className="text-xs text-muted-foreground">Vente {lot.sale.reference}</p>
          </div>
        )}
        {!lot.hasGeometry && <p className="text-xs text-muted-foreground">Ce terrain n&apos;est pas encore dessiné.</p>}
      </div>
      <div className="grid grid-cols-2 gap-2 border-t p-4">
        <Button variant="outline" asChild>
          <Link href={`/admin/terrains/${lot.id}`}>
            <Eye /> Fiche
          </Link>
        </Button>
        {canEdit && (
          <Button variant="outline" asChild>
            <Link href={`/admin/terrains/${lot.id}/modifier`}>
              <Pencil /> Modifier
            </Link>
          </Button>
        )}
        {lot.sale ? (
          <Button className="col-span-2" asChild>
            <Link href={`/admin/ventes/${lot.sale.id}`}>
              <Wallet /> Voir la vente
            </Link>
          </Button>
        ) : (
          canEdit &&
          lot.status !== "UNAVAILABLE" && (
            <Button className="col-span-2" asChild>
              <Link href={`/admin/ventes/nouvelle?lot=${lot.id}`}>
                <BadgeDollarSign /> Attribuer à un acheteur
              </Link>
            </Button>
          )
        )}
        {canEdit && !lot.sale && lot.status === "AVAILABLE" && (
          <Button variant="outline" onClick={() => setReserveOpen(true)}>
            <Bookmark /> Option
          </Button>
        )}
        {canEdit && !lot.sale && lot.status === "RESERVED" && (
          <Button variant="outline" disabled={pending} onClick={() => run(() => setLotReservation(lot.id, false))}>
            <BookmarkX /> Lever
          </Button>
        )}
        {canEdit && (
          <Button variant="outline" onClick={() => onRedraw(lot.id)}>
            <PenTool /> {lot.hasGeometry ? "Redessiner" : "Dessiner"}
          </Button>
        )}
      </div>
      <ReserveDialog lotId={lot.id} lotNumber={lot.number} open={reserveOpen} onOpenChange={setReserveOpen} />
    </div>
  )
}

function EditPanel({
  panel,
  editing,
  draft,
  onPick,
  onSaved,
  planMeta,
}: {
  panel: PanelLot[]
  editing: PanelLot | null
  draft: ReturnType<typeof useDraft>
  onPick: (id: string | null) => void
  onSaved: () => void
  planMeta: { width: number; height: number }
}) {
  const { run, pending } = useServerAction()
  const [query, setQuery] = React.useState("")
  const [onlyMissing, setOnlyMissing] = React.useState(true)
  const [uploading, setUploading] = React.useState<number | null>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const missing = panel.filter((l) => !l.hasGeometry)
  const list = panel.filter(
    (l) => (!onlyMissing || !l.hasGeometry || l.id === editing?.id) && (!query || l.number.toLowerCase().includes(query.toLowerCase()) || (l.block ?? "").toLowerCase() === query.toLowerCase()),
  )
  const nextMissing = missing.find((l) => l.id !== editing?.id)

  function save() {
    if (!editing) return
    run(() => saveLotPolygon(editing.id, draft.points), {
      onSuccess: () => {
        draft.setDirty(false)
        onSaved()
      },
    })
  }

  async function replaceImage(file: File) {
    try {
      setUploading(0)
      const dims = await new Promise<{ width: number; height: number }>((resolve) => {
        const url = URL.createObjectURL(file)
        const img = new Image()
        img.onload = () => {
          resolve({ width: img.naturalWidth || planMeta.width, height: img.naturalHeight || planMeta.height })
          URL.revokeObjectURL(url)
        }
        img.onerror = () => resolve(planMeta)
        img.src = url
      })
      const uploaded = await uploadFile(file, { scope: "public", folder: "plan", onProgress: setUploading })
      setUploading(null)
      run(() => updatePlanImage({ url: uploaded.url ?? "", width: Math.round(dims.width), height: Math.round(dims.height) }))
    } catch (error) {
      setUploading(null)
      toast.error(error instanceof Error ? error.message : "Téléversement impossible")
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {editing ? (
        <div className="space-y-3 border-b p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Dessin en cours</p>
              <p className="text-lg font-bold">Terrain n° {editing.number}</p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => onPick(null)} aria-label="Arrêter l'édition">
              <X />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {(
              [
                { tool: "polygon", label: "Polygone", icon: PenTool },
                { tool: "rect", label: "Rectangle", icon: SquareDashed },
              ] as const
            ).map(({ tool, label, icon: Icon }) => (
              <button
                key={tool}
                type="button"
                onClick={() => {
                  if (tool === "rect" && draft.points.length) draft.clear()
                  draft.setTool(tool)
                }}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-semibold",
                  draft.tool === tool ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {!draft.closed && draft.points.length > 0 && (
              <Button variant="outline" size="sm" onClick={draft.undo}>
                <Undo2 /> Dernier point
              </Button>
            )}
            {!draft.closed && draft.points.length >= 3 && (
              <Button variant="outline" size="sm" onClick={draft.close}>
                <Check /> Fermer la forme
              </Button>
            )}
            {draft.points.length > 0 && (
              <Button variant="outline" size="sm" onClick={draft.clear}>
                <Eraser /> Recommencer
              </Button>
            )}
            {editing.hasGeometry && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={pending}
                onClick={() =>
                  window.confirm(`Effacer la forme du terrain n° ${editing.number} ?`) &&
                  run(() => saveLotPolygon(editing.id, null), {
                    onSuccess: () => {
                      draft.reset(null)
                      onSaved()
                    },
                  })
                }
              >
                <Trash2 /> Effacer du plan
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" disabled={!draft.closed || !draft.dirty || pending} onClick={save}>
              {pending ? <Spinner /> : <Check />}
              Enregistrer la forme
            </Button>
            {!draft.dirty && nextMissing && (
              <Button variant="outline" onClick={() => onPick(nextMissing.id)} title="Terrain suivant à dessiner">
                N° {nextMissing.number} <ArrowRight />
              </Button>
            )}
          </div>
          <p className="text-[0.7rem] text-muted-foreground">Raccourcis : Entrée ferme la forme · Retour arrière annule le dernier point · Échap annule.</p>
        </div>
      ) : (
        <div className="border-b p-4">
          <p className="font-semibold">Choisissez un terrain à dessiner</p>
          <p className="text-sm text-muted-foreground">Sélectionnez-le dans la liste ou cliquez sur sa forme existante pour la modifier.</p>
        </div>
      )}

      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="N° ou îlot" className="h-8 pl-8" />
        </div>
        <Button variant={onlyMissing ? "secondary" : "outline"} size="sm" onClick={() => setOnlyMissing((v) => !v)}>
          {onlyMissing ? `À dessiner (${missing.length})` : "Tous"}
        </Button>
      </div>
      <ul className="max-h-72 min-h-0 flex-1 overflow-y-auto p-2 lg:max-h-none">
        {list.length === 0 && (
          <li className="px-3 py-8 text-center text-sm text-muted-foreground">
            {onlyMissing ? "Tous les terrains sont dessinés 🎉" : "Aucun terrain trouvé."}
          </li>
        )}
        {list.map((l) => (
          <li key={l.id}>
            <button
              type="button"
              onClick={() => onPick(l.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                editing?.id === l.id ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted",
              )}
            >
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: l.status === "UNAVAILABLE" ? "#b5bac1" : LOT_STATUS[l.status].color }} />
              <span className="flex-1 font-semibold">N° {l.number}</span>
              <span className="text-xs text-muted-foreground">{l.block ? `Îlot ${l.block}` : ""}</span>
              {l.hasGeometry ? <Check className="size-4 text-status-available-strong" /> : <CircleDashed className="size-4 text-muted-foreground" />}
            </button>
          </li>
        ))}
      </ul>

      <div className="border-t p-4">
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => e.target.files?.[0] && replaceImage(e.target.files[0])} />
        <Button variant="outline" className="w-full" disabled={uploading != null || pending} onClick={() => fileRef.current?.click()}>
          {uploading != null ? <Spinner /> : <ImageUp />}
          {uploading != null ? `Téléversement… ${Math.round(uploading * 100)} %` : "Remplacer l'image du plan"}
        </Button>
        {uploading != null && <Progress value={uploading * 100} className="mt-2 h-1" />}
        <p className="mt-2 text-[0.7rem] text-muted-foreground">
          Plan de géomètre (PNG, JPG, SVG). Les formes déjà dessinées gardent leur position relative : utilisez une image au même cadrage.
        </p>
      </div>
    </div>
  )
}
