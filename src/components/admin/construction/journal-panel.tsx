"use client"

import * as React from "react"
import { toast } from "sonner"
import { Camera, Eye, EyeOff, Loader2, MoreHorizontal, Pencil, Trash2, X } from "lucide-react"
import type { MediaType } from "@/generated/prisma/enums"
import { deleteConstructionMedia, deleteConstructionUpdate, saveConstructionUpdate } from "@/app/admin/(app)/construction/actions"
import { useServerAction } from "@/hooks/use-server-action"
import { formatDate } from "@/lib/format"
import { formatBytes, uploadFile } from "@/lib/upload-client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { FileDropzone } from "@/components/shared/file-dropzone"
import { Field } from "@/components/admin/sales/plan-fields"

export type JournalMedia = { id: string; type: MediaType; caption: string | null }
export type JournalEntry = {
  id: string
  title: string
  body: string
  phaseId: string | null
  phaseTitle: string | null
  visibleToClient: boolean
  publishedAt: string
  media: JournalMedia[]
}

const NONE = "none"
const mediaUrl = (id: string) => `/api/construction/media/${id}`

/** Journal de chantier : publications datées avec photos et vidéos, partagées (ou non) avec le client. */
export function JournalPanel({
  projectId,
  entries,
  phases,
  today,
  canEdit,
}: {
  projectId: string
  entries: JournalEntry[]
  phases: { id: string; title: string }[]
  today: string
  canEdit: boolean
}) {
  const { run, pending } = useServerAction()
  const [draft, setDraft] = React.useState<JournalEntry | "new" | null>(null)

  return (
    <>
      {canEdit && (
        <div className="px-5 pb-4">
          <Button onClick={() => setDraft("new")}>
            <Camera />
            Publier des nouvelles du chantier
          </Button>
        </div>
      )}
      {entries.length === 0 ? (
        <p className="border-t px-5 py-10 text-center text-sm text-muted-foreground">
          Aucune publication. Ajoutez des photos à chaque étape : le client suit son chantier depuis son espace.
        </p>
      ) : (
        <ul className="divide-y border-t">
          {entries.map((entry) => (
            <li key={entry.id} className="px-4 py-4 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{entry.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    {formatDate(entry.publishedAt)}
                    {entry.phaseTitle && <span>· {entry.phaseTitle}</span>}
                    <span className={cn("inline-flex items-center gap-1", entry.visibleToClient ? "text-status-available-strong" : "")}>
                      {entry.visibleToClient ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                      {entry.visibleToClient ? "Visible du client" : "Interne"}
                    </span>
                  </p>
                </div>
                {canEdit && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Actions sur « ${entry.title} »`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setDraft(entry)}>
                        <Pencil />
                        Modifier / ajouter des photos
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={pending}
                        onSelect={() => confirm(`Supprimer « ${entry.title} » et ses photos ?`) && run(() => deleteConstructionUpdate(entry.id))}
                      >
                        <Trash2 />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              {entry.body && <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">{entry.body}</p>}
              {entry.media.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                  {entry.media.map((m) => (
                    <a key={m.id} href={mediaUrl(m.id)} target="_blank" rel="noreferrer" className="group relative block aspect-[4/3] overflow-hidden rounded-lg bg-muted" title={m.caption ?? undefined}>
                      {m.type === "VIDEO" ? (
                        <video src={mediaUrl(m.id)} preload="metadata" muted playsInline className="size-full object-cover" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element -- fichier privé servi par une route protégée
                        <img src={mediaUrl(m.id)} alt={m.caption ?? ""} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      )}
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {draft && <JournalDialog projectId={projectId} entry={draft === "new" ? null : draft} phases={phases} today={today} onClose={() => setDraft(null)} />}
    </>
  )
}

function JournalDialog({
  projectId,
  entry,
  phases,
  today,
  onClose,
}: {
  projectId: string
  entry: JournalEntry | null
  phases: { id: string; title: string }[]
  today: string
  onClose: () => void
}) {
  const { run, pending } = useServerAction()
  const [title, setTitle] = React.useState(entry?.title ?? "")
  const [body, setBody] = React.useState(entry?.body ?? "")
  const [phaseId, setPhaseId] = React.useState<string | null>(entry?.phaseId ?? null)
  const [visible, setVisible] = React.useState(entry?.visibleToClient ?? true)
  const [publishedAt, setPublishedAt] = React.useState(entry?.publishedAt.slice(0, 10) ?? today)
  const [files, setFiles] = React.useState<File[]>([])
  const [existing, setExisting] = React.useState(entry?.media ?? [])
  const [progress, setProgress] = React.useState<{ done: number; ratio: number } | null>(null)
  const busy = pending || progress != null

  function addFiles(list: File[]) {
    const accepted = list.filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"))
    if (accepted.length < list.length) toast.error("Seules les photos et les vidéos sont acceptées")
    setFiles((current) => [...current, ...accepted].slice(0, 30))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const media: { key: string; mimeType: string; size: number }[] = []
    try {
      for (let i = 0; i < files.length; i++) {
        setProgress({ done: i, ratio: 0 })
        const stored = await uploadFile(files[i], { scope: "private", folder: "construction", onProgress: (ratio) => setProgress({ done: i, ratio }) })
        media.push({ key: stored.key, mimeType: stored.mimeType, size: stored.size })
      }
    } catch (error) {
      setProgress(null)
      return toast.error(error instanceof Error ? error.message : "Échec du téléversement")
    }
    setProgress(null)
    run(() => saveConstructionUpdate(projectId, { id: entry?.id, title, body, phaseId, visibleToClient: visible, publishedAt, media }), { onSuccess: onClose })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{entry ? "Modifier la publication" : "Nouvelles du chantier"}</DialogTitle>
            <DialogDescription>Un titre, quelques mots et des photos : c&apos;est ce que le client voit en premier dans son espace.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Titre" className="sm:col-span-2">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. : Les fondations sont coulées" required autoFocus={!entry} />
            </Field>
            <Field label="Date">
              <Input type="date" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} required />
            </Field>
            <Field label="Étape concernée">
              <Select value={phaseId ?? NONE} onValueChange={(v) => setPhaseId(v === NONE ? null : v)} disabled={phases.length === 0}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Aucune étape</SelectItem>
                  {phases.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Commentaire" className="sm:col-span-2">
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Ce qui a été réalisé, ce qui vient ensuite…" />
            </Field>
          </div>

          {existing.length > 0 && (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {existing.map((m) => (
                <ExistingMedia key={m.id} media={m} onRemoved={() => setExisting((list) => list.filter((x) => x.id !== m.id))} />
              ))}
            </div>
          )}

          <div className="space-y-2">
            <FileDropzone multiple accept="image/*,video/*" onFiles={addFiles} disabled={busy} hint="Photos et vidéos du chantier — plusieurs fichiers possibles" className="py-5" />
            {files.length > 0 && (
              <ul className="space-y-1 text-sm">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">
                      {f.name} <span className="text-muted-foreground">({formatBytes(f.size)})</span>
                    </span>
                    {progress && progress.done === i ? (
                      <Progress value={progress.ratio * 100} className="h-1.5 w-24" />
                    ) : progress && progress.done > i ? (
                      <span className="text-xs text-status-available-strong">Envoyé</span>
                    ) : (
                      <Button type="button" variant="ghost" size="icon-xs" aria-label={`Retirer ${f.name}`} disabled={busy} onClick={() => setFiles((list) => list.filter((_, j) => j !== i))}>
                        <X />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <label className="flex items-start gap-3 rounded-xl border p-3">
            <Switch checked={visible} onCheckedChange={setVisible} className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium">Visible par le client</span>
              <span className="block text-xs text-muted-foreground">Désactivez pour garder cette publication en interne (constat, réserve, point à régler…).</span>
            </span>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Annuler
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {progress ? `Envoi ${progress.done + 1} / ${files.length}…` : entry ? "Enregistrer" : "Publier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ExistingMedia({ media, onRemoved }: { media: JournalMedia; onRemoved: () => void }) {
  const { run, pending } = useServerAction()
  return (
    <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
      {media.type === "VIDEO" ? (
        <video src={mediaUrl(media.id)} preload="metadata" muted playsInline className="size-full object-cover" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- fichier privé servi par une route protégée
        <img src={mediaUrl(media.id)} alt={media.caption ?? ""} className="size-full object-cover" />
      )}
      <button
        type="button"
        aria-label="Supprimer ce fichier"
        disabled={pending}
        onClick={() => confirm("Supprimer définitivement ce fichier ?") && run(() => deleteConstructionMedia(media.id), { onSuccess: onRemoved })}
        className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/65 text-white transition-colors hover:bg-black/85"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
      </button>
    </div>
  )
}
