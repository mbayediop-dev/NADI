// Détourage d'un cachet ou d'une signature photographié(e) sur papier clair : le papier devient transparent, l'encre est conservée.
// Module pur (ni DOM ni Node) : utilisé dans le navigateur (canvas) comme dans les scripts.

export type RgbaImage = { data: Uint8ClampedArray; width: number; height: number }

/** Écart relatif au papier en dessous duquel un pixel est considéré comme du papier (grain, ombres, traces légères). */
const PAPER_BELOW = 0.2
/** Écart relatif au papier au-dessus duquel un pixel est considéré comme de l'encre pleine. */
const INK_ABOVE = 0.45

/** Vrai si l'image contient déjà de la transparence (PNG déjà détouré) : inutile de la retraiter. */
export function hasTransparency({ data }: RgbaImage) {
  let transparent = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) transparent++
  return transparent > data.length / 4 / 50
}

/**
 * Isole l'encre : renvoie une image RGBA recadrée sur le tracé, fond transparent (null si aucune encre n'est trouvée).
 * L'éclairage d'une photo n'étant jamais uniforme, la teinte du papier est estimée localement (grille de cellules),
 * puis chaque pixel est comparé au papier qui l'entoure.
 */
export function extractInk(src: RgbaImage): RgbaImage | null {
  const { data, width: w, height: h } = src
  if (w < 8 || h < 8) return null

  // 1) Teinte locale du papier : dans chaque cellule, les pixels les plus clairs sont du papier
  const cell = Math.max(12, Math.round(Math.max(w, h) / 40))
  const gw = Math.ceil(w / cell)
  const gh = Math.ceil(h / cell)
  const level = new Float32Array(gw * gh)
  const paper = new Float32Array(gw * gh * 3)
  const histogram = new Uint32Array(256)
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      histogram.fill(0)
      let count = 0
      const x1 = Math.min(w, (gx + 1) * cell)
      const y1 = Math.min(h, (gy + 1) * cell)
      for (let y = gy * cell; y < y1; y++) {
        for (let x = gx * cell; x < x1; x++) {
          const i = (y * w + x) * 4
          histogram[Math.min(data[i], data[i + 1], data[i + 2])]++
          count++
        }
      }
      // 85e centile de la clarté : niveau du papier, même si l'encre couvre une bonne partie de la cellule
      let seen = 0
      let threshold = 255
      for (let v = 255; v >= 0; v--) {
        seen += histogram[v]
        if (seen >= count * 0.15) {
          threshold = v
          break
        }
      }
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let y = gy * cell; y < y1; y++) {
        for (let x = gx * cell; x < x1; x++) {
          const i = (y * w + x) * 4
          if (Math.min(data[i], data[i + 1], data[i + 2]) >= threshold) {
            r += data[i]
            g += data[i + 1]
            b += data[i + 2]
            n++
          }
        }
      }
      const k = gy * gw + gx
      level[k] = threshold
      paper[k * 3] = r / n
      paper[k * 3 + 1] = g / n
      paper[k * 3 + 2] = b / n
    }
  }

  // Une cellule entièrement encrée prend la teinte de sa voisine la plus claire, puis la grille est lissée
  const spread = (source: Float32Array, channels: number, pick: "brightest" | "mean") => {
    const out = new Float32Array(source.length)
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        let best = -1
        let bestLevel = -1
        let n = 0
        const sum = [0, 0, 0]
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const x = gx + dx
            const y = gy + dy
            if (x < 0 || y < 0 || x >= gw || y >= gh) continue
            const k = y * gw + x
            if (level[k] > bestLevel) {
              bestLevel = level[k]
              best = k
            }
            for (let c = 0; c < channels; c++) sum[c] += source[k * channels + c]
            n++
          }
        }
        for (let c = 0; c < channels; c++) out[(gy * gw + gx) * channels + c] = pick === "brightest" ? source[best * channels + c] : sum[c] / n
      }
    }
    return out
  }
  const paperFilled = spread(paper, 3, "brightest")
  const levelFilled = spread(level, 1, "brightest")
  level.set(levelFilled)
  const paperSmooth = spread(paperFilled, 3, "mean")
  const levelSmooth = spread(levelFilled, 1, "mean")

  // 2) Chaque pixel est comparé au papier environnant (interpolation bilinéaire de la grille)
  const out = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    const fy = Math.min(gh - 1, Math.max(0, (y + 0.5) / cell - 0.5))
    const y0 = Math.floor(fy)
    const yb = Math.min(gh - 1, y0 + 1)
    const ty = fy - y0
    for (let x = 0; x < w; x++) {
      const fx = Math.min(gw - 1, Math.max(0, (x + 0.5) / cell - 0.5))
      const x0 = Math.floor(fx)
      const xb = Math.min(gw - 1, x0 + 1)
      const tx = fx - x0
      const k00 = y0 * gw + x0
      const k01 = y0 * gw + xb
      const k10 = yb * gw + x0
      const k11 = yb * gw + xb
      const mix = (a: number, b: number, c: number, d: number) => (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty
      const bg = mix(levelSmooth[k00], levelSmooth[k01], levelSmooth[k10], levelSmooth[k11])

      const i = (y * w + x) * 4
      const darkness = bg > 0 ? (bg - Math.min(data[i], data[i + 1], data[i + 2])) / bg : 0
      const alpha = Math.min(1, Math.max(0, (darkness - PAPER_BELOW) / (INK_ABOVE - PAPER_BELOW)))
      if (alpha <= 0) continue

      // Couleur de l'encre seule : on retire la part de papier mélangée au pixel (bords des traits)
      const share = Math.max(alpha, 0.35)
      for (let c = 0; c < 3; c++) {
        const p = mix(paperSmooth[k00 * 3 + c], paperSmooth[k01 * 3 + c], paperSmooth[k10 * 3 + c], paperSmooth[k11 * 3 + c])
        out[i + c] = (data[i + c] - (1 - share) * p) / share
      }
      out[i + 3] = alpha * 255
    }
  }

  // 3) Poussières et taches isolées : on ne garde que les traits francs proches du tracé principal
  const box = removeSpecks(out, w, h)
  if (!box) return null
  const { minX, minY, maxX, maxY } = box

  // 4) Recadrage sur le tracé, avec une petite marge
  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.02) + 2
  const cx0 = Math.max(0, minX - pad)
  const cy0 = Math.max(0, minY - pad)
  const cw = Math.min(w, maxX + pad + 1) - cx0
  const ch = Math.min(h, maxY + pad + 1) - cy0
  const cropped = new Uint8ClampedArray(cw * ch * 4)
  for (let y = 0; y < ch; y++) {
    const start = ((cy0 + y) * w + cx0) * 4
    cropped.set(out.subarray(start, start + cw * 4), y * cw * 4)
  }
  return { data: cropped, width: cw, height: ch }
}

const CORE = 128 // opacité à partir de laquelle un pixel compte comme un trait franc

/**
 * Efface les éléments isolés (poussières, fibres du papier, bavures claires) et renvoie le cadre du tracé conservé.
 * Un petit élément est gardé s'il touche presque un élément déjà gardé : les lettres d'un cachet, les points et les
 * accents restent donc, de proche en proche, alors qu'une tache perdue dans la marge disparaît.
 */
function removeSpecks(rgba: Uint8ClampedArray, w: number, h: number) {
  const n = w * h
  const labels = new Int32Array(n) // 0 = fond, sinon numéro de l'élément
  const stack = new Int32Array(n)
  const areas: number[] = [0]
  const boxes: number[][] = [[]]
  for (let start = 0; start < n; start++) {
    if (labels[start] !== 0 || rgba[start * 4 + 3] < CORE) continue
    const id = areas.length
    let top = 0
    let area = 0
    const b = [w, h, -1, -1]
    stack[top++] = start
    labels[start] = id
    while (top > 0) {
      const p = stack[--top]
      const x = p % w
      const y = (p - x) / w
      area++
      if (x < b[0]) b[0] = x
      if (y < b[1]) b[1] = y
      if (x > b[2]) b[2] = x
      if (y > b[3]) b[3] = y
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= h) continue
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= w) continue
          const q = yy * w + xx
          if (labels[q] === 0 && rgba[q * 4 + 3] >= CORE) {
            labels[q] = id
            stack[top++] = q
          }
        }
      }
    }
    areas.push(area)
    boxes.push(b)
  }
  if (areas.length === 1) return null

  const reach = Math.max(4, Math.round(Math.max(w, h) * 0.012))
  const largest = Math.max(...areas)
  const kept = new Uint8Array(areas.length)
  for (let id = 1; id < areas.length; id++) if (areas[id] >= Math.min(reach * reach, largest)) kept[id] = 1
  for (let changed = true; changed; ) {
    changed = false
    for (let id = 1; id < areas.length; id++) {
      if (kept[id]) continue
      const [x0, y0, x1, y1] = boxes[id]
      search: for (let y = Math.max(0, y0 - reach); y <= Math.min(h - 1, y1 + reach); y++) {
        for (let x = Math.max(0, x0 - reach); x <= Math.min(w - 1, x1 + reach); x++) {
          if (kept[labels[y * w + x]]) {
            kept[id] = 1
            changed = true
            break search
          }
        }
      }
    }
  }

  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1
  for (let p = 0; p < n; p++) {
    const alpha = rgba[p * 4 + 3]
    if (alpha === 0) continue
    const x = p % w
    const y = (p - x) / w
    if (alpha >= CORE) {
      if (!kept[labels[p]]) {
        rgba[p * 4 + 3] = 0
        continue
      }
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      continue
    }
    // pixel de bord (semi-transparent) : conservé seulement s'il borde un trait gardé
    let bordersInk = false
    for (let dy = -2; dy <= 2 && !bordersInk; dy++) {
      const yy = y + dy
      if (yy < 0 || yy >= h) continue
      for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx
        if (xx >= 0 && xx < w && kept[labels[yy * w + xx]]) {
          bordersInk = true
          break
        }
      }
    }
    if (!bordersInk) rgba[p * 4 + 3] = 0
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY }
}
