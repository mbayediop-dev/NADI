"use client"

import * as React from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { Download, Ellipsis, ExternalLink, FileImage, FileSpreadsheet, FileText, FileType2, Globe, Lock, Pencil, Trash2, Upload, Users } from "lucide-react"
import { toast } from "sonner"
import type { DocumentCategory, Visibility } from "@/generated/prisma/enums"
import { formatDate } from "@/lib/format"
import { DOCUMENT_CATEGORY, VISIBILITY } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { formatBytes, uploadFile } from "@/lib/upload-client"
import { useServerAction } from "@/hooks/use-server-action"
import { createDocument, deleteDocument, updateDocument } from "@/lib/actions/documents"
import { DataTable, SortHeader } from "@/components/shared/data-table"
import { FileDropzone } from "@/components/shared/file-dropzone"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { FormField } from "@/components/admin/settings/form-bits"

export type DocumentRow = {
  id: string
  title: string
  description: string | null
  category: DocumentCategory
  visibility: Visibility
  filename: string
  mimeType: string
  size: number
  createdAt: Date
  sale: { id: string; reference: string; buyerName: string } | null
}

const CATEGORIES = Object.keys(DOCUMENT_CATEGORY) as DocumentCategory[]
const VIS_ICON = { PUBLIC: Globe, CLIENTS: Users, PRIVATE: Lock }
const VIS_TONE = {
  PUBLIC: "bg-status-available/12 text-status-available-strong",
  CLIENTS: "bg-primary/10 text-primary",
  PRIVATE: "bg-muted text-muted-foreground",
}

function FileIcon({ mime }: { mime: string }) {
  const Icon = mime.startsWith("image/")
    ? FileImage
    : mime.includes("sheet") || mime.includes("excel")
      ? FileSpreadsheet
      : mime === "application/pdf"
        ? FileType2
        : FileText
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-lg",
        mime === "application/pdf" ? "bg-status-sold/10 text-status-sold-strong" : "bg-primary/10 text-primary",
      )}
    >
      <Icon className="size-4" />
    </span>
  )
}

function VisibilityPicker({ value, onChange }: { value: Visibility; onChange: (v: Visibility) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {(["PUBLIC", "CLIENTS", "PRIVATE"] as const).map((vis) => {
        const Icon = VIS_ICON[vis]
        return (
          <button
            key={vis}
            type="button"
            onClick={() => onChange(vis)}
            className={cn(
              "flex items-start gap-2 rounded-xl border p-3 text-left",
              value === vis ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50",
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              <span className="block text-sm font-semibold">{VISIBILITY[vis].label}</span>
              <span className="text-xs text-muted-foreground">{VISIBILITY[vis].hint}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function CategorySelect({ value, onChange, id }: { value: DocumentCategory; onChange: (v: DocumentCategory) => void; id?: string }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as DocumentCategory)}>
      <SelectTrigger id={id} className="h-9 w-full">
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
  )
}

function UploadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <UploadForm onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  )
}

function UploadForm({ onOpenChange }: { onOpenChange: (o: boolean) => void }) {
  const { run, pending } = useServerAction()
  const [file, setFile] = React.useState<File | null>(null)
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [category, setCategory] = React.useState<DocumentCategory>("ADMINISTRATIVE")
  const [visibility, setVisibility] = React.useState<Visibility>("CLIENTS")
  const [progress, setProgress] = React.useState<number | null>(null)

  async function submit() {
    if (!file) return
    try {
      setProgress(0)
      const uploaded = await uploadFile(file, { scope: "private", folder: "documents", onProgress: setProgress })
      await run(
        () =>
          createDocument({
            title: title || file.name.replace(/\.[^.]+$/, ""),
            description,
            category,
            visibility,
            file: { key: uploaded.key, filename: uploaded.filename, mimeType: uploaded.mimeType, size: uploaded.size },
          }),
        { onSuccess: () => onOpenChange(false) },
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Téléversement impossible")
    } finally {
      setProgress(null)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Ajouter un document</DialogTitle>
        <DialogDescription>Plans, autorisations, cahier des charges, études… Choisissez qui peut le consulter.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        {file ? (
          <div className="flex items-center gap-3 rounded-xl border p-3">
            <FileIcon mime={file.type} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setFile(null)} disabled={progress != null}>
              Changer
            </Button>
          </div>
        ) : (
          <FileDropzone
            accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
            onFiles={(files) => {
              setFile(files[0])
              if (!title) setTitle(files[0].name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "))
            }}
            hint="PDF, Word, Excel ou image"
          />
        )}
        {progress != null && <Progress value={progress * 100} className="h-1.5" />}
        <FormField label="Titre" htmlFor="doc-title" required>
          <Input
            id="doc-title"
            className="h-9"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex. Arrêté d'approbation du lotissement"
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Catégorie" htmlFor="doc-cat">
            <CategorySelect id="doc-cat" value={category} onChange={setCategory} />
          </FormField>
          <FormField label="Description (optionnelle)" htmlFor="doc-desc">
            <Input id="doc-desc" className="h-9" value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormField>
        </div>
        <FormField label="Qui peut le consulter ?" htmlFor="doc-vis">
          <VisibilityPicker value={visibility} onChange={setVisibility} />
        </FormField>
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Annuler
        </Button>
        <Button disabled={!file || pending || progress != null} onClick={submit}>
          {(pending || progress != null) && <Spinner />}
          Enregistrer
        </Button>
      </DialogFooter>
    </>
  )
}

function EditDialog({ doc, onOpenChange }: { doc: DocumentRow; onOpenChange: (o: boolean) => void }) {
  const { run, pending } = useServerAction()
  const [v, setV] = React.useState({ title: doc.title, description: doc.description ?? "", category: doc.category, visibility: doc.visibility })
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Modifier le document</DialogTitle>
          <DialogDescription className="truncate">{doc.filename}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <FormField label="Titre" htmlFor="edoc-title">
            <Input id="edoc-title" className="h-9" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Catégorie" htmlFor="edoc-cat">
              <CategorySelect id="edoc-cat" value={v.category} onChange={(category) => setV({ ...v, category })} />
            </FormField>
            <FormField label="Description" htmlFor="edoc-desc">
              <Input id="edoc-desc" className="h-9" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
            </FormField>
          </div>
          {doc.sale ? (
            <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
              Document lié à la vente <strong className="text-foreground">{doc.sale.reference}</strong> : visible uniquement par {doc.sale.buyerName} et
              l&apos;administration.
            </p>
          ) : (
            <FormField label="Qui peut le consulter ?" htmlFor="edoc-vis">
              <VisibilityPicker value={v.visibility} onChange={(visibility) => setV({ ...v, visibility })} />
            </FormField>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button disabled={pending} onClick={() => run(() => updateDocument(doc.id, v), { onSuccess: () => onOpenChange(false) })}>
            {pending && <Spinner />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DocumentsManager({ documents, canEdit }: { documents: DocumentRow[]; canEdit: boolean }) {
  const { run } = useServerAction()
  const [scope, setScope] = React.useState<"general" | "sales" | "all">("general")
  const [category, setCategory] = React.useState<DocumentCategory | "ALL">("ALL")
  const [uploadOpen, setUploadOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<DocumentRow | null>(null)

  const data = documents.filter((d) => (scope === "all" || (scope === "general" ? !d.sale : !!d.sale)) && (category === "ALL" || d.category === category))

  const columns = React.useMemo<ColumnDef<DocumentRow, unknown>[]>(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => <SortHeader column={column}>Document</SortHeader>,
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-3">
            <FileIcon mime={row.original.mimeType} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{row.original.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {row.original.filename} · {formatBytes(row.original.size)}
              </p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "category",
        header: "Catégorie",
        meta: { className: "hidden md:table-cell" },
        cell: ({ row }) => <span className="text-sm">{DOCUMENT_CATEGORY[row.original.category]}</span>,
      },
      {
        accessorKey: "visibility",
        header: "Visibilité",
        cell: ({ row }) => {
          if (row.original.sale)
            return (
              <Link href={`/admin/ventes/${row.original.sale.id}`} onClick={(e) => e.stopPropagation()} className="text-sm hover:text-primary">
                <span className="block font-medium">{row.original.sale.buyerName}</span>
                <span className="text-xs text-muted-foreground">{row.original.sale.reference}</span>
              </Link>
            )
          const Icon = VIS_ICON[row.original.visibility]
          return (
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", VIS_TONE[row.original.visibility])}>
              <Icon className="size-3" />
              {VISIBILITY[row.original.visibility].label}
            </span>
          )
        },
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => <SortHeader column={column}>Ajouté le</SortHeader>,
        meta: { className: "hidden sm:table-cell" },
        cell: ({ row }) => <span className="text-sm text-muted-foreground tabular">{formatDate(row.original.createdAt)}</span>,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Actions">
                  <Ellipsis />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <a href={`/api/documents/${row.original.id}`} target="_blank" rel="noreferrer">
                    <ExternalLink /> Ouvrir
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={`/api/documents/${row.original.id}?download=1`}>
                    <Download /> Télécharger
                  </a>
                </DropdownMenuItem>
                {canEdit && (
                  <>
                    <DropdownMenuItem onSelect={() => setEditing(row.original)}>
                      <Pencil /> Modifier
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => window.confirm(`Supprimer « ${row.original.title} » ?`) && run(() => deleteDocument(row.original.id))}
                    >
                      <Trash2 /> Supprimer
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [canEdit, run],
  )

  const counts = { general: documents.filter((d) => !d.sale).length, sales: documents.filter((d) => d.sale).length, all: documents.length }

  return (
    <div className="space-y-4">
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {(
          [
            { key: "general", label: "Documents du site" },
            { key: "sales", label: "Documents des ventes" },
            { key: "all", label: "Tous" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setScope(t.key)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium",
              scope === t.key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
            )}
          >
            {t.label}
            <span className="tabular opacity-70">{counts[t.key]}</span>
          </button>
        ))}
      </div>
      <DataTable
        columns={columns}
        data={data}
        getRowId={(d) => d.id}
        searchPlaceholder="Titre, fichier, acheteur…"
        searchText={(d) => [d.title, d.filename, d.description, d.sale?.buyerName, d.sale?.reference].filter(Boolean).join(" ")}
        onRowClick={(d) => window.open(`/api/documents/${d.id}`, "_blank")}
        initialSorting={[{ id: "createdAt", desc: true }]}
        empty="Aucun document. Ajoutez le plan de lotissement, les autorisations, le cahier des charges…"
        toolbar={
          <>
            <Select value={category} onValueChange={(v) => setCategory(v as DocumentCategory | "ALL")}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Toutes catégories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {DOCUMENT_CATEGORY[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canEdit && (
              <Button size="sm" className="h-9" onClick={() => setUploadOpen(true)}>
                <Upload /> Ajouter un document
              </Button>
            )}
          </>
        }
      />
      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
      {editing && <EditDialog doc={editing} onOpenChange={(o) => !o && setEditing(null)} />}
    </div>
  )
}
