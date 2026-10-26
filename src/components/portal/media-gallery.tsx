"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react"
import type { MediaType } from "@/generated/prisma/enums"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

export type GalleryMedia = { id: string; type: MediaType; url: string; caption: string | null }

/** Convertit un lien YouTube / Vimeo en URL intégrable. */
function embedInfo(url: string) {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)
  if (yt) return { src: `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&rel=0`, thumb: `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg` }
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vimeo) return { src: `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1`, thumb: null }
  return { src: url, thumb: null }
}

/** Galerie photos / vidéos d'une actualité, avec visionneuse plein écran. */
export function MediaGallery({ media }: { media: GalleryMedia[] }) {
  const [index, setIndex] = React.useState<number | null>(null)
  if (media.length === 0) return null
  const current = index == null ? null : media[index]
  const go = (delta: number) => setIndex((i) => (i == null ? i : (i + delta + media.length) % media.length))

  return (
    <>
      <div
        className={cn(
          "grid gap-2",
          media.length === 1 ? "grid-cols-1" : media.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3",
        )}
      >
        {media.slice(0, 6).map((item, i) => {
          const embed = item.type === "EMBED" ? embedInfo(item.url) : null
          const extra = i === 5 && media.length > 6 ? media.length - 6 : 0
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setIndex(i)}
              className={cn(
                "group relative overflow-hidden rounded-2xl bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                media.length === 1 ? "aspect-[16/9]" : "aspect-[4/3]",
                media.length === 3 && i === 0 && "col-span-2 sm:col-span-1",
              )}
              aria-label={item.caption ?? (item.type === "IMAGE" ? "Agrandir la photo" : "Lire la vidéo")}
            >
              {item.type === "IMAGE" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt={item.caption ?? ""} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
              ) : item.type === "VIDEO" ? (
                <video src={`${item.url}#t=0.5`} preload="metadata" muted playsInline className="size-full object-cover" />
              ) : embed?.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={embed.thumb} alt="" loading="lazy" className="size-full object-cover" />
              ) : (
                <span className="block size-full bg-gradient-to-br from-primary to-pine-deep" />
              )}
              {item.type !== "IMAGE" && (
                <span className="absolute inset-0 grid place-items-center bg-black/15">
                  <span className="grid size-12 place-items-center rounded-full bg-white/90 text-pine-deep shadow-lg transition-transform group-hover:scale-110">
                    <Play className="ml-0.5 size-5 fill-current" />
                  </span>
                </span>
              )}
              {extra > 0 && (
                <span className="absolute inset-0 grid place-items-center bg-black/55 text-2xl font-bold text-white">+{extra}</span>
              )}
            </button>
          )
        })}
      </div>

      <Dialog open={current != null} onOpenChange={(open) => !open && setIndex(null)}>
        <DialogContent
          showCloseButton={false}
          className="max-w-[min(100vw-1rem,1100px)] gap-0 overflow-hidden border-0 bg-black p-0 text-white ring-0 sm:max-w-[min(100vw-2rem,1100px)]"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") go(1)
            if (e.key === "ArrowLeft") go(-1)
          }}
        >
          <DialogTitle className="sr-only">{current?.caption ?? "Média du chantier"}</DialogTitle>
          {current && (
            <div className="relative">
              <div className="grid max-h-[80dvh] min-h-[40dvh] place-items-center">
                {current.type === "IMAGE" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={current.url} alt={current.caption ?? ""} className="max-h-[80dvh] w-auto object-contain" />
                ) : current.type === "VIDEO" ? (
                  <video key={current.id} src={current.url} controls autoPlay playsInline className="max-h-[80dvh] w-full" />
                ) : (
                  <iframe
                    key={current.id}
                    src={embedInfo(current.url).src}
                    title={current.caption ?? "Vidéo"}
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                    className="aspect-video w-full"
                  />
                )}
              </div>
              <div className="flex items-center gap-3 px-4 py-3 text-sm">
                <p className="min-w-0 flex-1 truncate text-white/80">{current.caption ?? ""}</p>
                {media.length > 1 && <span className="text-white/60 tabular">{(index ?? 0) + 1} / {media.length}</span>}
              </div>
              <button
                type="button"
                onClick={() => setIndex(null)}
                className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
                aria-label="Fermer"
              >
                <X className="size-5" />
              </button>
              {media.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => go(-1)}
                    className="absolute top-1/2 left-3 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/75"
                    aria-label="Précédent"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    className="absolute top-1/2 right-3 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/75"
                    aria-label="Suivant"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
