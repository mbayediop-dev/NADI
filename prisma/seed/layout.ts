// Plan de masse de démonstration : site d'environ 4 ha (260 m × 154 m), 74 lots.
// Coordonnées en mètres, converties en pixels du plan (6 px / m).

export const PLAN = { width: 1600, height: 1100, scale: 6, offsetX: 20, offsetY: 40 }
export const SITE = { width: 260, height: 154 }

export const px = (x: number) => PLAN.offsetX + x * PLAN.scale
export const py = (y: number) => PLAN.offsetY + y * PLAN.scale

type Row = { y0: number; y1: number; facing: string; frontage: "avenue" | "road" | "highway" }

export const ROADS = {
  horizontal: [
    { name: "RUE 1", y0: 0, y1: 10 },
    { name: "AVENUE NADI", y0: 50, y1: 64, main: true },
    { name: "RUE 2", y0: 104, y1: 114 },
  ],
  vertical: [
    { name: "RUE 3", x0: 80, x1: 90 },
    { name: "RUE 4", x0: 170, x1: 180 },
  ],
  highway: { name: "ROUTE NATIONALE", y0: 154, y1: 170 },
}

const ROWS: Record<string, Row> = {
  An: { y0: 10, y1: 30, facing: "Rue 1", frontage: "road" },
  As: { y0: 30, y1: 50, facing: "Avenue NADI", frontage: "avenue" },
  Bn: { y0: 64, y1: 84, facing: "Avenue NADI", frontage: "avenue" },
  Bs: { y0: 84, y1: 104, facing: "Rue 2", frontage: "road" },
  Cn: { y0: 114, y1: 134, facing: "Rue 2", frontage: "road" },
  Cs: { y0: 134, y1: 154, facing: "la route nationale", frontage: "highway" },
}

type Segment = { block: string; row: keyof typeof ROWS; x0: number; widths: number[]; unavailable?: number[] }

// Îlots A à I, de gauche à droite et de haut en bas
const SEGMENTS: Segment[] = [
  { block: "A", row: "An", x0: 0, widths: [16, 16, 16, 16, 16] },
  { block: "B", row: "An", x0: 90, widths: [20, 20, 20, 20] },
  { block: "C", row: "An", x0: 180, widths: [18, 15, 15, 15, 17] },
  { block: "A", row: "As", x0: 0, widths: [16, 16, 16, 16, 16] },
  { block: "B", row: "As", x0: 90, widths: [20, 20, 20, 20] },
  { block: "C", row: "As", x0: 180, widths: [18, 15, 15, 15, 17] },
  { block: "D", row: "Bn", x0: 0, widths: [16, 16, 16, 16, 16] },
  { block: "F", row: "Bn", x0: 180, widths: [20, 20, 20, 20] },
  { block: "D", row: "Bs", x0: 0, widths: [16, 16, 16, 16, 16] },
  { block: "E", row: "Bs", x0: 130, widths: [20, 20] },
  { block: "F", row: "Bs", x0: 180, widths: [20, 20, 20, 20] },
  { block: "G", row: "Cn", x0: 0, widths: [16, 16, 16, 16, 16] },
  { block: "H", row: "Cn", x0: 90, widths: [16, 16, 16, 16, 16] },
  { block: "I", row: "Cn", x0: 180, widths: [20, 20, 20, 20] },
  { block: "G", row: "Cs", x0: 0, widths: [20, 20, 20, 20] },
  { block: "H", row: "Cs", x0: 90, widths: [20, 20, 20, 20] },
  { block: "I", row: "Cs", x0: 180, widths: [20, 20, 20, 20], unavailable: [0] },
]

const STREET_EDGES = new Set([80, 90, 170, 180])

export type LayoutLot = {
  number: string
  block: string
  x0: number
  y0: number
  x1: number
  y1: number
  areaM2: number
  frontageM: number
  depthM: number
  facing: string
  frontage: Row["frontage"]
  corner: boolean
  unavailable: boolean
  polygon: [number, number][]
}

export function buildLayout(): LayoutLot[] {
  const lots: LayoutLot[] = []
  const perBlock: Record<string, number> = {}
  for (const seg of SEGMENTS) {
    const row = ROWS[seg.row]
    let x = seg.x0
    seg.widths.forEach((w, i) => {
      const x0 = x
      const x1 = x + w
      x = x1
      const corner = STREET_EDGES.has(x0) || STREET_EDGES.has(x1)
      // léger retrait pour matérialiser les limites entre lots
      const inset = 0.35
      const poly: [number, number][] = [
        [px(x0 + inset) / PLAN.width, py(row.y0 + inset) / PLAN.height],
        [px(x1 - inset) / PLAN.width, py(row.y0 + inset) / PLAN.height],
        [px(x1 - inset) / PLAN.width, py(row.y1 - inset) / PLAN.height],
        [px(x0 + inset) / PLAN.width, py(row.y1 - inset) / PLAN.height],
      ]
      perBlock[seg.block] = (perBlock[seg.block] ?? 0) + 1
      lots.push({
        number: `${seg.block}-${String(perBlock[seg.block]).padStart(2, "0")}`,
        block: seg.block,
        x0,
        y0: row.y0,
        x1,
        y1: row.y1,
        areaM2: w * (row.y1 - row.y0),
        frontageM: w,
        depthM: row.y1 - row.y0,
        facing: row.facing,
        frontage: row.frontage,
        corner,
        unavailable: seg.unavailable?.includes(i) ?? false,
        polygon: poly.map(([a, b]) => [Number(a.toFixed(5)), Number(b.toFixed(5))]),
      })
    })
  }
  return lots
}

// ─────────────────────────────────────────────────────────────
// Rendu SVG du plan de masse (fond de carte)
// ─────────────────────────────────────────────────────────────

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

export function renderPlanSvg(): string {
  const { width: W, height: H } = PLAN
  const rand = rng(42)
  const parts: string[] = []
  const rect = (x0: number, y0: number, x1: number, y1: number, attrs: string) =>
    `<rect x="${px(x0)}" y="${py(y0)}" width="${(x1 - x0) * PLAN.scale}" height="${(y1 - y0) * PLAN.scale}" ${attrs}/>`

  const tree = (cx: number, cy: number, r: number) =>
    `<g><circle cx="${cx + r * 0.25}" cy="${cy + r * 0.3}" r="${r}" fill="#000" opacity=".08"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#treeGrad)"/></g>`

  // Fond : terrain naturel
  parts.push(`<rect width="${W}" height="${H}" fill="#ece5d3"/>`)
  parts.push(`<rect width="${W}" height="${H}" fill="url(#grain)" opacity=".55"/>`)

  // Végétation environnante
  for (let i = 0; i < 70; i++) {
    const side = i % 4
    let x = rand() * W
    let y = rand() * H
    if (side === 0) y = rand() * 34
    if (side === 1) y = py(SITE.height) + 100 + rand() * 30
    if (side === 2) x = rand() * 16
    if (side === 3) x = W - rand() * 16
    parts.push(tree(x, y, 7 + rand() * 9))
  }

  // Route nationale (hors site)
  const hw = ROADS.highway
  parts.push(`<rect x="0" y="${py(hw.y0)}" width="${W}" height="${(hw.y1 - hw.y0) * PLAN.scale}" fill="#9ea6a8"/>`)
  parts.push(`<rect x="0" y="${py(hw.y0) + 4}" width="${W}" height="2" fill="#f5f5f0" opacity=".8"/>`)
  parts.push(`<rect x="0" y="${py(hw.y1) - 6}" width="${W}" height="2" fill="#f5f5f0" opacity=".8"/>`)
  parts.push(
    `<line x1="0" y1="${py((hw.y0 + hw.y1) / 2)}" x2="${W}" y2="${py((hw.y0 + hw.y1) / 2)}" stroke="#fff" stroke-width="3" stroke-dasharray="26 22"/>`,
  )
  parts.push(
    `<text x="${W / 2}" y="${py((hw.y0 + hw.y1) / 2) + 26}" text-anchor="middle" class="road" fill="#eef0ee">${hw.name}</text>`,
  )

  // Emprise du site
  parts.push(rect(0, 0, SITE.width, SITE.height, `fill="#f7f1e3"`))

  // Voies internes
  for (const r of ROADS.horizontal) {
    parts.push(rect(0, r.y0, SITE.width, r.y1, `fill="#cfd3d1"`))
    if (r.main) {
      // terre-plein central arboré
      const mid = (r.y0 + r.y1) / 2
      parts.push(rect(0, mid - 1.1, SITE.width, mid + 1.1, `fill="#a9c98f"`))
      for (let x = 6; x < SITE.width; x += 12) parts.push(tree(px(x), py(mid), 6))
      parts.push(
        `<text x="${px(125)}" y="${py(r.y0) + 22}" text-anchor="middle" class="road">${r.name}</text>`,
      )
    } else {
      parts.push(
        `<line x1="${px(0)}" y1="${py((r.y0 + r.y1) / 2)}" x2="${px(SITE.width)}" y2="${py((r.y0 + r.y1) / 2)}" stroke="#fff" stroke-width="2" stroke-dasharray="16 16" opacity=".9"/>`,
      )
      parts.push(
        `<text x="${px(125)}" y="${py((r.y0 + r.y1) / 2) + 6}" text-anchor="middle" class="road" opacity=".75">${r.name}</text>`,
      )
    }
  }
  for (const r of ROADS.vertical) {
    parts.push(rect(r.x0, 0, r.x1, SITE.height, `fill="#cfd3d1"`))
    parts.push(rect(r.x0, ROADS.highway.y0, r.x1, ROADS.highway.y0 + 0.1, `fill="#cfd3d1"`))
    const cx = px((r.x0 + r.x1) / 2)
    parts.push(
      `<line x1="${cx}" y1="${py(0)}" x2="${cx}" y2="${py(SITE.height)}" stroke="#fff" stroke-width="2" stroke-dasharray="16 16" opacity=".9"/>`,
    )
    parts.push(
      `<text x="${cx}" y="${py(132)}" text-anchor="middle" class="road" opacity=".75" transform="rotate(-90 ${cx} ${py(132)})">${r.name}</text>`,
    )
    // Entrées depuis la route nationale
    parts.push(
      `<g transform="translate(${cx} ${py(SITE.height) + 50})"><circle r="17" fill="#173d34"/><path d="M-6 4 L0 -6 L6 4" fill="none" stroke="#e8c27a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>`,
    )
    parts.push(
      `<text x="${cx}" y="${py(SITE.height) + 84}" text-anchor="middle" class="label" fill="#173d34">ENTRÉE</text>`,
    )
  }

  // Espace vert (îlot E)
  parts.push(rect(90.6, 64.6, 129.4, 103.4, `rx="10" fill="#b9d49d"`))
  parts.push(
    `<path d="M ${px(92)} ${py(100)} C ${px(102)} ${py(84)}, ${px(116)} ${py(92)}, ${px(128)} ${py(68)}" fill="none" stroke="#f3ecd9" stroke-width="10" stroke-linecap="round"/>`,
  )
  for (let i = 0; i < 16; i++) {
    parts.push(tree(px(93 + rand() * 34), py(67 + rand() * 34), 8 + rand() * 7))
  }
  parts.push(
    `<rect x="${px(98)}" y="${py(81.5)}" width="${24 * PLAN.scale}" height="28" rx="14" fill="#fff" opacity=".85"/>`,
  )
  parts.push(`<text x="${px(110)}" y="${py(81.5) + 19}" text-anchor="middle" class="label">ESPACE VERT</text>`)

  // Mosquée (îlot E)
  parts.push(rect(130.6, 64.6, 169.4, 83.4, `rx="6" fill="#e9dcc0"`))
  parts.push(rect(138, 67, 162, 81, `rx="3" fill="#fdfaf2" stroke="#c9b48a" stroke-width="2"`))
  parts.push(`<circle cx="${px(150)}" cy="${py(74)}" r="26" fill="#e8c27a" stroke="#c9a15b" stroke-width="2"/>`)
  parts.push(`<rect x="${px(160)}" y="${py(66)}" width="10" height="34" rx="3" fill="#c9a15b"/>`)
  parts.push(`<text x="${px(150)}" y="${py(83.4) - 6}" text-anchor="middle" class="label">MOSQUÉE</text>`)

  // Limite du site
  parts.push(
    `<rect x="${px(0)}" y="${py(0)}" width="${SITE.width * PLAN.scale}" height="${SITE.height * PLAN.scale}" fill="none" stroke="#173d34" stroke-width="3" stroke-dasharray="14 8" opacity=".75"/>`,
  )

  // Nord
  parts.push(
    `<g transform="translate(${W - 70} ${H - 95})"><circle r="30" fill="#fff" opacity=".9"/><path d="M0 -22 L9 10 L0 4 L-9 10 Z" fill="#173d34"/><text y="24" text-anchor="middle" class="label" font-size="12">N</text></g>`,
  )
  // Échelle
  const sx = 40
  const sy = H - 40
  parts.push(
    `<g transform="translate(${sx} ${sy})"><rect x="-10" y="-30" width="${40 * PLAN.scale + 40}" height="44" rx="10" fill="#fff" opacity=".85"/><rect width="${20 * PLAN.scale}" height="6" fill="#173d34"/><rect x="${20 * PLAN.scale}" width="${20 * PLAN.scale}" height="6" fill="#fff" stroke="#173d34"/><text y="-10" class="label" font-size="12">0</text><text x="${20 * PLAN.scale}" y="-10" text-anchor="middle" class="label" font-size="12">20 m</text><text x="${40 * PLAN.scale}" y="-10" text-anchor="middle" class="label" font-size="12">40 m</text></g>`,
  )

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>
  <radialGradient id="treeGrad" cx="35%" cy="35%" r="70%"><stop offset="0" stop-color="#8fbf6a"/><stop offset="1" stop-color="#4f8a4a"/></radialGradient>
  <filter id="noise"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .45 0 0 0 0 .38 0 0 0 0 .25 0 0 0 .22 0"/></filter>
  <pattern id="grain" width="240" height="240" patternUnits="userSpaceOnUse"><rect width="240" height="240" filter="url(#noise)"/></pattern>
  <style>
    .road{font:700 15px 'Manrope',system-ui,sans-serif;letter-spacing:.32em;fill:#5f6a68}
    .label{font:800 13px 'Manrope',system-ui,sans-serif;letter-spacing:.18em;fill:#2d4a40}
  </style>
</defs>
${parts.join("\n")}
</svg>`
}
