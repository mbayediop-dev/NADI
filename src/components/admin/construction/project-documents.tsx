"use client"

import * as React from "react"
import { toast } from "sonner"
import { Download, FileText, Loader2, Lock, Trash2, UserRound, Users } from "lucide-react"
import type { DocumentCategory, Visibility } from "@/generated/prisma/enums"
import { createDocument, deleteDocument, updateDocument } from "@/lib/actions/documents"
import { useServerAction } from "@/hooks/use-server-action"
import { formatDate } from "@/lib/format"
import { DOCUMENT_CATEGORY } from "@/lib/labels"
import { formatBytes, uploadFile } from "@/lib/upload-client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileDropzone } from "@/components/shared/file-dropzone"

export type ProjectDocumentRow = {
  id: string
  title: string
  category: DocumentCategory
  visibility: Visibility
  fromClient: boolean
  size: number
  createdAt: string
}

const CATEGORIES: DocumentCategory[] = ["PLAN", "PERMIT", "CONTRACT", "QUOTE", "INVOICE", "TECHNICAL", "ADMINISTRATIVE", "OTHER"]

/**
 * Documents d'un projet de construction : plans, permis de construire, contrat, factures…
 * Chaque document est soit partagé avec le client (dans son espace), soit interne à l'entreprise.
 * Les documents déposés par le client lui-même sont signalés.
 */
export function ProjectDocuments({ projectId, documents, canEdit }: { projectId: string; documents: ProjectDocumentRow[]; canEdit: boolean }) {
  const { run, pending } = useServerAction()
  const [file, setFile] = React.useState<File | null>(null)
  const [title, setTitle] = React.useState("")
  const [category, setCategory] = React.useState<DocumentCategory>("PLAN")
  const [visibility, setVisibility] = React.useState<"CLIENTS" | "PRIVATE">("CLIENTS")
  const [progress, setProgress] = React.useState<number | null>(null)

  async function upload() {
    if (!file) return
    try {
      setProgress(0)
      const stored = await uploadFile(file, { scope: "private", folder: "construction-docs", onProgress: setProgress })
      await run(
        () =>
          createDocument({
            title: title.trim() || file.name.replace(/\.[^.]+$/, ""),
            category,
            visibility,
            constructionProjectId: projectId,
            file: { key: stored.key, filename: stored.filename, mimeType: stored.mimeType, size: stored.size },
          }),
        {
          onSuccess: () => {
            setFile(null)
            setTitle("")
          },
        },
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Échec du téléversement")
    } finally {
      setProgress(null)
    }
  }

  const shared = documents.filter((d) => d.visibility !== "PRIVATE")
  const internal = documents.filter((d) => d.visibility === "PRIVATE")

  const list = (docs: ProjectDocumentRow[]) => (
    <ul className="divide-y rounded-xl border">
      {docs.map((doc) => (
        <li key={doc.id} className="flex items-center gap-3 px-3 py-2.5">
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", doc.fromClient ? "bg-gold/20 text-gold-strong" : "bg-muted text-muted-foreground")}>
            {doc.fromClient ? <UserRound className="size-4" /> : <FileText className="size-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{doc.title}</p>
            <p className="text-xs text-muted-foreground">
              {doc.fromClient ? "Déposé par le client" : DOCUMENT_CATEGORY[doc.category]} · {formatBytes(doc.size)} · {formatDate(doc.createdAt)}
            </p>
          </div>
          {canEdit && !doc.fromClient && (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              title={doc.visibility === "PRIVATE" ? "Partager avec le client" : "Rendre interne"}
              onClick={() => run(() => updateDocument(doc.id, { visibility: doc.visibility === "PRIVATE" ? "CLIENTS" : "PRIVATE" }))}
            >
              {doc.visibility === "PRIVATE" ? <Users /> : <Lock />}
              <span className="hidden sm:inline">{doc.visibility === "PRIVATE" ? "Partager" : "Rendre interne"}</span>
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" asChild aria-label="Ouvrir">
            <a href={`/api/documents/${doc.id}`} target="_blank" rel="noreferrer">
              <Download />
            </a>
          </Button>
          {canEdit && (
            <Button variant="ghost" size="icon-sm" aria-label="Supprimer" disabled={pending} onClick={() => confirm(`Supprimer « ${doc.title} » ?`) && run(() => deleteDocument(doc.id))}>
              <Trash2 />
            </Button>
          )}
        </li>
      ))}
    </ul>
  )

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Users className="size-4 text-status-available-strong" />
          Partagés avec le client
          <span className="font-normal text-muted-foreground">({shared.length})</span>
        </h3>
        {shared.length ? list(shared) : <p className="text-sm text-muted-foreground">Aucun document partagé. Le client y retrouvera ses plans, son permis de construire, son contrat…</p>}
      </section>

      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Lock className="size-4 text-muted-foreground" />
          Internes à l&apos;entreprise
          <span className="font-normal text-muted-foreground">({internal.length})</span>
        </h3>
        {internal.length ? list(internal) : <p className="text-sm text-muted-foreground">Aucun document interne (études de prix, contrats de sous-traitance, factures fournisseurs…).</p>}
      </section>

      {canEdit &&
        (file ? (
          <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
            <p className="truncate text-sm font-medium">
              {file.name} <span className="font-normal text-muted-foreground">({formatBytes(file.size)})</span>
            </p>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre (ex. : Permis de construire)" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select value={category} onValueChange={(v) => setCategory(v as DocumentCategory)}>
                <SelectTrigger className="w-full" aria-label="Catégorie">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {DOCUMENT_CATEGORY[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as "CLIENTS" | "PRIVATE")}>
                <SelectTrigger className="w-full" aria-label="Visibilité">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLIENTS">Partagé avec le client</SelectItem>
                  <SelectItem value="PRIVATE">Interne à l&apos;entreprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {progress != null && <Progress value={progress * 100} className="h-1.5" />}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setFile(null)} disabled={progress != null}>
                Annuler
              </Button>
              <Button size="sm" onClick={upload} disabled={progress != null || pending}>
                {(progress != null || pending) && <Loader2 className="animate-spin" />}
                Ajouter
              </Button>
            </div>
          </div>
        ) : (
          <FileDropzone
            onFiles={(files) => setFile(files[0])}
            accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"
            hint="Plan, permis de construire, contrat, facture… Vous choisirez ensuite s'il est partagé avec le client."
            className="py-5"
          />
        ))}
    </div>
  )
}
