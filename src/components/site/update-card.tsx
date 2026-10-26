"use client"

import * as React from "react"
import { ArrowUpRight, Images, Pin, PlayCircle } from "lucide-react"
import { formatDateLong } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { PublicUpdate } from "@/lib/queries/public"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MediaFallback, MediaView } from "@/components/site/media"

/** Carte d'actualité du chantier (s'ouvre en grand avec tous les médias). */
export function UpdateCard({ update, tone = "dark", featured = false }: { update: PublicUpdate; tone?: "dark" | "light"; featured?: boolean }) {
  const [open, setOpen] = React.useState(false)
  const cover = update.media[0]

  // Lien direct /avancement#<id> : ouvre l'actualité correspondante
  React.useEffect(() => {
    if (window.location.hash !== `#${update.id}`) return
    const timer = setTimeout(() => setOpen(true), 400)
    return () => clearTimeout(timer)
  }, [update.id])
  const dark = tone === "dark"
  return (
    <>
      <button
        id={update.id}
        type="button"
        onClick={() => setOpen(true)}
        className={
          dark
            ? "group flex h-full w-full flex-col overflow-hidden scroll-mt-28 rounded-lg border border-white/10 bg-white/[0.05] text-left transition-colors hover:bg-white/[0.09]"
            : "group flex h-full w-full flex-col overflow-hidden scroll-mt-28 rounded-lg border bg-card text-left shadow-xs transition-shadow hover:shadow-md"
        }
      >
        <div className={featured ? "relative aspect-[16/10] w-full overflow-hidden lg:aspect-auto lg:min-h-64 lg:flex-1" : "relative aspect-[16/10] w-full overflow-hidden"}>
          {cover ? (
            cover.type === "IMAGE" ? (
              <MediaView media={cover} className="transition-transform duration-500 group-hover:scale-[1.03]" />
            ) : (
              <>
                <MediaFallback />
                <span className="absolute inset-0 grid place-items-center">
                  <PlayCircle className="size-14 text-white drop-shadow-lg" />
                </span>
              </>
            )
          ) : (
            <MediaFallback label={update.milestone} />
          )}
          <div className="absolute top-3 left-3 flex gap-2">
            {update.pinned && (
              <span className="inline-flex items-center gap-1 rounded-md bg-gold px-2.5 py-1 text-xs font-bold text-gold-foreground">
                <Pin className="size-3" />À la une
              </span>
            )}
            {update.media.length > 1 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
                <Images className="size-3" />
                {update.media.length}
              </span>
            )}
          </div>
        </div>
        <div className={featured ? "flex flex-col p-5 sm:p-6" : "flex flex-1 flex-col p-5"}>
          <p className={dark ? "text-xs font-semibold text-gold" : "text-xs font-semibold text-gold-strong"}>
            {formatDateLong(update.publishedAt)}
            {update.milestone ? ` · ${update.milestone}` : ""}
          </p>
          <h3 className={cn("mt-2 leading-snug font-bold", featured ? "text-xl sm:text-2xl" : "text-lg", dark && "text-white")}>{update.title}</h3>
          <p className={dark ? "mt-2 line-clamp-3 text-sm leading-relaxed text-white/65" : "mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground"}>
            {update.body}
          </p>
          <span className={dark ? "mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-white" : "mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-primary"}>
            Lire la suite
            <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
          {update.media.length > 0 && (
            <div className="grid gap-1 bg-black">
              {update.media.map((m) => (
                <figure key={m.id} className="relative">
                  <div className={m.type === "IMAGE" ? "" : "aspect-video"}>
                    <MediaView media={m} className={m.type === "IMAGE" ? "h-auto max-h-[60vh] w-full object-contain" : ""} />
                  </div>
                  {m.caption && <figcaption className="bg-black px-4 py-2 text-xs text-white/70">{m.caption}</figcaption>}
                </figure>
              ))}
            </div>
          )}
          <div className="p-6">
            <DialogHeader className="text-left">
              <p className="text-xs font-semibold text-gold-strong">
                {formatDateLong(update.publishedAt)}
                {update.milestone ? ` · ${update.milestone}` : ""}
              </p>
              <DialogTitle className="font-display text-2xl leading-tight font-medium">{update.title}</DialogTitle>
              <DialogDescription className="sr-only">Actualité du chantier</DialogDescription>
            </DialogHeader>
            <p className="mt-4 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{update.body}</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
