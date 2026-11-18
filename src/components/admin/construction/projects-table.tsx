"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import type { ConstructionStatus, LandOrigin } from "@/generated/prisma/enums"
import { formatDate, formatMoney, formatNumber } from "@/lib/format"
import { CONSTRUCTION_STATUS, LAND_ORIGIN } from "@/lib/labels"
import { formatPhone } from "@/lib/phone"
import { cn } from "@/lib/utils"
import { DataTable, SortHeader } from "@/components/shared/data-table"
import { ToneBadge } from "@/components/shared/badges"
import { PaymentProgress } from "@/components/admin/sales/payment-progress"

export type ProjectRow = {
  id: string
  reference: string
  title: string
  status: ConstructionStatus
  clientName: string
  phone: string
  hasAccount: boolean
  landOrigin: LandOrigin
  land: string
  contract: number
  paid: number
  spent: number
  overdue: number
  progress: number
  createdAt: string
}

export type ProjectsFilter = "all" | "requests" | "study" | "works" | "delivered" | "cancelled"

const FILTER_LABELS: Record<ProjectsFilter, string> = {
  all: "Tous",
  requests: "Demandes",
  study: "Études et offres",
  works: "Chantiers",
  delivered: "Livrés",
  cancelled: "Sans suite",
}

const match = (row: ProjectRow, filter: ProjectsFilter) => {
  switch (filter) {
    case "all":
      return true
    case "requests":
      return row.status === "REQUESTED"
    case "study":
      return row.status === "STUDY" || row.status === "OFFER_SENT"
    case "works":
      return row.status === "SIGNED" || row.status === "IN_PROGRESS" || row.status === "SUSPENDED"
    case "delivered":
      return row.status === "DELIVERED"
    case "cancelled":
      return row.status === "CANCELLED"
  }
}

export function ProjectsTable({ rows, currency, initialFilter }: { rows: ProjectRow[]; currency: string; initialFilter: ProjectsFilter }) {
  const [filter, setFilter] = React.useState<ProjectsFilter>(initialFilter)
  const data = React.useMemo(() => rows.filter((r) => match(r, filter)), [rows, filter])

  const columns = React.useMemo<ColumnDef<ProjectRow, unknown>[]>(
    () => [
      {
        accessorKey: "reference",
        header: ({ column }) => <SortHeader column={column}>Projet</SortHeader>,
        cell: ({ row }) => (
          <div className="min-w-0 leading-tight">
            <p className="max-w-56 truncate font-semibold">{row.original.title}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.reference} · {formatDate(row.original.createdAt)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "clientName",
        header: ({ column }) => <SortHeader column={column}>Client</SortHeader>,
        cell: ({ row }) => (
          <div className="leading-tight">
            <p className="font-medium">{row.original.clientName}</p>
            <p className="text-xs text-muted-foreground tabular">
              {formatPhone(row.original.phone)}
              {!row.original.hasAccount && " · sans espace client"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "land",
        header: "Terrain",
        cell: ({ row }) => (
          <div className="leading-tight">
            <p className="max-w-44 truncate">{row.original.land}</p>
            <p className="text-xs text-muted-foreground">{LAND_ORIGIN[row.original.landOrigin].short}</p>
          </div>
        ),
      },
      {
        accessorKey: "contract",
        header: ({ column }) => (
          <SortHeader column={column} align="right">
            Contrat
          </SortHeader>
        ),
        cell: ({ row }) =>
          row.original.contract > 0 ? (
            <div className="ml-auto w-32 text-right">
              <p className="font-semibold tabular">{formatMoney(row.original.contract, currency)}</p>
              <PaymentProgress progress={row.original.paid / row.original.contract} overdueRatio={row.original.overdue / row.original.contract} className="mt-1.5" />
              <p className={cn("mt-1 text-xs tabular", row.original.overdue > 0 ? "text-status-sold-strong" : "text-muted-foreground")}>
                {row.original.overdue > 0 ? `${formatMoney(row.original.overdue, currency)} en retard` : `${formatMoney(row.original.paid, currency)} reçus`}
              </p>
            </div>
          ) : (
            <p className="text-right text-muted-foreground">—</p>
          ),
      },
      {
        accessorKey: "spent",
        header: ({ column }) => (
          <SortHeader column={column} align="right">
            Dépensé
          </SortHeader>
        ),
        cell: ({ row }) => <p className="text-right tabular">{row.original.spent > 0 ? formatMoney(row.original.spent, currency) : "—"}</p>,
      },
      {
        accessorKey: "status",
        header: "Étape",
        cell: ({ row }) => (
          <div className="flex flex-col items-start gap-1">
            <ToneBadge tone={CONSTRUCTION_STATUS[row.original.status].tone}>{CONSTRUCTION_STATUS[row.original.status].label}</ToneBadge>
            {row.original.progress > 0 && <span className="text-xs text-muted-foreground tabular">Chantier à {row.original.progress} %</span>}
          </div>
        ),
      },
    ],
    [currency],
  )

  return (
    <div className="space-y-4">
      <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        {(Object.keys(FILTER_LABELS) as ProjectsFilter[]).map((f) => {
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
      <DataTable
        columns={columns}
        data={data}
        getRowId={(r) => r.id}
        rowHref={(r) => `/admin/construction/${r.id}`}
        searchPlaceholder="Référence, client, terrain…"
        searchText={(r) => `${r.reference} ${r.title} ${r.clientName} ${r.phone} ${r.land}`}
        rowClassName={(r) => (r.status === "CANCELLED" ? "opacity-60" : undefined)}
        empty={`Aucun projet${filter !== "all" ? ` dans « ${FILTER_LABELS[filter].toLowerCase()} »` : ""}. ${formatNumber(rows.length)} au total.`}
      />
    </div>
  )
}
