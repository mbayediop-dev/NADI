import { HardHat } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PublicMedia } from "@/lib/queries/public"

/** Convertit un lien YouTube / Vimeo en URL intégrable */
export function embedUrl(url: string) {
  try {
    const u = new URL(url)
    if (u.hostname.includes("youtu.be")) return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v") ?? u.pathname.split("/").filter(Boolean).pop()
      return `https://www.youtube-nocookie.com/embed/${id}`
    }
    if (u.hostname.includes("vimeo.com")) return `https://player.vimeo.com/video/${u.pathname.split("/").filter(Boolean).pop()}`
    return url
  } catch {
    return url
  }
}

export function MediaView({ media, className, controls = true }: { media: PublicMedia; className?: string; controls?: boolean }) {
  if (media.type === "IMAGE") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={media.url} alt={media.caption ?? ""} loading="lazy" className={cn("size-full object-cover", className)} />
  }
  if (media.type === "VIDEO") {
    return <video src={media.url} controls={controls} preload="metadata" playsInline className={cn("size-full bg-black object-cover", className)} />
  }
  return (
    <iframe
      src={embedUrl(media.url)}
      title={media.caption ?? "Vidéo"}
      loading="lazy"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      className={cn("size-full border-0", className)}
    />
  )
}

/** Visuel de remplacement quand une actualité n'a pas de média */
export function MediaFallback({ label, className }: { label?: string | null; className?: string }) {
  return (
    <div className={cn("relative size-full overflow-hidden bg-sand text-white", className)}>
      <div
        aria-hidden
        className="absolute inset-0 scale-110 opacity-90 transition-transform duration-700 group-hover:scale-125"
        style={{ backgroundImage: "url(/plan/site-plan.svg)", backgroundSize: "cover", backgroundPosition: "center" }}
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-pine-deep/90 via-pine-deep/35 to-pine-deep/10" />
      <div className="absolute bottom-4 left-4 flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-xl bg-gold text-gold-foreground shadow-lg">
          <HardHat className="size-4.5" />
        </span>
        {label && <span className="text-sm font-semibold text-white drop-shadow">{label}</span>}
      </div>
    </div>
  )
}
