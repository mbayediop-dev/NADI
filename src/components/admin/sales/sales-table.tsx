"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import type { SaleStatus } from "@/generated/prisma/enums"
import { compareLotNumbers, formatDate, formatMoney, formatNumber } from "@/lib/format"
import { SALE_STATUS } from "@/lib/labels"
import { formatPhone } from "@/lib/phone"
import { cn } from "@/lib/utils"
import { DataTable, SortHeader } from "@/components/shared/data-table"
import { ToneBadge } from "@/components/shared/badges"
import { PaymentProgress } from "@/components/admin/sales/payment-progress"

export type SaleRow = {
  id: string
  reference: string
  status: SaleStatus
  lotNumber: string
  lotBlock: string | null
  buyerName: string
  phone: string
  price: number
  paid: number
  remaining: number
  progress: number
  overdue: number
  daysLate: number
  nextDueDate: string | null
  nextDueAmount: number | null
  signedAt: string
}

export type SalesFilter = "all" | "active" | "late" | "completed" | "cancelled"

const FILTER_LABELS: Record<SalesFilter, string> = {
  all: "Toutes",
  active: "En cours",
  late: "En retard",
  completed: "Soldées",
  cancelled: "Annulées",
}

const match = (row: SaleRow, filter: SalesFilter) =>
  filter === "all"
    ? true
    : filter === "active"
      ? row.status === "ACTIVE"
      : filter === "late"
        ? row.overdue > 0
        : filter === "completed"
          ? row.status === "COMPLETED"
          : row.status === "CANCELLED"

export function SalesTable({ rows, currency, initialFilter }: { rows: SaleRow[]; currency: string; initialFilter: SalesFilter }) {
  const [filter, setFilter] = React.useState<SalesFilter>(initialFilter)
  const data = React.useMemo(() => rows.filter((r) => match(r, filter)), [rows, filter])
  const totals = React.useMemo(
    () => ({ price: data.reduce((s, r) => s + r.price, 0), paid: data.reduce((s, r) => s + r.paid, 0), remaining: data.reduce((s, r) => s + r.remaining, 0) }),
    [data],
  )

  const columns = React.useMemo<ColumnDef<SaleRow, unknown>[]>(
    () => [
      {
        accessorKey: "lotNumber",
        header: ({ column }) => <SortHeader column={column}>Terrain</SortHeader>,
        sortingFn: (a, b) => compareLotNumbers(a.original.lotNumber, b.original.lotNumber),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-sm font-bold text-primary tabular">{row.original.lotNumber}</span>
            <div className="leading-tight">
              <p className="font-semibold">{row.original.reference}</p>
              <p className="text-xs text-muted-foreground">
                {row.original.lotBlock ? `Îlot ${row.original.lotBlock} · ` : ""}
                {formatDate(row.original.signedAt)}
              </p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "buyerName",
        header: ({ column }) => <SortHeader column={column}>Acheteur</SortHeader>,
        cell: ({ row }) => (
          <div className="leading-tight">
            <p className="font-medium">{row.original.buyerName}</p>
            <p className="text-xs text-muted-foreground tabular">{formatPhone(row.original.phone)}</p>
          </div>
        ),
      },
      {
        accessorKey: "price",
        meta: { className: "text-right" },
        header: ({ column }) => (
          <SortHeader column={column} align="right">
            Prix
          </SortHeader>
        ),
        cell: ({ row }) => <span className="tabular">{formatMoney(row.original.price, currency)}</span>,
      },
      {
        accessorKey: "progress",
        header: ({ column }) => <SortHeader column={column}>Payé</SortHeader>,
        cell: ({ row }) => (
          <div className="w-36 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium tabular">{formatMoney(row.original.paid, currency)}</span>
              <span className="text-muted-foreground tabular">{Math.round(row.original.progress * 100)} %</span>
            </div>
            <PaymentProgress progress={row.original.progress} overdueRatio={row.original.overdue / row.original.price} />
          </div>
        ),
      },
      {
        accessorKey: "remaining",
        meta: { className: "text-right" },
        header: ({ column }) => (
          <SortHeader column={column} align="right">
            Reste
          </SortHeader>
        ),
        cell: ({ row }) => <span className="font-medium tabular">{row.original.remaining > 0 ? formatMoney(row.original.remaining, currency) : "—"}</span>,
      },
      {
        accessorKey: "nextDueDate",
        header: ({ column }) => <SortHeader column={column}>Prochaine échéance</SortHeader>,
        sortingFn: (a, b) => (a.original.nextDueDate ?? "9999").localeCompare(b.original.nextDueDate ?? "9999"),
        cell: ({ row }) =>
          row.original.nextDueDate ? (
            <div className="leading-tight">
              <p className={cn("text-sm tabular", row.original.overdue > 0 && "font-semibold text-status-sold-strong")}>{formatDate(row.original.nextDueDate)}</p>
              <p className="text-xs text-muted-foreground tabular">{formatMoney(row.original.nextDueAmount, currency)}</p>
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "overdue",
        header: ({ column }) => <SortHeader column={column}>Statut</SortHeader>,
        cell: ({ row }) =>
          row.original.overdue > 0 ? (
            <div className="flex flex-col items-start gap-1">
              <ToneBadge tone="bg-status-sold/12 text-status-sold-strong ring-status-sold/30" dot>
                Retard {row.original.daysLate} j
              </ToneBadge>
              <span className="text-xs text-status-sold-strong tabular">{formatMoney(row.original.overdue, currency)}</span>
            </div>
          ) : (
            <ToneBadge tone={SALE_STATUS[row.original.status].tone}>{SALE_STATUS[row.original.status].label}</ToneBadge>
          ),
      },
    ],
    [currency],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          {(Object.keys(FILTER_LABELS) as SalesFilter[]).map((f) => {
            const count = rows.filter((r) => match(r, f)).length
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
                  filter === f ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                )}
              >
                {FILTER_LABELS[f]}
                <span className={cn("text-xs tabular", filter === f ? "text-primary-foreground/75" : "text-muted-foreground")}>{count}</span>
              </button>
            )
          })}
        </div>
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">Contractualisé</dt>
            <dd className="font-semibold tabular">{formatMoney(totals.price, currency)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">Encaissé</dt>
            <dd className="font-semibold tabular">{formatMoney(totals.paid, currency)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">Reste</dt>
            <dd className="font-semibold tabular">{formatMoney(totals.remaining, currency)}</dd>
          </div>
        </dl>
      </div>
      <DataTable
        columns={columns}
        data={data}
        getRowId={(r) => r.id}
        rowHref={(r) => `/admin/ventes/${r.id}`}
        searchPlaceholder="Référence, acheteur, terrain…"
        searchText={(r) => `${r.reference} ${r.buyerName} ${r.phone} terrain ${r.lotNumber} ${r.lotBlock ?? ""}`}
        initialSorting={[{ id: "lotNumber", desc: false }]}
        rowClassName={(r) => (r.status === "CANCELLED" ? "opacity-60" : undefined)}
        empty={`Aucune vente${filter !== "all" ? ` « ${FILTER_LABELS[filter].toLowerCase()} »` : ""}. ${formatNumber(rows.length)} au total.`}
      />
    </div>
  )
}
