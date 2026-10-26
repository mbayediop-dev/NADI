"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, CalendarRange, CheckCircle2, CircleDot, Circle, Pencil, Plus, Trash2 } from "lucide-react"
import type { MilestoneStatus } from "@/generated/prisma/enums"
import { formatDate } from "@/lib/format"
import { MILESTONE_STATUS } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { useServerAction } from "@/hooks/use-server-action"
import { deleteMilestone, moveMilestone, saveMilestone } from "@/app/admin/(app)/avancement/actions"
import { ToneBadge } from "@/components/shared/badges"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { FormField } from "@/components/admin/settings/form-bits"

export type MilestoneItem = {
  id: string
  title: string
  description: string | null
  progress: number
  status: MilestoneStatus
  startDate: Date | null
  endDate: Date | null
}

const toInputDate = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "")
const suggestStatus = (p: number): MilestoneStatus => (p >= 100 ? "DONE" : p > 0 ? "IN_PROGRESS" : "PLANNED")
const STATUS_ICON = { PLANNED: Circle, IN_PROGRESS: CircleDot, DONE: CheckCircle2 }

export function ProgressSlider({ value, onChange, id }: { value: number; onChange: (v: number) => void; id?: string }) {
  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow"
        style={{ background: `linear-gradient(to right, var(--primary) ${value}%, var(--muted) ${value}%)` }}
      />
      <div className="relative w-20">
        <Input
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(Math.max(0, Math.min(100, Number(e.target.value.replace(/\D/g, "")) || 0)))}
          className="h-9 pr-7 text-right font-semibold tabular"
          aria-label="Avancement en pourcentage"
        />
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-sm text-muted-foreground">%</span>
      </div>
    </div>
  )
}

function MilestoneDialog({ milestone, open, onOpenChange }: { milestone: MilestoneItem | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <MilestoneForm milestone={milestone} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  )
}

function MilestoneForm({ milestone, onOpenChange }: { milestone: MilestoneItem | null; onOpenChange: (o: boolean) => void }) {
  const { run, pending } = useServerAction()
  const [v, setV] = React.useState({
    title: milestone?.title ?? "",
    description: milestone?.description ?? "",
    progress: milestone?.progress ?? 0,
    status: (milestone?.status ?? "PLANNED") as MilestoneStatus,
    startDate: toInputDate(milestone?.startDate ?? null),
    endDate: toInputDate(milestone?.endDate ?? null),
  })
  const [statusTouched, setStatusTouched] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  return (
    <>
      <DialogHeader>
        <DialogTitle>{milestone ? "Modifier l'étape" : "Nouvelle étape"}</DialogTitle>
        <DialogDescription>Les étapes et leur avancement sont visibles par les visiteurs et les propriétaires.</DialogDescription>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          run(() => saveMilestone(milestone?.id ?? null, { ...v, startDate: v.startDate || null, endDate: v.endDate || null }), {
            onSuccess: () => onOpenChange(false),
            onError: (_, fe) => setErrors(fe ?? {}),
          })
        }}
      >
        <FormField label="Intitulé" htmlFor="ms-title" required error={errors.title}>
          <Input id="ms-title" className="h-9" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Ex. Réseau d'eau potable" />
        </FormField>
        <FormField label="Description" htmlFor="ms-desc">
          <Textarea
            id="ms-desc"
            rows={3}
            value={v.description}
            onChange={(e) => setV({ ...v, description: e.target.value })}
            placeholder="Ce qui est réalisé dans cette étape…"
          />
        </FormField>
        <FormField label="Avancement" htmlFor="ms-progress">
          <ProgressSlider
            id="ms-progress"
            value={v.progress}
            onChange={(progress) => setV((prev) => ({ ...prev, progress, status: statusTouched ? prev.status : suggestStatus(progress) }))}
          />
        </FormField>
        <FormField label="Statut" htmlFor="ms-status">
          <div id="ms-status" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
            {(["PLANNED", "IN_PROGRESS", "DONE"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setStatusTouched(true)
                  setV({ ...v, status: s, progress: s === "DONE" ? 100 : s === "PLANNED" && v.progress === 100 ? 0 : v.progress })
                }}
                className={cn("rounded-lg py-1.5 text-sm font-medium", v.status === s ? "bg-background shadow-sm" : "text-muted-foreground")}
              >
                {MILESTONE_STATUS[s].label}
              </button>
            ))}
          </div>
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Début" htmlFor="ms-start">
            <Input id="ms-start" type="date" className="h-9" value={v.startDate} onChange={(e) => setV({ ...v, startDate: e.target.value })} />
          </FormField>
          <FormField label="Fin prévue" htmlFor="ms-end" error={errors.endDate}>
            <Input id="ms-end" type="date" className="h-9" value={v.endDate} onChange={(e) => setV({ ...v, endDate: e.target.value })} />
          </FormField>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Spinner />}
            Enregistrer
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function MilestonesPanel({ milestones, canEdit }: { milestones: MilestoneItem[]; canEdit: boolean }) {
  const { run, pending } = useServerAction()
  const [editing, setEditing] = React.useState<MilestoneItem | null>(null)
  const [open, setOpen] = React.useState(false)

  return (
    <section className="rounded-2xl border bg-card shadow-xs">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3 md:px-5">
        <div>
          <h2 className="font-semibold">Étapes de viabilisation</h2>
          <p className="text-xs text-muted-foreground">Ordre d&apos;affichage sur le site</p>
        </div>
        {canEdit && (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null)
              setOpen(true)
            }}
          >
            <Plus /> Étape
          </Button>
        )}
      </header>
      {milestones.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-muted-foreground">
          Aucune étape. Ajoutez les grandes phases du chantier : bornage, voirie, eau, électricité…
        </p>
      ) : (
        <ol className="relative divide-y">
          {milestones.map((m, i) => {
            const Icon = STATUS_ICON[m.status]
            return (
              <li key={m.id} className="group flex gap-3 px-4 py-4 md:px-5">
                <Icon
                  className={cn(
                    "mt-0.5 size-5 shrink-0",
                    m.status === "DONE" ? "text-status-available-strong" : m.status === "IN_PROGRESS" ? "text-gold-strong" : "text-muted-foreground",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{m.title}</p>
                    <ToneBadge tone={MILESTONE_STATUS[m.status].tone} className="h-5 px-2 text-[0.68rem]">
                      {MILESTONE_STATUS[m.status].label}
                    </ToneBadge>
                  </div>
                  {m.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{m.description}</p>}
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full transition-all", m.status === "DONE" ? "bg-status-available" : "bg-primary")}
                        style={{ width: `${m.progress}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-sm font-bold tabular">{m.progress}%</span>
                  </div>
                  {(m.startDate || m.endDate) && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarRange className="size-3.5" />
                      {formatDate(m.startDate)} → {formatDate(m.endDate)}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <div className="flex shrink-0 flex-col items-center gap-0.5 opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:focus-within:opacity-100">
                    <Button variant="ghost" size="icon-xs" disabled={pending || i === 0} onClick={() => run(() => moveMilestone(m.id, -1))} aria-label="Monter">
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => {
                        setEditing(m)
                        setOpen(true)
                      }}
                      aria-label="Modifier"
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-destructive hover:text-destructive"
                      disabled={pending}
                      onClick={() => window.confirm(`Supprimer l'étape « ${m.title} » ?`) && run(() => deleteMilestone(m.id))}
                      aria-label="Supprimer"
                    >
                      <Trash2 />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      disabled={pending || i === milestones.length - 1}
                      onClick={() => run(() => moveMilestone(m.id, 1))}
                      aria-label="Descendre"
                    >
                      <ArrowDown />
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
      <MilestoneDialog milestone={editing} open={open} onOpenChange={setOpen} />
    </section>
  )
}
