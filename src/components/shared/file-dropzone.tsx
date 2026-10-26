"use client"

import * as React from "react"
import { CloudUpload } from "lucide-react"
import { cn } from "@/lib/utils"

/** Zone de dépôt de fichiers (glisser-déposer ou clic). */
export function FileDropzone({
  onFiles,
  accept,
  multiple = false,
  disabled,
  hint,
  className,
}: {
  onFiles: (files: File[]) => void
  accept?: string
  multiple?: boolean
  disabled?: boolean
  hint?: string
  className?: string
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [over, setOver] = React.useState(false)
  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        if (disabled) return
        const files = Array.from(e.dataTransfer.files)
        if (files.length) onFiles(multiple ? files : files.slice(0, 1))
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
        over ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
        <CloudUpload className="size-5" />
      </span>
      <p className="text-sm font-medium">
        Glissez-déposez {multiple ? "vos fichiers" : "un fichier"} ici, ou <span className="text-primary underline underline-offset-4">parcourez</span>
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) onFiles(files)
          e.target.value = ""
        }}
      />
    </div>
  )
}
