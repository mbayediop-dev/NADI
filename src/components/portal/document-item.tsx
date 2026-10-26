import { Download, Eye, FileImage, FileSpreadsheet, FileText, FileType2 } from "lucide-react"
import type { DocumentCategory } from "@/generated/prisma/enums"
import { DOCUMENT_CATEGORY } from "@/lib/labels"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`
}

function fileVisual(mime: string) {
  if (mime === "application/pdf") return { icon: FileText, tone: "bg-status-sold/10 text-status-sold-strong", ext: "PDF" }
  if (mime.startsWith("image/")) return { icon: FileImage, tone: "bg-primary/10 text-primary", ext: "IMG" }
  if (mime.includes("sheet") || mime.includes("excel")) return { icon: FileSpreadsheet, tone: "bg-status-available/12 text-status-available-strong", ext: "XLS" }
  if (mime.includes("word")) return { icon: FileType2, tone: "bg-chart-5/15 text-foreground", ext: "DOC" }
  return { icon: FileText, tone: "bg-muted text-muted-foreground", ext: "FICHIER" }
}

export function DocumentItem({
  doc,
  subtitle,
}: {
  doc: { id: string; title: string; description: string | null; category: DocumentCategory; mimeType: string; size: number; createdAt: Date }
  subtitle?: string
}) {
  const visual = fileVisual(doc.mimeType)
  const href = `/api/documents/${doc.id}`
  return (
    <li className="flex items-center gap-3 py-3.5 sm:gap-4">
      <span className={cn("relative grid size-11 shrink-0 place-items-center rounded-2xl", visual.tone)}>
        <visual.icon className="size-5" />
        <span className="absolute -bottom-1.5 rounded-md bg-card px-1 text-[0.55rem] font-bold tracking-wide ring-1 ring-border">{visual.ext}</span>
      </span>
      <div className="min-w-0 flex-1">
        <a href={href} target="_blank" rel="noreferrer" className="line-clamp-2 leading-snug font-semibold hover:text-primary">
          {doc.title}
        </a>
        <p className="truncate text-xs text-muted-foreground">
          {subtitle ?? DOCUMENT_CATEGORY[doc.category]} · {formatSize(doc.size)} · {formatDate(doc.createdAt)}
        </p>
        {doc.description && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{doc.description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="hidden h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
        >
          <Eye className="size-4" />
          Ouvrir
        </a>
        <a
          href={`${href}?download`}
          aria-label={`Télécharger ${doc.title}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary/10 px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/15"
        >
          <Download className="size-4" />
          <span className="hidden sm:inline">Télécharger</span>
        </a>
      </div>
    </li>
  )
}
