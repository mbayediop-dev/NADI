"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { UserPlus } from "lucide-react"
import { formatDate, formatMoney, initials } from "@/lib/format"
import { formatPhone } from "@/lib/phone"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DataTable, SortHeader } from "@/components/shared/data-table"
import { ToneBadge } from "@/components/shared/badges"
import { PaymentProgress } from "@/components/admin/sales/payment-progress"
import { BuyerFormDialog } from "@/components/admin/buyers/buyer-form-dialog"

export type BuyerRow = {
  id: string
  name: string
  phone: string
  email: string | null
  city: string | null
  lots: string[]
  contracted: number
  paid: number
  remaining: number
  overdue: number
  daysLate: number
  portalEnabled: boolean
  lastLoginAt: string | null
  createdAt: string
}

type Filter = "all" | "owners" | "late" | "prospects"
const FILTERS: { value: Filter; label: string; match: (r: BuyerRow) => boolean }[] = [
  { value: "all", label: "Tous", match: () => true },
  { value: "owners", label: "Propriétaires", match: (r) => r.lots.length > 0 },
  { value: "late", label: "En retard", match: (r) => r.overdue > 0 },
  { value: "prospects", label: "Sans terrain", match: (r) => r.lots.length === 0 },
]

export function BuyersTable({ rows, currency, canEdit }: { rows: BuyerRow[]; currency: string; canEdit: boolean }) {
  const [filter, setFilter] = React.useState<Filter>("all")
  const current = FILTERS.find((f) => f.value === filter)!
  const data = React.useMemo(() => rows.filter(current.match), [rows, current])

  const columns = React.useMemo<ColumnDef<BuyerRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => <SortHeader column={column}>Acheteur</SortHeader>,
        sortingFn: (a, b) => a.original.name.localeCompare(b.original.name, "fr"),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
              {initials(row.original.name)}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate font-semibold">{row.original.name}</p>
              <p className="text-xs text-muted-foreground tabular">{formatPhone(row.original.phone)}</p>
            </div>
          </div>
        ),
      },
      {
        id: "lots",
        accessorFn: (r) => r.lots.length,
        header: ({ column }) => <SortHeader column={column}>Terrains</SortHeader>,
        cell: ({ row }) =>
          row.original.lots.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {row.original.lots.map((n) => (
                <span key={n} className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary tabular">
                  {n}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Aucun</span>
          ),
      },
      {
        accessorKey: "contracted",
        meta: { className: "text-right" },
        header: ({ column }) => (
          <SortHeader column={column} align="right">
            Contractualisé
          </SortHeader>
        ),
        cell: ({ row }) => <span className="tabular">{row.original.contracted ? formatMoney(row.original.contracted, currency) : "—"}</span>,
      },
      {
        accessorKey: "paid",
        header: ({ column }) => <SortHeader column={column}>Payé</SortHeader>,
        cell: ({ row }) =>
          row.original.contracted > 0 ? (
            <div className="w-32 space-y-1.5">
              <p className="text-xs font-medium tabular">{formatMoney(row.original.paid, currency)}</p>
              <PaymentProgress progress={row.original.paid / row.original.contracted} overdueRatio={row.original.overdue / row.original.contracted} />
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
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
        accessorKey: "overdue",
        header: ({ column }) => <SortHeader column={column}>Situation</SortHeader>,
        cell: ({ row }) =>
          row.original.overdue > 0 ? (
            <ToneBadge tone="bg-status-sold/12 text-status-sold-strong ring-status-sold/30" dot>
              Retard · {formatMoney(row.original.overdue, currency)}
            </ToneBadge>
          ) : row.original.contracted > 0 && row.original.remaining <= 0 ? (
            <ToneBadge tone="bg-status-available/12 text-status-available-strong ring-status-available/30">Soldé</ToneBadge>
          ) : row.original.contracted > 0 ? (
            <ToneBadge tone="bg-primary/10 text-primary ring-primary/25">À jour</ToneBadge>
          ) : (
            <ToneBadge tone="bg-muted text-muted-foreground ring-border">Prospect</ToneBadge>
          ),
      },
      {
        accessorKey: "lastLoginAt",
        header: ({ column }) => <SortHeader column={column}>Espace client</SortHeader>,
        sortingFn: (a, b) => (a.original.lastLoginAt ?? "").localeCompare(b.original.lastLoginAt ?? ""),
        cell: ({ row }) => (
          <span className={cn("text-xs", !row.original.portalEnabled ? "text-destructive" : "text-muted-foreground")}>
            {!row.original.portalEnabled ? "Accès désactivé" : row.original.lastLoginAt ? `Vu le ${formatDate(row.original.lastLoginAt)}` : "Jamais connecté"}
          </span>
        ),
      },
    ],
    [currency],
  )

  return (
    <div className="space-y-4">
      <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
              filter === f.value ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
            )}
          >
            {f.label}
            <span className={cn("text-xs tabular", filter === f.value ? "text-primary-foreground/75" : "text-muted-foreground")}>{rows.filter(f.match).length}</span>
          </button>
        ))}
      </div>
      <DataTable
        columns={columns}
        data={data}
        getRowId={(r) => r.id}
        rowHref={(r) => `/admin/acheteurs/${r.id}`}
        searchPlaceholder="Nom, téléphone, e-mail, n° de terrain…"
        searchText={(r) => `${r.name} ${r.phone} ${formatPhone(r.phone)} ${r.email ?? ""} ${r.city ?? ""} ${r.lots.map((n) => `terrain ${n}`).join(" ")}`}
        initialSorting={[{ id: "name", desc: false }]}
        toolbar={
          canEdit && (
            <BuyerFormDialog
              trigger={
                <Button>
                  <UserPlus />
                  Nouvel acheteur
                </Button>
              }
            />
          )
        }
        empty="Aucun acheteur."
      />
    </div>
  )
}
