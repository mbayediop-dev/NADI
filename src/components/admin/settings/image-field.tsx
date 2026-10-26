"use client"

import * as React from "react"
import { ImageUp, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { uploadFile } from "@/lib/upload-client"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

/** Sélection d'une image publique (logo, image d'accueil) avec aperçu. */
export function ImageField({
  value,
  onChange,
  folder,
  aspect = "aspect-video",
  hint,
}: {
  value: string | null
  onChange: (url: string | null) => void
  folder: string
  aspect?: string
  hint?: string
}) {
  const ref = React.useRef<HTMLInputElement>(null)
  const [progress, setProgress] = React.useState<number | null>(null)

  async function pick(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Choisissez une image (JPG, PNG, WebP, SVG)")
    try {
      setProgress(0)
      const uploaded = await uploadFile(file, { scope: "public", folder, onProgress: setProgress })
      onChange(uploaded.url)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Téléversement impossible")
    } finally {
      setProgress(null)
    }
  }

  return (
    <div className="space-y-2">
      <div className={cn("relative overflow-hidden rounded-xl border bg-muted/40", aspect)}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="size-full object-cover" />
        ) : (
          <button type="button" onClick={() => ref.current?.click()} className="grid size-full place-items-center text-sm text-muted-foreground hover:bg-muted">
            <span className="flex flex-col items-center gap-2">
              <ImageUp className="size-6" />
              Choisir une image
            </span>
          </button>
        )}
        {progress != null && (
          <div className="absolute inset-x-3 bottom-3">
            <Progress value={progress * 100} className="h-1.5" />
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={progress != null} onClick={() => ref.current?.click()}>
          <ImageUp /> {value ? "Remplacer" : "Téléverser"}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onChange(null)}>
            <Trash2 /> Retirer
          </Button>
        )}
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
    </div>
  )
}
