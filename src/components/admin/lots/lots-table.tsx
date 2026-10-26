"use client"

import * as React from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import {
  BadgeDollarSign,
  CircleDashed,
  Coins,
  Download,
  Ellipsis,
  Eye,
  FileSpreadsheet,
  Layers,
  MapPinned,
  Pencil,
  Plus,
  Repeat,
  Shapes,
  Sparkles,
  Star,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react"
import type { LotStatus } from "@/generated/prisma/enums"
import { formatArea, formatMoney, formatNumber } from "@/lib/format"
import { LOT_STATUS, LOT_STATUS_ORDER } from "@/lib/labels"
import { cn } from "@/lib/utils"
import type { AdminLotRow } from "@/lib/queries/lots"
import { useServerAction } from "@/hooks/use-server-action"
import { applyDefaultPlanToLots } from "@/app/admin/(app)/terrains/actions"
import { DataTable, SortHeader } from "@/components/shared/data-table"
import { LotStatusBadge } from "@/components/shared/badges"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { BULK_DIALOGS, type BulkKind } from "@/components/admin/lots/bulk-dialogs"

type Props = {
  rows: AdminLotRow[]
  currency: string
  blocks: string[]
  soilTypes: string[]
  canEdit: boolean
}

export function LotsTable({ rows, currency, blocks, soilTypes, canEdit }: Props) {
  const [status, setStatus] = React.useState<LotStatus | "ALL">("ALL")
  const [block, setBlock] = React.useState("ALL")
  const [noGeometry, setNoGeometry] = React.useState(false)
  const [bulk, setBulk] = React.useState<{ kind: BulkKind; rows: AdminLotRow[]; clear: () => void } | null>(null)
  const { run, pending } = useServerAction()

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { ALL: rows.length }
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1
    return c
  }, [rows])
  const missingGeometry = rows.filter((r) => !r.hasGeometry).length
  const withoutPlan = rows.filter((r) => !r.hasOwnPlan && r.price && (r.status === "AVAILABLE" || r.status === "RESERVED")).length

  const data = React.useMemo(
    () => rows.filter((r) => (status === "ALL" || r.status === status) && (block === "ALL" || r.block === block) && (!noGeometry || !r.hasGeometry)),
    [rows, status, block, noGeometry],
  )

  const columns = React.useMemo<ColumnDef<AdminLotRow, unknown>[]>(
    () => [
      {
        accessorKey: "number",
        header: ({ column }) => <SortHeader column={column}>N°</SortHeader>,
        sortingFn: (a, b) => a.original.number.localeCompare(b.original.number, "fr", { numeric: true }),
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <span className="grid h-7 min-w-9 place-items-center rounded-lg bg-secondary px-1.5 text-sm font-bold text-secondary-foreground tabular">{row.original.number}</span>
            {row.original.isFeatured && <Star className="size-3.5 fill-gold text-gold" aria-label="Mis en avant" />}
          </div>
        ),
      },
      {
        accessorKey: "block",
        meta: { className: "hidden md:table-cell" },
        header: ({ column }) => <SortHeader column={column}>Îlot</SortHeader>,
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.block ?? "—"}</span>,
      },
      {
        accessorKey: "areaM2",
        header: ({ column }) => <SortHeader column={column}>Surface</SortHeader>,
        cell: ({ row }) => <span className="tabular">{formatArea(row.original.areaM2)}</span>,
      },
      {
        accessorKey: "price",
        header: ({ column }) => <SortHeader column={column}>Prix</SortHeader>,
        sortUndefined: "last",
        cell: ({ row }) =>
          row.original.price ? (
            <div className="leading-tight">
              <p className="font-semibold tabular">{formatMoney(row.original.price, currency)}</p>
              <p className="text-xs text-muted-foreground tabular">{formatNumber(row.original.pricePerM2)} /m²</p>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Non défini</span>
          ),
      },
      {
        id: "deposit",
        meta: { className: "hidden md:table-cell" },
        accessorFn: (r) => r.plan?.deposit ?? null,
        header: ({ column }) => <SortHeader column={column}>Acompte</SortHeader>,
        cell: ({ row }) =>
          row.original.plan ? (
            <span className={cn("tabular", row.original.depositAmount == null && "text-muted-foreground italic")}>
              {row.original.plan.deposit > 0 ? formatMoney(row.original.plan.deposit, currency) : "Aucun"}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "plan",
        meta: { className: "hidden md:table-cell" },
        header: "Versements",
        cell: ({ row }) => {
          const plan = row.original.plan
          if (!plan) return <span className="text-muted-foreground">—</span>
          return (
            <div className={cn("leading-tight", !row.original.hasOwnPlan && "text-muted-foreground")}>
              <p className="text-sm tabular">{plan.count > 0 ? `${plan.count} × ${formatNumber(plan.perInstallment)}` : "Comptant"}</p>
              <p className="text-xs text-muted-foreground">
                {plan.count > 0 ? plan.per : ""}
                {!row.original.hasOwnPlan && " · par défaut"}
              </p>
            </div>
          )
        },
      },
      {
        accessorKey: "status",
        header: ({ column }) => <SortHeader column={column}>Statut</SortHeader>,
        sortingFn: (a, b) => LOT_STATUS_ORDER.indexOf(a.original.status) - LOT_STATUS_ORDER.indexOf(b.original.status),
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <LotStatusBadge status={row.original.status} />
            {row.original.openRequests > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex h-5 items-center rounded-full bg-gold/20 px-1.5 text-[0.68rem] font-bold text-gold-strong">
                    {row.original.openRequests} dem.
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {row.original.openRequests} demande{row.original.openRequests > 1 ? "s" : ""} en cours sur ce terrain
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        ),
      },
      {
        id: "buyer",
        meta: { className: "hidden md:table-cell" },
        accessorFn: (r) => r.sale?.buyerName ?? "",
        header: "Acheteur",
        cell: ({ row }) =>
          row.original.sale ? (
            <Link
              href={`/admin/acheteurs/${row.original.sale.buyerId}`}
              onClick={(e) => e.stopPropagation()}
              className="font-medium hover:text-primary hover:underline"
            >
              {row.original.sale.buyerName}
            </Link>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "geometry",
        meta: { className: "hidden md:table-cell" },
        header: () => <span className="sr-only">Plan</span>,
        cell: ({ row }) =>
          row.original.hasGeometry ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <MapPinned className="size-4 text-status-available-strong" />
              </TooltipTrigger>
              <TooltipContent>Dessiné sur le plan</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <CircleDashed className="size-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>Pas encore dessiné sur le plan</TooltipContent>
            </Tooltip>
          ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions terrain ${row.original.number}`}>
                  <Ellipsis />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem asChild>
                  <Link href={`/admin/terrains/${row.original.id}`}>
                    <Eye /> Voir la fiche
                  </Link>
                </DropdownMenuItem>
                {canEdit && (
                  <DropdownMenuItem asChild>
                    <Link href={`/admin/terrains/${row.original.id}/modifier`}>
                      <Pencil /> Modifier
                    </Link>
                  </DropdownMenuItem>
                )}
                {canEdit && !row.original.sale && row.original.status !== "UNAVAILABLE" && (
                  <DropdownMenuItem asChild>
                    <Link href={`/admin/ventes/nouvelle?lot=${row.original.id}`}>
                      <BadgeDollarSign /> Attribuer à un acheteur
                    </Link>
                  </DropdownMenuItem>
                )}
                {row.original.sale && (
                  <DropdownMenuItem asChild>
                    <Link href={`/admin/ventes/${row.original.sale.id}`}>
                      <Wallet /> Voir la vente
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href={`/admin/plan?lot=${row.original.id}`}>
                    <MapPinned /> Voir sur le plan
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [currency, canEdit],
  )

  const BulkDialog = bulk ? BULK_DIALOGS[bulk.kind] : null

  return (
    <div className="space-y-4">
      {/* Filtres rapides par statut */}
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {(["ALL", ...LOT_STATUS_ORDER] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all",
              status === s ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-card hover:bg-muted",
            )}
          >
            {s !== "ALL" && <span className="size-2.5 rounded-full" style={{ background: LOT_STATUS[s].color }} />}
            {s === "ALL" ? "Tous" : LOT_STATUS[s].label}
            <span className={cn("tabular", status === s ? "text-primary-foreground/75" : "text-muted-foreground")}>{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>

      {canEdit && (missingGeometry > 0 || withoutPlan > 0) && (
        <div className="flex flex-col gap-2 md:flex-row">
          {missingGeometry > 0 && (
            <div className="flex flex-1 items-center gap-3 rounded-xl border border-dashed bg-card px-4 py-3 text-sm">
              <Shapes className="size-4 shrink-0 text-gold-strong" />
              <span className="flex-1">
                <strong>{missingGeometry}</strong> terrain{missingGeometry > 1 ? "s" : ""} pas encore dessiné{missingGeometry > 1 ? "s" : ""} sur le plan.
              </span>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/plan?edit=1">Dessiner</Link>
              </Button>
            </div>
          )}
          {withoutPlan > 0 && (
            <div className="flex flex-1 items-center gap-3 rounded-xl border border-dashed bg-card px-4 py-3 text-sm">
              <Sparkles className="size-4 shrink-0 text-gold-strong" />
              <span className="flex-1">
                <strong>{withoutPlan}</strong> terrain{withoutPlan > 1 ? "s" : ""} utilise{withoutPlan > 1 ? "nt" : ""} les modalités par défaut.
              </span>
              <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => applyDefaultPlanToLots())}>
                Les figer
              </Button>
            </div>
          )}
        </div>
      )}

      <DataTable
        columns={columns}
        data={data}
        getRowId={(r) => r.id}
        searchPlaceholder="N°, îlot, acheteur, type de sol…"
        searchText={(r) => [r.number, r.block, r.sale?.buyerName, r.soilType, `ilot ${r.block}`].filter(Boolean).join(" ")}
        rowHref={(r) => `/admin/terrains/${r.id}`}
        initialSorting={[{ id: "number", desc: false }]}
        pageSize={50}
        enableSelection={canEdit}
        rowClassName={(r) => (r.status === "UNAVAILABLE" ? "opacity-70" : undefined)}
        empty="Aucun terrain ne correspond à ces filtres."
        toolbar={
          <>
            <Select value={block} onValueChange={setBlock}>
              <SelectTrigger className="h-9 w-[150px]">
                <Layers className="size-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les îlots</SelectItem>
                {blocks.map((b) => (
                  <SelectItem key={b} value={b}>
                    Îlot {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant={noGeometry ? "secondary" : "outline"} size="sm" className="h-9" onClick={() => setNoGeometry((v) => !v)}>
              <CircleDashed />
              Sans plan
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <FileSpreadsheet />
                  Excel
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Fichiers Excel</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <a href="/api/admin/export/terrains">
                    <Download /> Exporter la liste des terrains
                  </a>
                </DropdownMenuItem>
                {canEdit && (
                  <>
                    <DropdownMenuItem asChild>
                      <a href="/api/admin/import-template">
                        <FileSpreadsheet /> Télécharger le modèle d&apos;import
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin/terrains/import">
                        <Upload /> Importer un fichier…
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {canEdit && (
              <Button size="sm" className="h-9" asChild>
                <Link href="/admin/terrains/nouveau">
                  <Plus />
                  Nouveau terrain
                </Link>
              </Button>
            )}
          </>
        }
        selectionBar={(selected, clear) => (
          <>
            <Button size="sm" variant="outline" onClick={() => setBulk({ kind: "price", rows: selected, clear })}>
              <Coins /> Prix
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulk({ kind: "deposit", rows: selected, clear })}>
              <Wallet /> Acompte
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulk({ kind: "plan", rows: selected, clear })}>
              <Repeat /> Modalités
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulk({ kind: "status", rows: selected, clear })}>
              <CircleDashed /> Statut
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulk({ kind: "soil", rows: selected, clear })}>
              <Layers /> Sol
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setBulk({ kind: "delete", rows: selected, clear })}>
              <Trash2 /> Supprimer
            </Button>
          </>
        )}
      />

      {bulk && BulkDialog && (
        <BulkDialog
          rows={bulk.rows}
          currency={currency}
          soilTypes={soilTypes}
          onDone={bulk.clear}
          onOpenChange={(open) => !open && setBulk(null)}
        />
      )}
    </div>
  )
}
