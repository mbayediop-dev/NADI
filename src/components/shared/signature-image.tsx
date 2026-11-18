"use client"

/**
 * Image du cachet sur un reçu. Si elle ne peut pas être chargée (stockage injoignable, fichier supprimé),
 * elle disparaît au lieu de laisser une icône d'image cassée sur un document remis au client.
 */
export function SignatureImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const hide = (img: HTMLImageElement) => {
    img.style.display = "none"
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- image privée servie avec contrôle d'accès (/api/signature)
    <img
      src={src}
      alt={alt}
      className={className}
      onError={(event) => hide(event.currentTarget)}
      // l'échec peut survenir avant que React n'attache onError (page rendue côté serveur)
      ref={(img) => {
        if (img && img.complete && img.naturalWidth === 0) hide(img)
      }}
    />
  )
}
