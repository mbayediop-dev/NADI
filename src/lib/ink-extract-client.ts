"use client"

import { extractInk, hasTransparency } from "@/lib/ink-extract"

const WORK_SIZE = 1600 // plus grand côté de l'image de travail (px)
const OUTPUT_WIDTH = 900 // largeur du fichier produit : net à l'impression, léger à charger

/**
 * Prépare la photo d'un cachet / d'une signature pour les reçus : fond de papier supprimé, cadrage sur le tracé.
 * Une image déjà détourée (PNG transparent) est renvoyée telle quelle.
 */
export async function cutOutInk(file: File): Promise<File> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  } catch {
    throw new Error("Image illisible : utilisez un fichier JPG ou PNG.")
  }
  const scale = Math.min(1, WORK_SIZE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) throw new Error("Traitement de l'image impossible sur cet appareil.")
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const source = context.getImageData(0, 0, canvas.width, canvas.height)
  if (hasTransparency(source)) return file
  const ink = extractInk(source)
  if (!ink) throw new Error("Aucun tracé détecté : photographiez le cachet sur une feuille blanche, bien éclairée.")

  const cut = document.createElement("canvas")
  cut.width = ink.width
  cut.height = ink.height
  const pixels = new ImageData(ink.width, ink.height)
  pixels.data.set(ink.data)
  cut.getContext("2d")?.putImageData(pixels, 0, 0)

  const ratio = Math.min(1, OUTPUT_WIDTH / ink.width)
  const output = document.createElement("canvas")
  output.width = Math.max(1, Math.round(ink.width * ratio))
  output.height = Math.max(1, Math.round(ink.height * ratio))
  const out = output.getContext("2d")
  if (!out) throw new Error("Traitement de l'image impossible sur cet appareil.")
  out.imageSmoothingQuality = "high"
  out.drawImage(cut, 0, 0, output.width, output.height)

  const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, "image/png"))
  if (!blob) throw new Error("Traitement de l'image impossible sur cet appareil.")
  return new File([blob], "cachet-signature.png", { type: "image/png" })
}
