// Géométrie du plan de lotissement. Les points sont normalisés (0..1) par rapport à l'image du plan.
import { z } from "zod"

export type Point = [number, number]

export const polygonSchema = z.array(z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)])).min(3)

export function parsePolygon(value: unknown): Point[] | null {
  const parsed = polygonSchema.safeParse(value)
  return parsed.success ? (parsed.data as Point[]) : null
}

/** Centre de gravité d'un polygone (repli sur la moyenne des sommets si dégénéré). */
export function centroid(points: Point[]): Point {
  let area = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[(i + 1) % points.length]
    const cross = x0 * y1 - x1 * y0
    area += cross
    cx += (x0 + x1) * cross
    cy += (y0 + y1) * cross
  }
  if (Math.abs(area) < 1e-12) {
    const sx = points.reduce((s, p) => s + p[0], 0) / points.length
    const sy = points.reduce((s, p) => s + p[1], 0) / points.length
    return [sx, sy]
  }
  area /= 2
  return [cx / (6 * area), cy / (6 * area)]
}

export function bbox(points: Point[]) {
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) }
}

export function toSvgPoints(points: Point[], width: number, height: number) {
  return points.map(([x, y]) => `${(x * width).toFixed(1)},${(y * height).toFixed(1)}`).join(" ")
}

export function rectPolygon(x0: number, y0: number, x1: number, y1: number): Point[] {
  const [ax, bx] = x0 < x1 ? [x0, x1] : [x1, x0]
  const [ay, by] = y0 < y1 ? [y0, y1] : [y1, y0]
  return [
    [ax, ay],
    [bx, ay],
    [bx, by],
    [ax, by],
  ]
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
export function clampPoint([x, y]: Point): Point {
  return [clamp01(x), clamp01(y)]
}
