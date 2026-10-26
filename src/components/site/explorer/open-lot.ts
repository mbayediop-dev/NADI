// Ouvre la fiche d'un terrain dans l'explorateur depuis n'importe quelle section de la page.
export const OPEN_LOT_EVENT = "nadi:open-lot"

export function openLotInExplorer(number: string) {
  window.dispatchEvent(new CustomEvent<string>(OPEN_LOT_EVENT, { detail: number }))
  document.getElementById("terrains")?.scrollIntoView({ behavior: "smooth", block: "start" })
}
