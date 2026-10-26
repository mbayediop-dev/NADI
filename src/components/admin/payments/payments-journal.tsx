"use client"

import * as React from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { endOfMonth, format, startOfMonth, startOfYear, subMonths } from "date-fns"
import { Download, Plus, ReceiptText } from "lucide-react"
import type { PaymentMethod } from "@/generated/prisma/enums"
import { formatDate, formatMoney, formatNumber } from "@/lib/format"
import { PAYMENT_METHOD } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable, SortHeader } from "@/components/shared/data-table"
import { MethodIcon } from "@/components/admin/payments/method-icon"
import { PaymentDialog } from "@/components/admin/payments/payment-dialog"

export type JournalRow = {
  id: string
  saleId: string
  saleCancelled: boolean
  receiptNumber: string
  paidAt: string
  amount: number
  method: PaymentMethod
  reference: string | null
  buyerName: string
  phone: string
  lotNumber: string
  recordedBy: string | null
}

type Period = "month" | "last-month" | "3-months" | "year" | "all" | "custom"
const PERIODS: { value: Period; label: string }[] = [
  { value: "month", label: "Ce mois" },
  { value: "last-month", label: "Mois dernier" },
  { value: "3-months", label: "3 derniers mois" },
  { value: "year", label: "Cette année" },
  { value: "all", label: "Tout" },
  { value: "custom", label: "Personnalisée" },
]

function range(period: Period, today: string, custom: { from: string; to: string }) {
  const now = new Date(`${today}T12:00:00`)
  const d = (x: Date) => format(x, "yyyy-MM-dd")
  switch (period) {
    case "month":
      return { from: d(startOfMonth(now)), to: d(endOfMonth(now)) }
    case "last-month":
      return { from: d(startOfMonth(subMonths(now, 1))), to: d(endOfMonth(subMonths(now, 1))) }
    case "3-months":
      return { from: d(startOfMonth(subMonths(now, 2))), to: d(endOfMonth(now)) }
    case "year":
      return { from: d(startOfYear(now)), to: d(now) }
    case "custom":
      return custom
    default:
      return { from: "", to: "" }
  }
}

export function PaymentsJournal({
  rows,
  currency,
  today,
  canEdit,
  smsDefault,
}: {
  rows: JournalRow[]
  currency: string
  today: string
  canEdit: boolean
  smsDefault: boolean
}) {
  const [period, setPeriod] = React.useState<Period>("all")
  const [custom, setCustom] = React.useState({ from: today.slice(0, 8) + "01", to: today })
  const [method, setMethod] = React.useState<PaymentMethod | "all">("all")
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const { from, to } = range(period, today, custom)

  const data = React.useMemo(
    () => rows.filter((r) => (!from || r.paidAt >= from) && (!to || r.paidAt <= to) && (method === "all" || r.method === method)),
    [rows, from, to, method],
  )
  const total = data.reduce((s, r) => s + r.amount, 0)
  const byMethod = React.useMemo(() => {
    const map = new Map<PaymentMethod, number>()
    for (const r of data) map.set(r.method, (map.get(r.method) ?? 0) + r.amount)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [data])

  const exportHref = `/api/admin/export/versements?${new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}), ...(method !== "all" ? { method } : {}) })}`

  const columns = React.useMemo<ColumnDef<JournalRow, unknown>[]>(
    () => [
      {
        accessorKey: "paidAt",
        header: ({ column }) => <SortHeader column={column}>Date</SortHeader>,
        cell: ({ row }) => (
          <div className="leading-tight">
            <p className="font-medium tabular">{formatDate(row.original.paidAt)}</p>
            <p className="text-xs text-muted-foreground tabular">{row.original.receiptNumber}</p>
          </div>
        ),
      },
      {
        accessorKey: "buyerName",
        header: ({ column }) => <SortHeader column={column}>Acheteur</SortHeader>,
        cell: ({ row }) => (
          <div className="leading-tight">
            <p className="font-medium">{row.original.buyerName}</p>
            <p className="text-xs text-muted-foreground">
              Terrain n°{row.original.lotNumber}
              {row.original.saleCancelled && " · vente annulée"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "method",
        header: "Mode",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <MethodIcon method={row.original.method} className="size-7 rounded-lg" />
            <div className="leading-tight">
              <p className="text-sm">{PAYMENT_METHOD[row.original.method]}</p>
              {row.original.reference && <p className="text-xs text-muted-foreground tabular">{row.original.reference}</p>}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "recordedBy",
        header: "Saisi par",
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.recordedBy ?? "—"}</span>,
      },
      {
        accessorKey: "amount",
        meta: { className: "text-right" },
        header: ({ column }) => (
          <SortHeader column={column} align="right">
            Montant
          </SortHeader>
        ),
        cell: ({ row }) => <span className="font-semibold tabular">{formatMoney(row.original.amount, currency)}</span>,
      },
      {
        id: "receipt",
        meta: { className: "w-10 text-right" },
        header: () => null,
        cell: ({ row }) => (
          <Button variant="ghost" size="icon-sm" asChild aria-label="Reçu" onClick={(e) => e.stopPropagation()}>
            <Link href={`/admin/versements/${row.original.id}/recu`}>
              <ReceiptText />
            </Link>
          </Button>
        ),
      },
    ],
    [currency],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Période</span>
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {period === "custom" && (
          <>
            <div className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Du</span>
              <Input type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="w-40" />
            </div>
            <div className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Au</span>
              <Input type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="w-40" />
            </div>
          </>
        )}
        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Mode de paiement</span>
          <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod | "all")}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les modes</SelectItem>
              {(Object.keys(PAYMENT_METHOD) as PaymentMethod[]).map((m) => (
                <SelectItem key={m} value={m}>
                  {PAYMENT_METHOD[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" asChild>
            <a href={exportHref}>
              <Download />
              Exporter
            </a>
          </Button>
          {canEdit && (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus />
              Nouveau versement
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border bg-card p-4 shadow-xs sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8 sm:p-5">
        <div>
          <p className="text-sm text-muted-foreground">
            Total {from || to ? `du ${from ? formatDate(from) : "début"} au ${to ? formatDate(to) : "aujourd'hui"}` : "encaissé"}
          </p>
          <p className="mt-1 text-3xl font-bold tracking-tight">{formatMoney(total, currency)}</p>
          <p className="text-xs text-muted-foreground">
            {formatNumber(data.length)} versement{data.length > 1 ? "s" : ""}
          </p>
        </div>
        {byMethod.length > 0 && (
          <div className="space-y-2">
            <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full">
              {byMethod.map(([m, amount], i) => (
                <div
                  key={m}
                  title={`${PAYMENT_METHOD[m]} : ${formatMoney(amount, currency)}`}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  style={{ width: `${(amount / total) * 100}%`, background: `color-mix(in oklch, var(--primary) ${100 - i * 16}%, var(--card))` }}
                />
              ))}
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {byMethod.map(([m, amount], i) => (
                <li key={m} className="flex items-center gap-1.5">
                  <span className="size-2 rounded-[2px]" style={{ background: `color-mix(in oklch, var(--primary) ${100 - i * 16}%, var(--card))` }} />
                  <span className="text-muted-foreground">{PAYMENT_METHOD[m]}</span>
                  <span className="font-medium tabular">{Math.round((amount / total) * 100)} %</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data}
        getRowId={(r) => r.id}
        rowHref={(r) => `/admin/ventes/${r.saleId}`}
        searchPlaceholder="Acheteur, terrain, n° de reçu, référence…"
        searchText={(r) => `${r.buyerName} ${r.phone} terrain ${r.lotNumber} ${r.receiptNumber} ${r.reference ?? ""}`}
        initialSorting={[{ id: "paidAt", desc: true }]}
        rowClassName={(r) => cn(r.saleCancelled && "opacity-60")}
        empty="Aucun versement sur cette période."
      />

      {canEdit && <PaymentDialog currency={currency} today={today} smsDefault={smsDefault} open={dialogOpen} onOpenChange={setDialogOpen} />}
    </div>
  )
}
