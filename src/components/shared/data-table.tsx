"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type FilterFn,
  type Row,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Search, X } from "lucide-react"
import type { Table } from "@tanstack/react-table"
import { cn } from "@/lib/utils"
import { formatNumber } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()

/** Recherche insensible aux accents sur toutes les colonnes ayant un accessorKey / accessorFn */
const accentInsensitive: FilterFn<unknown> = (row, columnId, filterValue) =>
  normalize(row.getValue(columnId)).includes(normalize(filterValue))

export type DataTableProps<T> = {
  columns: ColumnDef<T, unknown>[]
  data: T[]
  searchPlaceholder?: string
  /** Texte additionnel indexé pour la recherche (ex. : nom + téléphone) */
  searchText?: (row: T) => string
  toolbar?: React.ReactNode
  initialSorting?: SortingState
  pageSize?: number
  getRowId?: (row: T) => string
  rowHref?: (row: T) => string | null
  onRowClick?: (row: T) => void
  enableSelection?: boolean
  selectionBar?: (rows: T[], clear: () => void) => React.ReactNode
  empty?: React.ReactNode
  rowClassName?: (row: T) => string | undefined
  className?: string
}

export function DataTable<T>({
  columns,
  data,
  searchPlaceholder = "Rechercher…",
  searchText,
  toolbar,
  initialSorting = [],
  pageSize = 25,
  getRowId,
  rowHref,
  onRowClick,
  enableSelection = false,
  selectionBar,
  empty,
  rowClassName,
  className,
}: DataTableProps<T>) {
  const router = useRouter()
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting)
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  const allColumns = React.useMemo<ColumnDef<T, unknown>[]>(() => {
    const cols = [...columns]
    if (searchText) {
      cols.push({ id: "__search", accessorFn: (row) => searchText(row), enableHiding: true, header: () => null, cell: () => null })
    }
    if (!enableSelection) return cols
    return [
      {
        id: "__select",
        enableSorting: false,
        header: ({ table }) => (
          <Checkbox
            aria-label="Tout sélectionner"
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label="Sélectionner la ligne"
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            onClick={(e) => e.stopPropagation()}
          />
        ),
      },
      ...cols,
    ]
  }, [columns, enableSelection, searchText])

  const table = useReactTable({
    data,
    columns: allColumns,
    state: { sorting, globalFilter, rowSelection, columnVisibility: { __search: false } },
    getRowId,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    globalFilterFn: accentInsensitive as FilterFn<T>,
    getColumnCanGlobalFilter: () => true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: enableSelection,
    autoResetPageIndex: false,
    initialState: { pagination: { pageSize } },
  })

  // Revenir en page 1 lors d'une recherche
  React.useEffect(() => table.setPageIndex(0), [globalFilter, table])

  const selected = table.getSelectedRowModel().rows.map((r) => r.original)
  const filteredCount = table.getFilteredRowModel().rows.length
  const { pageIndex, pageSize: size } = table.getState().pagination
  const pageCount = table.getPageCount()

  function activate(row: Row<T>) {
    const href = rowHref?.(row.original)
    if (href) router.push(href)
    else onRowClick?.(row.original)
  }
  const clickable = !!rowHref || !!onRowClick

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 pl-9"
          />
          {globalFilter && (
            <button
              type="button"
              onClick={() => setGlobalFilter("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Effacer la recherche"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        {toolbar && <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{toolbar}</div>}
      </div>

      {enableSelection && selected.length > 0 && selectionBar && (
        <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 shadow-sm backdrop-blur">
          <span className="text-sm font-semibold">
            {formatNumber(selected.length)} sélectionné{selected.length > 1 ? "s" : ""}
          </span>
          <div className="flex flex-wrap items-center gap-2">{selectionBar(selected, () => setRowSelection({}))}</div>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setRowSelection({})}>
            Annuler
          </Button>
        </div>
      )}

      {/* Mobile : une carte par ligne */}
      <MobileCards table={table} onActivate={clickable ? activate : undefined} rowClassName={rowClassName} empty={globalFilter ? `Aucun résultat pour « ${globalFilter} ».` : (empty ?? "Aucune donnée pour le moment.")} />

      <div className="hidden overflow-hidden rounded-xl border bg-card shadow-xs md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b bg-muted/50">
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => (
                    <th
                      key={header.id}
                      className={cn(
                        "h-10 px-3 text-left align-middle text-xs font-medium whitespace-nowrap text-muted-foreground first:pl-4 last:pr-4",
                        header.column.id === "__select" && "w-10",
                        (header.column.columnDef.meta as { className?: string } | undefined)?.className,
                      )}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={allColumns.length} className="px-4 py-14 text-center text-sm text-muted-foreground">
                    {globalFilter ? `Aucun résultat pour « ${globalFilter} ».` : (empty ?? "Aucune donnée pour le moment.")}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    onClick={clickable ? () => activate(row) : undefined}
                    className={cn(
                      "transition-colors data-[state=selected]:bg-primary/5",
                      clickable && "cursor-pointer hover:bg-muted/50",
                      rowClassName?.(row.original),
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={cn(
                          "px-3 py-2.5 align-middle whitespace-nowrap first:pl-4 last:pr-4",
                          (cell.column.columnDef.meta as { className?: string } | undefined)?.className,
                        )}
                        onClick={cell.column.id === "__select" ? (e) => e.stopPropagation() : undefined}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col items-center justify-between gap-2 text-sm text-muted-foreground sm:flex-row">
        <p className="tabular">
          {filteredCount === 0
            ? "0 résultat"
            : `${formatNumber(pageIndex * size + 1)}–${formatNumber(Math.min((pageIndex + 1) * size, filteredCount))} sur ${formatNumber(filteredCount)}`}
        </p>
        <div className="flex items-center gap-2">
          <Select value={String(size)} onValueChange={(v) => table.setPageSize(Number(v))}>
            <SelectTrigger size="sm" className="w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Page précédente">
            <ChevronLeft />
          </Button>
          <span className="tabular">
            {pageCount === 0 ? 0 : pageIndex + 1} / {pageCount}
          </span>
          <Button variant="outline" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Page suivante">
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  )
}

/** En-tête de colonne triable */
export function SortHeader<T>({ column, children, align = "left" }: { column: Column<T, unknown>; children: React.ReactNode; align?: "left" | "right" }) {
  const dir = column.getIsSorted()
  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(dir === "asc")}
      className={cn("-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground", align === "right" && "ml-auto flex-row-reverse")}
    >
      {children}
      {dir === "asc" ? <ArrowUp className="size-3.5" /> : dir === "desc" ? <ArrowDown className="size-3.5" /> : <ChevronsUpDown className="size-3.5 opacity-50" />}
    </button>
  )
}

/** Vue mobile : chaque ligne devient une carte (1re colonne en titre, les autres en libellé / valeur). */
function MobileCards<T>({
  table,
  onActivate,
  rowClassName,
  empty,
}: {
  table: Table<T>
  onActivate?: (row: Row<T>) => void
  rowClassName?: (row: T) => string | undefined
  empty: React.ReactNode
}) {
  const headers = table.getHeaderGroups()[0]?.headers ?? []
  const rows = table.getRowModel().rows
  if (rows.length === 0) {
    return <div className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground md:hidden">{empty}</div>
  }
  return (
    <ul className="space-y-2.5 md:hidden">
      {rows.map((row) => {
        const cells = row.getVisibleCells()
        const select = cells.find((c) => c.column.id === "__select")
        const [title, ...rest] = cells.filter((c) => c.column.id !== "__select")
        return (
          <li
            key={row.id}
            data-state={row.getIsSelected() ? "selected" : undefined}
            onClick={onActivate ? () => onActivate(row) : undefined}
            className={cn(
              "rounded-xl border bg-card p-3.5 shadow-xs transition-colors data-[state=selected]:border-primary/40 data-[state=selected]:bg-primary/5",
              onActivate && "cursor-pointer active:bg-muted/60",
              rowClassName?.(row.original),
            )}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">{title && flexRender(title.column.columnDef.cell, title.getContext())}</div>
              {select && <div onClick={(e) => e.stopPropagation()}>{flexRender(select.column.columnDef.cell, select.getContext())}</div>}
            </div>
            {rest.length > 0 && (
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t pt-3">
                {rest.map((cell) => {
                  const header = headers.find((h) => h.column.id === cell.column.id)
                  const meta = cell.column.columnDef.meta as { label?: string } | undefined
                  const label = meta?.label ?? (header && !header.isPlaceholder ? flexRender(header.column.columnDef.header, header.getContext()) : null)
                  return (
                    <div key={cell.id} className={cn("min-w-0", !label && "col-span-2")}>
                      {label && (
                        <dt className="pointer-events-none mb-0.5 text-[0.7rem] font-medium text-muted-foreground [&_button]:m-0 [&_button]:p-0 [&_svg]:hidden">{label}</dt>
                      )}
                      <dd className="text-sm [&_*]:text-left" onClick={(e) => (e.target as HTMLElement).closest("button,a,input,[role=button]") && e.stopPropagation()}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            )}
          </li>
        )
      })}
    </ul>
  )
}
