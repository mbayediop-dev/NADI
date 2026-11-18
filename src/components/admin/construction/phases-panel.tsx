"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, ListChecks, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import type { MilestoneStatus } from "@/generated/prisma/enums"
import { addDefaultPhases, deletePhase, movePhase, savePhase, setPhaseProgress } from "@/app/admin/(app)/construction/actions"
import { useServerAction } from "@/hooks/use-server-action"
import { formatDate } from "@/lib/format"
import { MILESTONE_STATUS } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ToneBadge } from "@/components/shared/badges"
import { Field } from "@/components/admin/sales/plan-fields"

export type PhaseRow = {
  id: string
  title: string
  description: string | null
  status: MilestoneStatus
  progress: number
  weight: number
  startDate: string | null
  endDate: string | null
}

type Draft = { id: string | null; title: string; description: string; weight: number; progress: number; startDate: string; endDate: string }

/** Étapes du chantier : avancement de chacune (curseur) et part dans l'avancement global. */
export function PhasesPanel({ projectId, phases, canEdit }: { projectId: string; phases: PhaseRow[]; canEdit: boolean }) {
  const { run, pending } = useServerAction()
  const [draft, setDraft] = React.useState<Draft | null>(null)
  const totalWeight = phases.reduce((sum, p) => sum + p.weight, 0)

  if (phases.length === 0) {
    return (
      <div className="px-5 pb-6 text-center">
        <p className="text-sm text-muted-foreground">Aucune étape définie : le client ne voit pas encore l&apos;avancement de son chantier.</p>
        {canEdit && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button disabled={pending} onClick={() => run(() => addDefaultPhases(projectId))}>
              {pending ? <Loader2 className="animate-spin" /> : <ListChecks />}
              Ajouter les étapes types
            </Button>
            <Button variant="outline" onClick={() => setDraft({ id: null, title: "", description: "", weight: 10, progress: 0, startDate: "", endDate: "" })}>
              <Plus />
              Étape personnalisée
            </Button>
          </div>
        )}
        {draft && <PhaseDialog projectId={projectId} draft={draft} onClose={() => setDraft(null)} />}
      </div>
    )
  }

  return (
    <>
      <ul className="divide-y border-t">
        {phases.map((phase, index) => (
          <li key={phase.id} className="px-4 py-3.5 sm:px-5">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold tabular",
                  phase.status === "DONE" ? "bg-status-available text-white" : phase.status === "IN_PROGRESS" ? "bg-gold text-gold-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="font-medium">{phase.title}</p>
                  <ToneBadge tone={MILESTONE_STATUS[phase.status].tone}>{MILESTONE_STATUS[phase.status].label}</ToneBadge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {totalWeight > 0 ? `${Math.round((phase.weight / totalWeight) * 100)} % du chantier` : "Sans poids"}
                  {phase.startDate || phase.endDate ? ` · ${phase.startDate ? formatDate(phase.startDate) : "…"} → ${phase.endDate ? formatDate(phase.endDate) : "…"}` : ""}
                </p>
                {phase.description && <p className="mt-1 text-sm text-muted-foreground">{phase.description}</p>}
                <ProgressSlider key={`${phase.id}-${phase.progress}`} phase={phase} disabled={!canEdit} />
              </div>
              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Actions sur l'étape ${phase.title}`}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() =>
                        setDraft({
                          id: phase.id,
                          title: phase.title,
                          description: phase.description ?? "",
                          weight: phase.weight,
                          progress: phase.progress,
                          startDate: phase.startDate?.slice(0, 10) ?? "",
                          endDate: phase.endDate?.slice(0, 10) ?? "",
                        })
                      }
                    >
                      <Pencil />
                      Modifier
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={index === 0} onSelect={() => run(() => movePhase(phase.id, "up"))}>
                      <ArrowUp />
                      Monter
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={index === phases.length - 1} onSelect={() => run(() => movePhase(phase.id, "down"))}>
                      <ArrowDown />
                      Descendre
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => confirm(`Supprimer l'étape « ${phase.title} » ?`) && run(() => deletePhase(phase.id))}>
                      <Trash2 />
                      Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </li>
        ))}
      </ul>
      {canEdit && (
        <div className="border-t px-5 py-3">
          <Button variant="outline" size="sm" onClick={() => setDraft({ id: null, title: "", description: "", weight: 10, progress: 0, startDate: "", endDate: "" })}>
            <Plus />
            Ajouter une étape
          </Button>
        </div>
      )}
      {draft && <PhaseDialog projectId={projectId} draft={draft} onClose={() => setDraft(null)} />}
    </>
  )
}

/** Curseur d'avancement : la valeur n'est enregistrée qu'au relâchement. */
function ProgressSlider({ phase, disabled }: { phase: PhaseRow; disabled: boolean }) {
  const { run, pending } = useServerAction()
  const [value, setValue] = React.useState(phase.progress)
  const commit = () => value !== phase.progress && run(() => setPhaseProgress(phase.id, value))
  return (
    <div className="mt-2 flex items-center gap-3">
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        disabled={disabled || pending}
        onChange={(e) => setValue(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        aria-label={`Avancement de l'étape ${phase.title}`}
        className="h-1.5 min-w-0 flex-1 cursor-pointer accent-primary disabled:cursor-default"
      />
      <span className="w-12 text-right text-sm font-semibold tabular">{pending ? <Loader2 className="ml-auto size-4 animate-spin" /> : `${value} %`}</span>
    </div>
  )
}

function PhaseDialog({ projectId, draft, onClose }: { projectId: string; draft: Draft; onClose: () => void }) {
  const { run, pending } = useServerAction()
  const [values, setValues] = React.useState(draft)
  const set = <K extends keyof Draft>(key: K, v: Draft[K]) => setValues((s) => ({ ...s, [key]: v }))

  function submit(event: React.FormEvent) {
    event.preventDefault()
    run(
      () =>
        savePhase(projectId, {
          id: values.id,
          title: values.title,
          description: values.description,
          weight: values.weight,
          progress: values.progress,
          startDate: values.startDate || null,
          endDate: values.endDate || null,
        }),
      { onSuccess: onClose },
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Modifier l'étape" : "Nouvelle étape du chantier"}</DialogTitle>
            <DialogDescription>Le poids indique la part de cette étape dans l&apos;avancement global du chantier.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Intitulé" className="sm:col-span-2">
              <Input value={values.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex. : Élévation des murs" required autoFocus />
            </Field>
            <Field label="Poids" hint="Ex. : 20 pour une étape qui pèse deux fois plus qu'une étape à 10">
              <Input type="number" min={0} max={100} value={values.weight} onChange={(e) => set("weight", Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))))} />
            </Field>
            <Field label="Avancement (%)">
              <Input type="number" min={0} max={100} step={5} value={values.progress} onChange={(e) => set("progress", Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))))} />
            </Field>
            <Field label="Début prévu">
              <Input type="date" value={values.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </Field>
            <Field label="Fin prévue">
              <Input type="date" value={values.endDate} onChange={(e) => set("endDate", e.target.value)} />
            </Field>
            <Field label="Description" className="sm:col-span-2" hint="Visible par le client">
              <Textarea value={values.description} onChange={(e) => set("description", e.target.value)} rows={2} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
