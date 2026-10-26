"use client"

import * as React from "react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts"
import type { LotStatus, PaymentMethod } from "@/generated/prisma/enums"
import { formatCompact, formatMoney, formatNumber, formatPercent } from "@/lib/format"
import { LOT_STATUS, LOT_STATUS_ORDER, PAYMENT_METHOD } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"

// Couleurs : une teinte d'accent (primaire) pour la donnée, un gris pour le contexte.
const ACCENT = "var(--primary)"
const GHOST = "color-mix(in oklch, var(--muted-foreground) 22%, transparent)"
const GHOST_STRONG = "color-mix(in oklch, var(--muted-foreground) 55%, transparent)"
const axisTick = { fontSize: 11 }

type TooltipRow = { label: string; value: string; color?: string; line?: boolean }

/** Infobulle : la valeur d'abord, le libellé ensuite ; clé en trait de la couleur de la série. */
function TooltipCard({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="min-w-44 rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-medium text-muted-foreground capitalize">{title}</p>
      <div className="grid gap-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            {r.color && <span className={cn("shrink-0 rounded-full", r.line ? "h-0.5 w-3" : "h-2.5 w-1")} style={{ background: r.color }} />}
            <span className="font-semibold text-foreground tabular-nums">{r.value}</span>
            <span className="text-muted-foreground">{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Legend({ items }: { items: { label: string; color: string; line?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className={cn("rounded-[2px]", i.line ? "h-0.5 w-3.5" : "size-2.5")} style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Encaissements mensuels : réalisé (barres) vs attendu (ligne grise)
// ─────────────────────────────────────────────────────────────

export function CollectionsChart({ data, currency }: { data: { label: string; collected: number; expected: number }[]; currency: string }) {
  const config = { collected: { label: "Encaissé", color: ACCENT }, expected: { label: "Attendu", color: GHOST } } satisfies ChartConfig
  return (
    <div className="space-y-3">
      <Legend items={[{ label: "Encaissé", color: ACCENT }, { label: "Attendu selon les échéanciers", color: GHOST }]} />
      <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="24%">
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={axisTick} interval="preserveStartEnd" />
          <XAxis xAxisId="overlay" dataKey="label" hide />
          <YAxis tickLine={false} axisLine={false} width={44} tick={axisTick} tickFormatter={(v: number) => formatCompact(v)} />
          <ChartTooltip
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const collected = Number(payload.find((p) => p.dataKey === "collected")?.value ?? 0)
              const expected = Number(payload.find((p) => p.dataKey === "expected")?.value ?? 0)
              return (
                <TooltipCard
                  title={String(label)}
                  rows={[
                    { label: "encaissé", value: formatMoney(collected, currency), color: ACCENT },
                    { label: "attendu", value: formatMoney(expected, currency), color: GHOST_STRONG },
                    ...(expected > 0 ? [{ label: "de l'attendu", value: formatPercent(collected / expected) }] : []),
                  ]}
                />
              )
            }}
          />
          {/* L'attendu en barre « fantôme » large, l'encaissé en barre pleine superposée */}
          <Bar dataKey="expected" fill={GHOST} radius={[4, 4, 0, 0]} maxBarSize={30} />
          <Bar xAxisId="overlay" dataKey="collected" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={16} />
        </BarChart>
      </ChartContainer>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Prévision des encaissements (12 prochains mois)
// ─────────────────────────────────────────────────────────────

export function ForecastChart({ data, currency }: { data: { label: string; amount: number; count: number }[]; currency: string }) {
  const config = { amount: { label: "À encaisser", color: ACCENT } } satisfies ChartConfig
  return (
    <ChartContainer config={config} className="aspect-auto h-[240px] w-full">
      <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={axisTick} interval="preserveStartEnd" />
        <YAxis tickLine={false} axisLine={false} width={44} tick={axisTick} tickFormatter={(v: number) => formatCompact(v)} />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.6 }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipCard
                title={String(label)}
                rows={[
                  { label: "à encaisser", value: formatMoney(Number(payload[0].value), currency), color: ACCENT },
                  { label: `échéance${Number(payload[0].payload.count) > 1 ? "s" : ""}`, value: formatNumber(Number(payload[0].payload.count)) },
                ]}
              />
            ) : null
          }
        />
        <Bar dataKey="amount" fill={ACCENT} fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ChartContainer>
  )
}

// ─────────────────────────────────────────────────────────────
// Ventes cumulées (nombre de terrains attribués)
// ─────────────────────────────────────────────────────────────

export function CumulativeChart({ data, currency }: { data: { label: string; lots: number; contracted: number }[]; currency: string }) {
  const config = { lots: { label: "Terrains attribués", color: ACCENT } } satisfies ChartConfig
  const last = data[data.length - 1]
  return (
    <ChartContainer config={config} className="aspect-auto h-[240px] w-full">
      <AreaChart data={data} margin={{ top: 12, right: 28, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="cumul-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity={0.16} />
            <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={axisTick} interval="preserveStartEnd" />
        <YAxis tickLine={false} axisLine={false} width={32} tick={axisTick} allowDecimals={false} />
        <ChartTooltip
          cursor={{ stroke: "var(--border)" }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipCard
                title={String(label)}
                rows={[
                  { label: "terrains attribués", value: formatNumber(Number(payload[0].value)), color: ACCENT, line: true },
                  { label: "contractualisés", value: formatMoney(Number(payload[0].payload.contracted), currency) },
                ]}
              />
            ) : null
          }
        />
        <Area
          dataKey="lots"
          type="monotone"
          stroke={ACCENT}
          strokeWidth={2}
          fill="url(#cumul-fill)"
          dot={false}
          activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
        >
          <LabelList
            dataKey="lots"
            content={(props) => {
              const { x, y, value, index } = props as { x?: number | string; y?: number | string; value?: number | string; index?: number }
              if (index !== data.length - 1 || !last) return null
              return (
                <text x={Number(x) + 6} y={Number(y) - 8} fontSize={12} fontWeight={600} fill="var(--foreground)" textAnchor="start">
                  {value}
                </text>
              )
            }}
          />
        </Area>
      </AreaChart>
    </ChartContainer>
  )
}

// ─────────────────────────────────────────────────────────────
// Balance âgée des retards (classes ordonnées : rampe de plus en plus soutenue)
// ─────────────────────────────────────────────────────────────

const AGING_RAMP = [40, 60, 80, 100].map((p) => `color-mix(in oklch, var(--status-sold) ${p}%, var(--card))`)

export function AgingChart({ data, currency }: { data: { label: string; amount: number; count: number }[]; currency: string }) {
  const config = { amount: { label: "Montant en retard" } } satisfies ChartConfig
  const total = data.reduce((s, d) => s + d.amount, 0)
  if (total === 0) {
    return <p className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">Aucun retard de paiement. 👏</p>
  }
  return (
    <ChartContainer config={config} className="aspect-auto h-[200px] w-full">
      <BarChart data={data} margin={{ top: 20, right: 4, left: 4, bottom: 0 }} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={axisTick} />
        <YAxis hide />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.6 }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipCard
                title={`Retard ${String(label)}`}
                rows={[
                  { label: "en retard", value: formatMoney(Number(payload[0].value), currency), color: "var(--status-sold)" },
                  { label: "échéance(s)", value: formatNumber(Number(payload[0].payload.count)) },
                ]}
              />
            ) : null
          }
        />
        <Bar
          dataKey="amount"
          radius={[4, 4, 0, 0]}
          maxBarSize={44}
          label={{ position: "top", fontSize: 11, fill: "var(--muted-foreground)", formatter: (v: unknown) => (Number(v) > 0 ? formatCompact(Number(v)) : "") }}
        >
          {data.map((d, i) => (
            <Cell key={d.label} fill={AGING_RAMP[i]} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

// ─────────────────────────────────────────────────────────────
// Modes de paiement (barres horizontales, une seule teinte)
// ─────────────────────────────────────────────────────────────

export function MethodsBars({ data, currency }: { data: { method: PaymentMethod; amount: number; count: number; share: number }[]; currency: string }) {
  if (data.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">Aucun versement enregistré.</p>
  const max = Math.max(...data.map((d) => d.amount))
  return (
    <ul className="space-y-3.5">
      {data.map((d) => (
        <li key={d.method} className="group" title={`${PAYMENT_METHOD[d.method]} : ${formatMoney(d.amount, currency)} (${d.count} versements)`}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">{PAYMENT_METHOD[d.method]}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              <span className="font-semibold text-foreground">{formatMoney(d.amount, currency)}</span> · {formatPercent(d.share)}
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-opacity group-hover:opacity-80" style={{ width: `${Math.max(2, (d.amount / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

// ─────────────────────────────────────────────────────────────
// Commercialisation : répartition des terrains par statut (barre empilée)
// ─────────────────────────────────────────────────────────────

export function LotStatusBreakdown({
  counts,
  area,
  total,
}: {
  counts: Record<LotStatus, number>
  area: Record<LotStatus, number>
  total: number
}) {
  const [hover, setHover] = React.useState<LotStatus | null>(null)
  return (
    <div className="space-y-4">
      <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label="Répartition des terrains par statut">
        {LOT_STATUS_ORDER.filter((s) => counts[s] > 0).map((status) => (
          <div
            key={status}
            onPointerEnter={() => setHover(status)}
            onPointerLeave={() => setHover(null)}
            className={cn("h-full transition-opacity first:rounded-l-full last:rounded-r-full", hover && hover !== status && "opacity-40")}
            style={{
              width: `${(counts[status] / total) * 100}%`,
              background:
                status === "UNAVAILABLE"
                  ? "repeating-linear-gradient(135deg, var(--status-unavailable) 0 4px, color-mix(in oklch, var(--status-unavailable) 55%, var(--card)) 4px 7px)"
                  : LOT_STATUS[status].color,
            }}
          />
        ))}
      </div>
      <ul className="divide-y text-sm">
        {LOT_STATUS_ORDER.map((status) => (
          <li
            key={status}
            onPointerEnter={() => setHover(status)}
            onPointerLeave={() => setHover(null)}
            className={cn("flex items-center gap-3 py-2 transition-opacity", hover && hover !== status && "opacity-50")}
          >
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: LOT_STATUS[status].color }} />
            <span className="min-w-0 flex-1 truncate">{status === "UNAVAILABLE" ? "Hors vente" : LOT_STATUS[status].label}</span>
            <span className="hidden w-20 text-right text-xs whitespace-nowrap text-muted-foreground tabular-nums sm:inline">{formatNumber(area[status])} m²</span>
            <span className="w-8 text-right font-semibold tabular-nums">{counts[status]}</span>
            <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">{formatPercent(total ? counts[status] / total : 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
