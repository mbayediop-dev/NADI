"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, ArrowRight, CheckCircle2, CircleSlash, Download, FilePlus2, FileSpreadsheet, PencilLine, RotateCcw, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatNumber } from "@/lib/format"
import type { ImportPreview, PreviewRow } from "@/lib/lot-import"
import { useServerAction } from "@/hooks/use-server-action"
import { applyLotImport, previewLotImport } from "@/app/admin/(app)/terrains/actions"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { FileDropzone } from "@/components/shared/file-dropzone"
import { ToneBadge } from "@/components/shared/badges"

const ACTION: Record<PreviewRow["action"], { label: string; plural: string; tone: string; icon: React.ComponentType<{ className?: string }> }> = {
  create: { label: "Création", plural: "Créations", tone: "bg-status-available/12 text-status-available-strong ring-status-available/30", icon: FilePlus2 },
  update: { label: "Mise à jour", plural: "Mises à jour", tone: "bg-primary/10 text-primary ring-primary/25", icon: PencilLine },
  unchanged: { label: "Inchangé", plural: "Inchangés", tone: "bg-muted text-muted-foreground ring-border", icon: CircleSlash },
  error: { label: "Erreur", plural: "Erreurs", tone: "bg-status-sold/12 text-status-sold-strong ring-status-sold/30", icon: XCircle },
}

export function ImportWizard() {
  const { run, pending } = useServerAction()
  const [file, setFile] = React.useState<File | null>(null)
  const [preview, setPreview] = React.useState<ImportPreview | null>(null)
  const [filter, setFilter] = React.useState<PreviewRow["action"] | "changes">("changes")
  const [done, setDone] = React.useState<{ created: number; updated: number } | null>(null)

  function analyze(f: File) {
    setFile(f)
    const form = new FormData()
    form.append("file", f)
    run(() => previewLotImport(form), {
      refresh: false,
      onSuccess: (data) => {
        setPreview(data)
        setFilter(data.counts.error > 0 ? "error" : "changes")
      },
    })
  }

  function reset() {
    setFile(null)
    setPreview(null)
    setDone(null)
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 text-center shadow-xs">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-status-available/15 text-status-available-strong">
          <CheckCircle2 className="size-7" />
        </span>
        <h2 className="mt-4 text-xl font-bold">Import terminé</h2>
        <p className="mt-1 text-muted-foreground">
          {formatNumber(done.created)} terrain{done.created > 1 ? "s" : ""} créé{done.created > 1 ? "s" : ""} et {formatNumber(done.updated)} mis à jour.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button variant="outline" onClick={reset}>
            <RotateCcw /> Importer un autre fichier
          </Button>
          <Button asChild>
            <Link href="/admin/terrains">
              Voir les terrains <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  if (!preview) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border bg-card p-5 shadow-xs md:p-6">
          <h2 className="font-semibold">1. Choisissez votre fichier Excel</h2>
          <p className="mt-1 text-sm text-muted-foreground">Rien n&apos;est enregistré avant votre validation : vous verrez d&apos;abord un aperçu ligne par ligne.</p>
          <FileDropzone
            className="mt-5 py-14"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onFiles={(files) => analyze(files[0])}
            disabled={pending}
            hint="Format .xlsx · 5 Mo maximum"
          />
          {pending && (
            <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Spinner /> Analyse de {file?.name}…
            </p>
          )}
        </div>
        <aside className="space-y-4 rounded-2xl border bg-secondary/40 p-5">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <FileSpreadsheet className="size-5" />
          </span>
          <div>
            <p className="font-semibold">Partez du modèle</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Le modèle contient déjà tous vos terrains : modifiez les prix ou modalités, ajoutez des lignes pour de nouveaux terrains, puis réimportez-le.
            </p>
          </div>
          <Button variant="outline" className="w-full" asChild>
            <a href="/api/admin/import-template">
              <Download /> Télécharger le modèle
            </a>
          </Button>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li>• Le <strong className="text-foreground">numéro</strong> identifie chaque terrain.</li>
            <li>• Une cellule vide ne modifie pas la valeur existante.</li>
            <li>• Les terrains vendus gardent leur statut.</li>
          </ul>
        </aside>
      </div>
    )
  }

  const toApply = preview.rows.filter((r) => (r.action === "create" || r.action === "update") && r.data)
  const visible = preview.rows.filter((r) => (filter === "changes" ? r.action === "create" || r.action === "update" : r.action === filter))
  const tabs: { key: typeof filter; label: string; count: number }[] = [
    { key: "changes", label: "À appliquer", count: toApply.length },
    { key: "create", label: "Créations", count: preview.counts.create },
    { key: "update", label: "Mises à jour", count: preview.counts.update },
    { key: "unchanged", label: "Inchangés", count: preview.counts.unchanged },
    { key: "error", label: "Erreurs", count: preview.counts.error },
  ]

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-xs">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <FileSpreadsheet className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{file?.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatNumber(preview.rows.length)} ligne{preview.rows.length > 1 ? "s" : ""} analysée{preview.rows.length > 1 ? "s" : ""} · {preview.recognized.length} colonnes reconnues
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={reset}>
          <RotateCcw /> Changer de fichier
        </Button>
      </div>

      {preview.unknownHeaders.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-status-reserved/40 bg-status-reserved/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-reserved-strong" />
          <p>
            Colonnes ignorées (non reconnues) : <strong>{preview.unknownHeaders.join(", ")}</strong>. Vérifiez l&apos;orthographe ou créez le champ personnalisé correspondant.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["create", "update", "unchanged", "error"] as const).map((a) => {
          const Icon = ACTION[a].icon
          return (
            <div key={a} className="rounded-2xl border bg-card p-4 shadow-xs">
              <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Icon className="size-4" /> {ACTION[a].plural}
              </p>
              <p className={cn("mt-1 text-2xl font-bold tabular", a === "error" && preview.counts.error > 0 && "text-status-sold-strong")}>{preview.counts[a]}</p>
            </div>
          )
        })}
      </div>

      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(t.key)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium",
              filter === t.key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
            )}
          >
            {t.label}
            <span className="tabular opacity-70">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
        {visible.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">Aucune ligne dans cette catégorie.</p>
        ) : (
          <ul className="divide-y">
            {visible.map((row) => (
              <li key={row.line} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start">
                <div className="flex w-44 shrink-0 items-center gap-2">
                  <span className="w-12 text-xs text-muted-foreground tabular">L. {row.line}</span>
                  <span className="grid h-7 min-w-9 place-items-center rounded-lg bg-secondary px-1.5 text-sm font-bold tabular">{row.number}</span>
                </div>
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                  {row.errors.map((e) => (
                    <p key={e} className="font-medium text-status-sold-strong">
                      {e}
                    </p>
                  ))}
                  {row.action === "create" && row.data && (
                    <p className="text-muted-foreground">
                      Nouveau terrain · {row.data.areaM2 ? `${formatNumber(row.data.areaM2)} m²` : ""}
                      {row.data.price ? ` · ${formatNumber(row.data.price)} FCFA` : ""}
                    </p>
                  )}
                  {row.changes.map((c) => (
                    <p key={c.label} className="flex flex-wrap items-center gap-1.5">
                      <span className="text-muted-foreground">{c.label} :</span>
                      <span className="line-through decoration-muted-foreground/50 opacity-60 tabular">{c.from}</span>
                      <ArrowRight className="size-3.5 text-muted-foreground" />
                      <strong className="tabular">{c.to}</strong>
                    </p>
                  ))}
                  {row.warnings.map((w) => (
                    <p key={w} className="text-xs text-status-reserved-strong">
                      ⚠ {w}
                    </p>
                  ))}
                </div>
                <ToneBadge tone={ACTION[row.action].tone} className="self-start">
                  {ACTION[row.action].label}
                </ToneBadge>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-2 border-t bg-background/95 p-3 backdrop-blur md:static md:flex-row md:items-center md:justify-end md:border-0 md:bg-transparent md:p-0">
        {preview.counts.error > 0 && (
          <p className="text-xs text-muted-foreground md:mr-auto">Les lignes en erreur seront ignorées. Corrigez-les dans Excel puis réimportez si besoin.</p>
        )}
        <Button
          size="lg"
          className="h-11"
          disabled={pending || toApply.length === 0}
          onClick={() =>
            run(() => applyLotImport(toApply.map((r) => r.data)), {
              onSuccess: (data) => setDone(data),
            })
          }
        >
          {pending ? <Spinner /> : <CheckCircle2 />}
          Appliquer {formatNumber(toApply.length)} modification{toApply.length > 1 ? "s" : ""}
        </Button>
      </div>
    </div>
  )
}
