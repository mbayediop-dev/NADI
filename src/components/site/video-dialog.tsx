"use client"

import * as React from "react"
import { Play } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { embedUrl } from "@/components/site/media"

/** Bouton « lecture » posé sur une photo : ouvre la vidéo (YouTube, Vimeo ou fichier) en grand. */
export function VideoDialog({ url, label }: { url: string; label: string }) {
  const [open, setOpen] = React.useState(false)
  const isFile = url.startsWith("/") || /\.(mp4|webm|mov)(\?.*)?$/i.test(url)
  const src = isFile ? url : `${embedUrl(url)}${embedUrl(url).includes("?") ? "&" : "?"}autoplay=1`
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/20 text-white transition-colors hover:bg-black/30"
      >
        <span className="grid size-16 place-items-center rounded-full bg-white text-pine-deep shadow-xl transition-transform group-hover:scale-105">
          <Play className="ml-1 size-6 fill-current" />
        </span>
        <span className="text-sm font-semibold drop-shadow">{label}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-0 overflow-hidden border-0 bg-black p-0 ring-0 sm:max-w-4xl [&_[data-slot=dialog-close]]:bg-black/40 [&_[data-slot=dialog-close]]:text-white">
          <DialogTitle className="sr-only">{label}</DialogTitle>
          <DialogDescription className="sr-only">Vidéo de présentation du domaine</DialogDescription>
          <div className="aspect-video">
            {open &&
              (isFile ? (
                <video src={src} controls autoPlay playsInline className="size-full" />
              ) : (
                <iframe
                  src={src}
                  title={label}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="size-full border-0"
                />
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
