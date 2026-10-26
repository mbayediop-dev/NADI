// Montant en toutes lettres (français), pour les reçus.
const UNITS = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize"]
const TENS = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"]

function below100(n: number): string {
  if (n <= 16) return UNITS[n]
  if (n < 20) return `dix-${UNITS[n - 10]}`
  const t = Math.floor(n / 10)
  const u = n % 10
  if (t === 7 || t === 9) {
    const rest = n - t * 10 + 10
    return `${TENS[t]}${t === 7 && rest === 11 ? "-et-" : "-"}${below100(rest)}`
  }
  if (u === 0) return t === 8 ? "quatre-vingts" : TENS[t]
  if (u === 1 && t !== 8) return `${TENS[t]}-et-un`
  return `${TENS[t]}-${UNITS[u]}`
}

function below1000(n: number): string {
  const h = Math.floor(n / 100)
  const r = n % 100
  let out = ""
  if (h > 0) out = h === 1 ? "cent" : `${UNITS[h]}-cent${r === 0 ? "s" : ""}`
  if (r > 0) out = out ? `${out}-${below100(r)}` : below100(r)
  return out
}

export function numberToFrenchWords(value: number): string {
  let n = Math.floor(Math.abs(value))
  if (n === 0) return "zéro"
  const parts: string[] = []
  const scales: [number, string, string][] = [
    [1_000_000_000, "milliard", "milliards"],
    [1_000_000, "million", "millions"],
    [1000, "mille", "mille"],
  ]
  for (const [size, singular, plural] of scales) {
    const q = Math.floor(n / size)
    if (q > 0) {
      if (size === 1000) parts.push(q === 1 ? "mille" : `${below1000(q).replace(/(cent|vingt)s$/, "$1")}-mille`)
      else parts.push(`${below1000(q)}-${q > 1 ? plural : singular}`)
      n %= size
    }
  }
  if (n > 0) parts.push(below1000(n))
  return parts.join("-")
}
