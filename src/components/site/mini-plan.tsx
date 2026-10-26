import type { LotStatus } from "@/generated/prisma/enums"
import { bbox, centroid, toSvgPoints, type Point } from "@/lib/plan"
import type { PlanLot } from "@/components/plan/plan-viewer"

const FILL: Record<LotStatus, string> = {
  AVAILABLE: "var(--status-available)",
  RESERVED: "var(--status-reserved)",
  SOLD: "var(--status-sold)",
  UNAVAILABLE: "oklch(0.82 0.01 240)",
}

type MiniPlanProps = {
  imageUrl: string | null
  width: number
  height: number
  lots: PlanLot[]
  /** Terrain mis en valeur : la vue est recadrée autour de lui */
  focusId?: string | null
  /** Marge autour du terrain mis en valeur (en proportion du plan) */
  padding?: number
  labels?: boolean
  className?: string
  title?: string
}

/** Plan statique (sans interaction) : vignettes, encarts, cartes de terrains. */
export function MiniPlan({ imageUrl, width, height, lots, focusId, padding = 0.09, labels = false, className, title }: MiniPlanProps) {
  const focus = focusId ? lots.find((l) => l.id === focusId && l.polygon) : null
  let viewBox = `0 0 ${width} ${height}`
  if (focus?.polygon) {
    const b = bbox(focus.polygon)
    const cx = ((b.minX + b.maxX) / 2) * width
    const cy = ((b.minY + b.maxY) / 2) * height
    const w = Math.max((b.maxX - b.minX) * width, 1) + padding * 2 * width
    const h = w / (16 / 10)
    viewBox = `${(cx - w / 2).toFixed(1)} ${(cy - h / 2).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`
  }
  return (
    <svg viewBox={viewBox} preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label={title ?? "Plan du lotissement"}>
      <rect x={-width} y={-height} width={width * 3} height={height * 3} fill="oklch(0.93 0.025 95)" />
      {imageUrl && <image href={imageUrl} x={0} y={0} width={width} height={height} preserveAspectRatio="none" />}
      {lots.map((lot) => {
        if (!lot.polygon) return null
        const isFocus = lot.id === focus?.id
        const pts = lot.polygon as Point[]
        const [cx, cy] = centroid(pts)
        const b = bbox(pts)
        const size = Math.min((b.maxX - b.minX) * width, (b.maxY - b.minY) * height)
        return (
          <g key={lot.id}>
            <polygon
              points={toSvgPoints(pts, width, height)}
              fill={FILL[lot.status]}
              fillOpacity={focus && !isFocus ? 0.45 : 0.82}
              stroke={isFocus ? "var(--gold)" : "white"}
              strokeWidth={isFocus ? 6 : 1.6}
              strokeLinejoin="round"
            />
            {(labels || isFocus) && (
              <text
                x={cx * width}
                y={cy * height}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={Math.max(10, Math.min(28, size * 0.3))}
                fontWeight={700}
                fill={lot.status === "RESERVED" || lot.status === "UNAVAILABLE" ? "oklch(0.3 0.03 80)" : "white"}
              >
                {lot.number}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
