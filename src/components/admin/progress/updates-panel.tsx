"use client"

import * as React from "react"
import { ArrowLeft, ArrowRight, Film, Globe, ImageIcon, Lock, Pencil, Pin, Plus, Trash2, Users, Video } from "lucide-react"
import { toast } from "sonner"
import type { MediaType, Visibility } from "@/generated/prisma/enums"
import { formatDateLong } from "@/lib/format"
import { VISIBILITY } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { formatBytes, uploadFile } from "@/lib/upload-client"
import { useServerAction } from "@/hooks/use-server-action"
import {
  addEmbedMedia,
  addUploadedMedia,
  deleteMedia,
  deleteSiteUpdate,
  moveMedia,
  saveSiteUpdate,
  updateMediaCaption,
} from "@/app/admin/(app)/avancement/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { FileDropzone } from "@/components/shared/file-dropzone"
import { FormField } from "@/components/admin/settings/form-bits"

export type MediaItem = { id: string; type: MediaType; url: string; caption: string | null; size: number | null }
export type UpdateItem = {
  id: string
  title: string
  body: string
  visibility: Visibility
  pinned: boolean
  milestoneId: string | null
  milestoneTitle: string | null
  publishedAt: Date
  media: MediaItem[]
}

const VIS_ICON = { PUBLIC: Globe, CLIENTS: Users, PRIVATE: Lock }
const VIS_TONE = {
  PUBLIC: "bg-status-available/12 text-status-available-strong",
  CLIENTS: "bg-primary/10 text-primary",
  PRIVATE: "bg-muted text-muted-foreground",
}

function youtubeThumb(url: string) {
  const id = url.match(/youtube\.com\/embed\/([\w-]+)/)?.[1]
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
}

function MediaThumb({ media, className }: { media: MediaItem; className?: string }) {
  if (media.type === "IMAGE") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={media.url} alt={media.caption ?? ""} className={cn("size-full object-cover", className)} loading="lazy" />
  }
  if (media.type === "VIDEO") {
    return <video src={`${media.url}#t=0.5`} preload="metadata" muted playsInline className={cn("size-full bg-black object-cover", className)} />
  }
  const thumb = youtubeThumb(media.url)
  return thumb ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={thumb} alt="" className={cn("size-full object-cover", className)} loading="lazy" />
  ) : (
    <div className={cn("grid size-full place-items-center bg-pine-deep text-white", className)}>
      <Film className="size-6" />
    </div>
  )
}

const todayInput = () => new Date().toISOString().slice(0, 10)

export function UpdatesPanel({ updates, milestones, canEdit }: { updates: UpdateItem[]; milestones: { id: string; title: string }[]; canEdit: boolean }) {
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [creating, setCreating] = React.useState(false)
  const editing = updates.find((u) => u.id === editingId) ?? null

  return (
    <section className="rounded-2xl border bg-card shadow-xs">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3 md:px-5">
        <div>
          <h2 className="font-semibold">Actualités du chantier</h2>
          <p className="text-xs text-muted-foreground">Photos, vidéos et nouvelles pour vos clients</p>
        </div>
        {canEdit && (
          <Button
            size="sm"
            onClick={() => {
              setEditingId(null)
              setCreating(true)
            }}
          >
            <Plus /> Publier
          </Button>
        )}
      </header>
      {updates.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-muted-foreground">Aucune actualité. Publiez des photos de l&apos;avancement pour rassurer vos acheteurs.</p>
      ) : (
        <ul className="divide-y">
          {updates.map((u) => {
            const Icon = VIS_ICON[u.visibility]
            return (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => canEdit && setEditingId(u.id)}
                  className={cn("flex w-full gap-4 px-4 py-4 text-left md:px-5", canEdit && "transition-colors hover:bg-muted/40")}
                >
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted sm:size-24">
                    {u.media[0] ? (
                      <MediaThumb media={u.media[0]} />
                    ) : (
                      <div className="grid size-full place-items-center text-muted-foreground">
                        <ImageIcon className="size-6" />
                      </div>
                    )}
                    {u.media.length > 1 && (
                      <span className="absolute right-1 bottom-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[0.65rem] font-semibold text-white">+{u.media.length - 1}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {u.pinned && <Pin className="size-3.5 fill-gold text-gold-strong" />}
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.68rem] font-semibold", VIS_TONE[u.visibility])}>
                        <Icon className="size-3" />
                        {VISIBILITY[u.visibility].label}
                      </span>
                      {u.milestoneTitle && <span className="truncate text-xs text-muted-foreground">· {u.milestoneTitle}</span>}
                    </div>
                    <p className="mt-1 line-clamp-1 font-semibold">{u.title}</p>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{u.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateLong(u.publishedAt)}</p>
                  </div>
                  {canEdit && <Pencil className="mt-1 size-4 shrink-0 text-muted-foreground" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <UpdateSheet
        key={editing?.id ?? "new"}
        update={editing}
        open={!!editing || creating}
        milestones={milestones}
        onCreated={(id) => setEditingId(id)}
        onClose={() => {
          setEditingId(null)
          setCreating(false)
        }}
      />
    </section>
  )
}

function UpdateSheet({
  update,
  open,
  milestones,
  onCreated,
  onClose,
}: {
  update: UpdateItem | null
  open: boolean
  milestones: { id: string; title: string }[]
  onCreated: (id: string) => void
  onClose: () => void
}) {
  const { run, pending } = useServerAction()
  const [v, setV] = React.useState(() => ({
    title: update?.title ?? "",
    body: update?.body ?? "",
    visibility: (update?.visibility ?? "PUBLIC") as Visibility,
    milestoneId: update?.milestoneId ?? "",
    pinned: update?.pinned ?? false,
    publishedAt: update ? new Date(update.publishedAt).toISOString().slice(0, 10) : todayInput(),
  }))
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  function save() {
    run(() => saveSiteUpdate(update?.id ?? null, { ...v, milestoneId: v.milestoneId || null }), {
      onSuccess: (data) => !update && onCreated(data.id),
      onError: (_, fe) => setErrors(fe ?? {}),
    })
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="border-b p-5">
          <SheetTitle>{update ? "Modifier l'actualité" : "Nouvelle actualité"}</SheetTitle>
          <SheetDescription>Une nouvelle bien illustrée rassure vos acheteurs et donne envie aux visiteurs.</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 p-5">
          <FormField label="Titre" htmlFor="up-title" required error={errors.title}>
            <Input id="up-title" className="h-10 text-base font-semibold" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Ex. La chaussée de l'avenue principale est terminée" />
          </FormField>
          <FormField label="Texte" htmlFor="up-body" required error={errors.body}>
            <Textarea id="up-body" rows={6} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} placeholder="Racontez l'avancement, les prochaines étapes, les dates clés…" />
          </FormField>
          <FormField label="Visibilité" htmlFor="up-vis">
            <div id="up-vis" className="grid gap-2 sm:grid-cols-3">
              {(["PUBLIC", "CLIENTS", "PRIVATE"] as const).map((vis) => {
                const Icon = VIS_ICON[vis]
                return (
                  <button
                    key={vis}
                    type="button"
                    onClick={() => setV({ ...v, visibility: vis })}
                    className={cn(
                      "flex items-start gap-2 rounded-xl border p-3 text-left transition-all",
                      v.visibility === vis ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50",
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
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Étape liée" htmlFor="up-ms">
              <Select value={v.milestoneId || "__none"} onValueChange={(val) => setV({ ...v, milestoneId: val === "__none" ? "" : val })}>
                <SelectTrigger id="up-ms" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Aucune</SelectItem>
                  {milestones.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Date de publication" htmlFor="up-date">
              <Input id="up-date" type="date" className="h-9" value={v.publishedAt} onChange={(e) => setV({ ...v, publishedAt: e.target.value })} />
            </FormField>
          </div>
          <label className="flex items-center justify-between gap-4 rounded-xl border p-3">
            <span>
              <span className="block text-sm font-semibold">Épingler en tête</span>
              <span className="text-xs text-muted-foreground">Mise en avant sur le site (une seule actualité épinglée).</span>
            </span>
            <Switch checked={v.pinned} onCheckedChange={(pinned) => setV({ ...v, pinned })} />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {update ? (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={pending}
                onClick={() => window.confirm("Supprimer cette actualité et ses médias ?") && run(() => deleteSiteUpdate(update.id), { onSuccess: onClose })}
              >
                <Trash2 /> Supprimer
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={save} disabled={pending || !v.publishedAt}>
              {pending && <Spinner />}
              {update ? "Enregistrer" : "Créer et ajouter des médias"}
            </Button>
          </div>

          {update ? (
            <MediaManager update={update} />
          ) : (
            <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
              Les photos et vidéos pourront être ajoutées dès l&apos;actualité créée.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function MediaManager({ update }: { update: UpdateItem }) {
  const { run, pending } = useServerAction()
  const [uploads, setUploads] = React.useState<{ name: string; size: number; progress: number }[]>([])
  const [link, setLink] = React.useState("")

  async function handleFiles(files: File[]) {
    const accepted = files.filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"))
    if (accepted.length < files.length) toast.warning("Certains fichiers ont été ignorés (images et vidéos uniquement).")
    setUploads(accepted.map((f) => ({ name: f.name, size: f.size, progress: 0 })))
    for (const [i, file] of accepted.entries()) {
      try {
        const uploaded = await uploadFile(file, {
          scope: "public",
          folder: "updates",
          onProgress: (p) => setUploads((list) => list.map((u, j) => (j === i ? { ...u, progress: p } : u))),
        })
        await run(() => addUploadedMedia(update.id, { key: uploaded.key, url: uploaded.url ?? "", mimeType: uploaded.mimeType, size: uploaded.size }))
      } catch (error) {
        toast.error(`${file.name} : ${error instanceof Error ? error.message : "échec du téléversement"}`)
      }
    }
    setUploads([])
  }

  return (
    <div className="space-y-4 border-t pt-5">
      <div>
        <h3 className="font-semibold">Photos et vidéos</h3>
        <p className="text-sm text-muted-foreground">La première image sert de couverture. Les vidéos lourdes : préférez un lien YouTube.</p>
      </div>
      <FileDropzone onFiles={handleFiles} multiple accept="image/*,video/mp4,video/webm,video/quicktime" disabled={uploads.length > 0} hint="Images (JPG, PNG, WebP) et vidéos (MP4) · 250 Mo max. par fichier" />
      {uploads.length > 0 && (
        <ul className="space-y-2">
          {uploads.map((u) => (
            <li key={u.name} className="rounded-lg border p-2.5 text-sm">
              <div className="mb-1.5 flex justify-between gap-2">
                <span className="truncate">{u.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(u.size)}</span>
              </div>
              <Progress value={u.progress * 100} className="h-1.5" />
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (link.trim()) run(() => addEmbedMedia(update.id, link), { onSuccess: () => setLink("") })
        }}
      >
        <div className="relative flex-1">
          <Video className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Lien YouTube ou Vimeo" className="h-9 pl-9" />
        </div>
        <Button type="submit" variant="outline" disabled={pending || !link.trim()}>
          Ajouter
        </Button>
      </form>

      {update.media.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {update.media.map((m, i) => (
            <li key={m.id} className="overflow-hidden rounded-xl border bg-card">
              <div className="relative aspect-[4/3] bg-muted">
                <MediaThumb media={m} />
                {i === 0 && <span className="absolute top-2 left-2 rounded-md bg-gold px-1.5 py-0.5 text-[0.65rem] font-bold text-gold-foreground">Couverture</span>}
                <span className="absolute top-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[0.65rem] font-semibold text-white">
                  {m.type === "IMAGE" ? "Photo" : m.type === "VIDEO" ? "Vidéo" : "Lien vidéo"}
                </span>
              </div>
              <div className="space-y-2 p-2">
                <Input
                  defaultValue={m.caption ?? ""}
                  placeholder="Légende…"
                  className="h-8 text-xs"
                  onBlur={(e) => e.target.value !== (m.caption ?? "") && run(() => updateMediaCaption(m.id, e.target.value), { success: "Légende enregistrée" })}
                />
                <div className="flex items-center justify-between">
                  <div className="flex">
                    <Button variant="ghost" size="icon-xs" disabled={pending || i === 0} onClick={() => run(() => moveMedia(m.id, -1))} aria-label="Avancer">
                      <ArrowLeft />
                    </Button>
                    <Button variant="ghost" size="icon-xs" disabled={pending || i === update.media.length - 1} onClick={() => run(() => moveMedia(m.id, 1))} aria-label="Reculer">
                      <ArrowRight />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-destructive hover:text-destructive"
                    disabled={pending}
                    onClick={() => window.confirm("Supprimer ce média ?") && run(() => deleteMedia(m.id))}
                    aria-label="Supprimer"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
