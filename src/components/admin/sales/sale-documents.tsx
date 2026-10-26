"use client"

import * as React from "react"
import { toast } from "sonner"
import { Download, FileText, Loader2, Trash2 } from "lucide-react"
import type { DocumentCategory } from "@/generated/prisma/enums"
import { createDocument, deleteDocument } from "@/lib/actions/documents"
import { updateSaleNotes } from "@/app/admin/(app)/ventes/actions"
import { useServerAction } from "@/hooks/use-server-action"
import { DOCUMENT_CATEGORY } from "@/lib/labels"
import { formatDate } from "@/lib/format"
import { formatBytes, uploadFile } from "@/lib/upload-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { FileDropzone } from "@/components/shared/file-dropzone"

export type SaleDocumentRow = { id: string; title: string; category: DocumentCategory; filename: string; size: number; createdAt: string }

const CATEGORIES: DocumentCategory[] = ["CONTRACT", "RECEIPT", "ADMINISTRATIVE", "PLAN", "TECHNICAL", "OTHER"]

/** Documents propres à une vente (contrat, attestation…) visibles par l'acheteur dans son espace. */
export function SaleDocuments({ saleId, documents, canEdit }: { saleId: string; documents: SaleDocumentRow[]; canEdit: boolean }) {
  const { run, pending } = useServerAction()
  const [file, setFile] = React.useState<File | null>(null)
  const [title, setTitle] = React.useState("")
  const [category, setCategory] = React.useState<DocumentCategory>("CONTRACT")
  const [progress, setProgress] = React.useState<number | null>(null)

  async function upload() {
    if (!file) return
    try {
      setProgress(0)
      const stored = await uploadFile(file, { scope: "private", folder: "contracts", onProgress: setProgress })
      await run(
        () =>
          createDocument({
            title: title.trim() || file.name.replace(/\.[^.]+$/, ""),
            category,
            visibility: "CLIENTS",
            saleId,
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

  return (
    <div className="space-y-4">
      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun document pour cette vente.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <FileText className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{doc.title}</p>
                <p className="text-xs text-muted-foreground">
                  {DOCUMENT_CATEGORY[doc.category]} · {formatBytes(doc.size)} · {formatDate(doc.createdAt)}
                </p>
              </div>
              <Button variant="ghost" size="icon-sm" asChild aria-label="Télécharger">
                <a href={`/api/documents/${doc.id}`} target="_blank" rel="noreferrer">
                  <Download />
                </a>
              </Button>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Supprimer"
                  disabled={pending}
                  onClick={() => confirm(`Supprimer « ${doc.title} » ?`) && run(() => deleteDocument(doc.id))}
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit &&
        (file ? (
          <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
            <p className="truncate text-sm font-medium">
              {file.name} <span className="font-normal text-muted-foreground">({formatBytes(file.size)})</span>
            </p>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre (ex. : Contrat de réservation signé)" />
            <Select value={category} onValueChange={(v) => setCategory(v as DocumentCategory)}>
              <SelectTrigger className="w-full">
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
          <FileDropzone onFiles={(files) => setFile(files[0])} accept=".pdf,image/*,.doc,.docx" hint="PDF, image ou Word — visible par l'acheteur dans son espace client" className="py-5" />
        ))}
    </div>
  )
}

/** Notes internes de la vente */
export function SaleNotes({ saleId, notes, canEdit }: { saleId: string; notes: string | null; canEdit: boolean }) {
  const { run, pending } = useServerAction()
  const [value, setValue] = React.useState(notes ?? "")
  const dirty = value !== (notes ?? "")
  if (!canEdit) return <p className="text-sm whitespace-pre-wrap text-muted-foreground">{notes || "Aucune note."}</p>
  return (
    <div className="space-y-2">
      <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={4} placeholder="Accords particuliers, historique des échanges…" />
      {dirty && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => run(() => updateSaleNotes(saleId, value))} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Enregistrer
          </Button>
        </div>
      )}
    </div>
  )
}
