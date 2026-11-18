"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Ban, ChevronDown, Loader2, Pencil, Play, Trash2, UserPlus } from "lucide-react"
import type { ConstructionStatus } from "@/generated/prisma/enums"
import { attachBuyer, deleteProject, setProjectStatus, updateProject, updateProjectNotes } from "@/app/admin/(app)/construction/actions"
import { useServerAction } from "@/hooks/use-server-action"
import { CONSTRUCTION_STATUS } from "@/lib/labels"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { MoneyInput } from "@/components/shared/money-input"
import { PhoneInput } from "@/components/shared/phone-input"
import { Field } from "@/components/admin/sales/plan-fields"
import { HouseFields, LandFields, type HouseValues, type LandValues, type LotOption, type ModelOption } from "@/components/admin/construction/project-fields"

export type EditableProject = {
  id: string
  reference: string
  status: ConstructionStatus
  land: LandValues
  house: HouseValues
  contractAmount: number | null
  startDate: string
  plannedEndDate: string
  showExpensesToClient: boolean
  buyerId: string | null
}

/** Étape suivante proposée en un clic, selon l'étape actuelle. */
const NEXT_STEP: Partial<Record<ConstructionStatus, { status: ConstructionStatus; label: string }>> = {
  REQUESTED: { status: "STUDY", label: "Démarrer l'étude" },
  SIGNED: { status: "IN_PROGRESS", label: "Démarrer le chantier" },
  SUSPENDED: { status: "IN_PROGRESS", label: "Reprendre le chantier" },
  IN_PROGRESS: { status: "DELIVERED", label: "Marquer comme livrée" },
}

const MANUAL: ConstructionStatus[] = ["REQUESTED", "STUDY", "OFFER_SENT", "SIGNED", "IN_PROGRESS", "SUSPENDED", "DELIVERED"]

export function ProjectActions({
  project,
  lots,
  models,
  currency,
  canDelete,
}: {
  project: EditableProject
  lots: LotOption[]
  models: ModelOption[]
  currency: string
  canDelete: boolean
}) {
  const router = useRouter()
  const { run, pending } = useServerAction()
  const [editing, setEditing] = React.useState(false)
  const [cancelling, setCancelling] = React.useState(false)
  const [reason, setReason] = React.useState("")
  const next = NEXT_STEP[project.status]

  function change(status: ConstructionStatus) {
    if (status === "DELIVERED" && !confirm("Marquer la maison comme livrée ? Le client en sera informé dans son espace.")) return
    run(() => setProjectStatus(project.id, status))
  }

  return (
    <>
      {next && (
        <Button disabled={pending} onClick={() => change(next.status)}>
          {pending ? <Loader2 className="animate-spin" /> : <Play />}
          {next.label}
        </Button>
      )}
      <Button variant="outline" onClick={() => setEditing(true)}>
        <Pencil />
        Modifier
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            Étape
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Placer le projet à l&apos;étape…</DropdownMenuLabel>
          {MANUAL.map((status) => (
            <DropdownMenuItem key={status} disabled={status === project.status || pending} onSelect={() => change(status)}>
              <span className="flex-1">{CONSTRUCTION_STATUS[status].label}</span>
              {status === project.status && <span className="text-xs text-muted-foreground">actuelle</span>}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {project.status !== "CANCELLED" && (
            <DropdownMenuItem variant="destructive" onSelect={() => setCancelling(true)}>
              <Ban />
              Classer sans suite
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem
              variant="destructive"
              disabled={pending}
              onSelect={() =>
                confirm(`Supprimer définitivement le projet ${project.reference} et ses fichiers ?`) &&
                run(() => deleteProject(project.id), { refresh: false, onSuccess: () => router.push("/admin/construction") })
              }
            >
              <Trash2 />
              Supprimer le projet
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {editing && <EditProjectDialog project={project} lots={lots} models={models} currency={currency} onClose={() => setEditing(false)} />}

      <Dialog open={cancelling} onOpenChange={setCancelling}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Classer le projet sans suite ?</DialogTitle>
            <DialogDescription>
              Le projet reste consultable avec ses versements et ses dépenses, mais plus aucun mouvement ne pourra y être ajouté. Il disparaît de l&apos;espace du client.
            </DialogDescription>
          </DialogHeader>
          <Field label="Motif" hint="Facultatif — conservé dans la fiche">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Ex. : le client a renoncé, financement non obtenu…" />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelling(false)}>
              Annuler
            </Button>
            <Button variant="destructive" disabled={pending} onClick={() => run(() => setProjectStatus(project.id, "CANCELLED", reason), { onSuccess: () => setCancelling(false) })}>
              {pending && <Loader2 className="animate-spin" />}
              Classer sans suite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function EditProjectDialog({
  project,
  lots,
  models,
  currency,
  onClose,
}: {
  project: EditableProject
  lots: LotOption[]
  models: ModelOption[]
  currency: string
  onClose: () => void
}) {
  const { run, pending } = useServerAction()
  const [land, setLand] = React.useState(project.land)
  const [house, setHouse] = React.useState(project.house)
  const [contractAmount, setContractAmount] = React.useState(project.contractAmount)
  const [startDate, setStartDate] = React.useState(project.startDate)
  const [plannedEndDate, setPlannedEndDate] = React.useState(project.plannedEndDate)
  const [showExpenses, setShowExpenses] = React.useState(project.showExpensesToClient)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setErrors({})
    run(
      () =>
        updateProject(project.id, {
          ...land,
          ...house,
          contractAmount,
          startDate: startDate || null,
          plannedEndDate: plannedEndDate || null,
          showExpensesToClient: showExpenses,
        }),
      { onSuccess: onClose, onError: (_, fieldErrors) => setErrors(fieldErrors ?? {}) },
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} className="grid gap-6">
          <DialogHeader>
            <DialogTitle>Modifier le projet {project.reference}</DialogTitle>
            <DialogDescription>Terrain, maison, montant du contrat et calendrier.</DialogDescription>
          </DialogHeader>

          <section className="grid gap-3">
            <h3 className="text-sm font-semibold">Maison</h3>
            <HouseFields value={house} onChange={setHouse} models={models} currency={currency} errors={errors} />
          </section>

          <section className="grid gap-3">
            <h3 className="text-sm font-semibold">Terrain</h3>
            <LandFields value={land} onChange={setLand} lots={lots} buyerId={project.buyerId} errors={errors} />
          </section>

          <section className="grid gap-3">
            <h3 className="text-sm font-semibold">Contrat et calendrier</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Montant du contrat" hint="Fixé par l'offre acceptée ; modifiable (avenant)">
                <MoneyInput value={contractAmount} onChange={setContractAmount} suffix={currency} />
              </Field>
              <Field label="Début du chantier">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
              <Field label="Livraison prévue">
                <Input type="date" value={plannedEndDate} onChange={(e) => setPlannedEndDate(e.target.value)} />
              </Field>
            </div>
            <label className="flex items-start gap-3 rounded-xl border p-3">
              <Switch checked={showExpenses} onCheckedChange={setShowExpenses} className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium">Partager les dépenses du chantier avec le client</span>
                <span className="block text-xs text-muted-foreground">
                  Il voit dans son espace les dépenses marquées « visibles » (matériaux, main-d&apos;œuvre, justificatifs). Désactivé : aucune dépense ne lui est montrée.
                </span>
              </span>
            </label>
          </section>

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

/** Rattache une demande à un client : crée sa fiche (ou retrouve celle qui porte ce téléphone) et lui ouvre l'espace client. */
export function AttachBuyerButton({ projectId, contact }: { projectId: string; contact: { name: string; phone: string; email: string | null } }) {
  const { run, pending } = useServerAction()
  const [open, setOpen] = React.useState(false)
  const parts = contact.name.trim().split(/\s+/)
  const [firstName, setFirstName] = React.useState(parts.slice(0, -1).join(" ") || parts[0] || "")
  const [lastName, setLastName] = React.useState(parts.length > 1 ? parts[parts.length - 1] : "")
  const [phone, setPhone] = React.useState(contact.phone)
  const [email, setEmail] = React.useState(contact.email ?? "")

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlus />
        Créer son espace client
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form
            className="grid gap-5"
            onSubmit={(event) => {
              event.preventDefault()
              run(() => attachBuyer(projectId, { firstName, lastName, phone, email }), { onSuccess: () => setOpen(false) })
            }}
          >
            <DialogHeader>
              <DialogTitle>Ouvrir l&apos;espace client</DialogTitle>
              <DialogDescription>
                Le client se connectera avec ce numéro de téléphone (code reçu par SMS) pour suivre son offre, ses versements et son chantier. Si une fiche existe déjà avec ce
                numéro, le projet lui est simplement rattaché.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Prénom">
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </Field>
              <Field label="Nom">
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </Field>
              <Field label="Téléphone" className="sm:col-span-2">
                <PhoneInput value={phone} onChange={setPhone} />
              </Field>
              <Field label="E-mail" className="sm:col-span-2">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                Rattacher le client
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Notes internes du projet (jamais montrées au client). */
export function ProjectNotes({ projectId, notes, canEdit }: { projectId: string; notes: string | null; canEdit: boolean }) {
  const { run, pending } = useServerAction()
  const [value, setValue] = React.useState(notes ?? "")
  const dirty = value !== (notes ?? "")
  if (!canEdit) return <p className="text-sm whitespace-pre-wrap text-muted-foreground">{notes || "Aucune note."}</p>
  return (
    <div className="space-y-2">
      <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={4} placeholder="Échanges avec le client, points à régler, accords particuliers…" />
      {dirty && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => run(() => updateProjectNotes(projectId, value))} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Enregistrer
          </Button>
        </div>
      )}
    </div>
  )
}
