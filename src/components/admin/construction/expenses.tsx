"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Eye, EyeOff, Loader2, MoreHorizontal, Paperclip, Pencil, Plus, Trash2, X } from "lucide-react"
import type { ExpenseCategory, ExpenseScope, PaymentMethod } from "@/generated/prisma/enums"
import { deleteExpense, saveExpense } from "@/app/admin/(app)/depenses/actions"
import { useServerAction } from "@/hooks/use-server-action"
import { formatDate, formatMoney, formatNumber } from "@/lib/format"
import { EXPENSE_CATEGORY, EXPENSE_CATEGORY_ORDER, EXPENSE_SCOPE, PAYMENT_METHOD } from "@/lib/labels"
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
import { MoneyInput } from "@/components/shared/money-input"
import { Combobox } from "@/components/admin/sales/combobox"
import { Field } from "@/components/admin/sales/plan-fields"

const METHODS = Object.keys(PAYMENT_METHOD) as PaymentMethod[]
const NONE = "none"

export type ExpenseRow = {
  id: string
  scope: ExpenseScope
  projectId: string | null
  projectLabel: string | null
  phaseId: string | null
  phaseTitle: string | null
  category: ExpenseCategory
  label: string
  supplier: string | null
  quantity: number | null
  unit: string | null
  unitPrice: number | null
  amount: number
  spentAt: string
  method: PaymentMethod | null
  reference: string | null
  note: string | null
  visibleToClient: boolean
  attachmentName: string | null
}

export type ExpenseProjectOption = { id: string; label: string; phases: { id: string; title: string }[] }

/**
 * Contexte de saisie :
 * - `fixedProject` : dépenses d'un chantier précis (fiche du projet)
 * - sinon : choix entre le lotissement et un chantier parmi `projects`
 */
export type ExpenseContext = { currency: string; today: string; fixedProject?: ExpenseProjectOption; projects?: ExpenseProjectOption[] }

export function NewExpenseButton({ context, size = "default", variant = "default" }: { context: ExpenseContext; size?: "default" | "sm"; variant?: "default" | "outline" }) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        <Plus />
        Nouvelle dépense
      </Button>
      {open && <ExpenseDialog context={context} onClose={() => setOpen(false)} />}
    </>
  )
}

export { ExpenseBreakdown } from "@/components/shared/construction-bits"

/** Liste de dépenses avec modification et suppression. `showProject` : affiche le chantier ou « Lotissement » (page Dépenses). */
export function ExpenseList({
  expenses,
  context,
  canEdit,
  showProject = false,
  empty = "Aucune dépense enregistrée pour le moment.",
}: {
  expenses: ExpenseRow[]
  context: ExpenseContext
  canEdit: boolean
  showProject?: boolean
  empty?: string
}) {
  const { run, pending } = useServerAction()
  const [editing, setEditing] = React.useState<ExpenseRow | null>(null)
  const { currency } = context

  if (expenses.length === 0) return <p className="px-5 py-10 text-center text-sm text-muted-foreground">{empty}</p>

  return (
    <>
      <ul className="divide-y">
        {expenses.map((e) => (
          <li key={e.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
            <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: EXPENSE_CATEGORY[e.category].color }} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="min-w-0 font-medium">{e.label}</p>
                <p className="font-semibold whitespace-nowrap tabular">{formatMoney(e.amount, currency)}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDate(e.spentAt)} · {EXPENSE_CATEGORY[e.category].label}
                {e.supplier ? ` · ${e.supplier}` : ""}
                {e.quantity != null && e.unitPrice != null ? ` · ${formatNumber(e.quantity)}${e.unit ? ` ${e.unit}` : ""} × ${formatNumber(e.unitPrice)}` : ""}
                {e.reference ? ` · réf. ${e.reference}` : ""}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                {showProject &&
                  (e.projectId ? (
                    <Link href={`/admin/construction/${e.projectId}?onglet=finances`} className="font-medium text-primary hover:underline">
                      {e.projectLabel}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground/80">{EXPENSE_SCOPE.SITE.label}</span>
                  ))}
                {e.phaseTitle && <span className="text-muted-foreground">{e.phaseTitle}</span>}
                {e.scope === "PROJECT" && (
                  <span className={cn("inline-flex items-center gap-1", e.visibleToClient ? "text-status-available-strong" : "text-muted-foreground")}>
                    {e.visibleToClient ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                    {e.visibleToClient ? "Visible du client" : "Interne"}
                  </span>
                )}
                {e.attachmentName && (
                  <a href={`/api/construction/expenses/${e.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    <Paperclip className="size-3.5" />
                    Justificatif
                  </a>
                )}
              </div>
              {e.note && <p className="mt-1 text-xs text-muted-foreground italic">{e.note}</p>}
            </div>
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Actions sur la dépense ${e.label}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setEditing(e)}>
                    <Pencil />
                    Modifier
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={pending}
                    onSelect={() => confirm(`Supprimer la dépense « ${e.label} » (${formatMoney(e.amount, currency)}) ?`) && run(() => deleteExpense(e.id))}
                  >
                    <Trash2 />
                    Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </li>
        ))}
      </ul>
      {editing && <ExpenseDialog context={context} expense={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function parseNumber(value: string) {
  const n = Number(value.replace(/\s/g, "").replace(",", "."))
  return value.trim() && Number.isFinite(n) && n >= 0 ? n : null
}

export function ExpenseDialog({ context, expense, onClose }: { context: ExpenseContext; expense?: ExpenseRow; onClose: () => void }) {
  const { run, pending } = useServerAction()
  const { currency, fixedProject } = context
  const projects = fixedProject ? [fixedProject] : (context.projects ?? [])

  const [scope, setScope] = React.useState<ExpenseScope>(expense?.scope ?? (fixedProject ? "PROJECT" : "SITE"))
  const [projectId, setProjectId] = React.useState<string | undefined>(expense?.projectId ?? fixedProject?.id)
  const [phaseId, setPhaseId] = React.useState<string | null>(expense?.phaseId ?? null)
  const [category, setCategory] = React.useState<ExpenseCategory>(expense?.category ?? "MATERIALS")
  const [label, setLabel] = React.useState(expense?.label ?? "")
  const [supplier, setSupplier] = React.useState(expense?.supplier ?? "")
  const [quantity, setQuantity] = React.useState(expense?.quantity != null ? String(expense.quantity) : "")
  const [unit, setUnit] = React.useState(expense?.unit ?? "")
  const [unitPrice, setUnitPrice] = React.useState<number | null>(expense?.unitPrice ?? null)
  const [amount, setAmount] = React.useState<number | null>(expense?.amount ?? null)
  const [spentAt, setSpentAt] = React.useState(expense?.spentAt.slice(0, 10) ?? context.today)
  const [method, setMethod] = React.useState<PaymentMethod | null>(expense?.method ?? "CASH")
  const [reference, setReference] = React.useState(expense?.reference ?? "")
  const [note, setNote] = React.useState(expense?.note ?? "")
  const [visible, setVisible] = React.useState(expense?.visibleToClient ?? true)
  // Justificatif : undefined = inchangé, null = retiré, File = nouveau fichier
  const [file, setFile] = React.useState<File | null | undefined>(undefined)
  const [progress, setProgress] = React.useState<number | null>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)

  const project = projects.find((p) => p.id === projectId)
  const currentAttachment = file === undefined ? (expense?.attachmentName ?? null) : (file?.name ?? null)

  // Quantité × prix unitaire : le montant suit tant qu'il n'a pas été saisi à la main
  function syncAmount(q: string, price: number | null) {
    const n = parseNumber(q)
    if (n != null && price != null) setAmount(Math.round(n * price))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!amount || amount <= 0) return toast.error("Indiquez le montant de la dépense")
    if (scope === "PROJECT" && !projectId) return toast.error("Choisissez le chantier concerné")
    let attachment: { key: string; filename: string; mimeType: string } | null | undefined = file === null ? null : undefined
    if (file) {
      try {
        setProgress(0)
        const stored = await uploadFile(file, { scope: "private", folder: "expenses", onProgress: setProgress })
        attachment = { key: stored.key, filename: stored.filename, mimeType: stored.mimeType }
      } catch (error) {
        setProgress(null)
        return toast.error(error instanceof Error ? error.message : "Échec du téléversement du justificatif")
      }
      setProgress(null)
    }
    run(
      () =>
        saveExpense({
          id: expense?.id,
          scope,
          projectId: scope === "PROJECT" ? projectId : null,
          phaseId: scope === "PROJECT" ? phaseId : null,
          category,
          label,
          supplier,
          quantity: parseNumber(quantity),
          unit,
          unitPrice,
          amount,
          spentAt,
          method,
          reference,
          note,
          visibleToClient: visible,
          attachment,
        }),
      { onSuccess: onClose },
    )
  }

  const busy = pending || progress != null

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{expense ? "Modifier la dépense" : "Nouvelle dépense"}</DialogTitle>
            <DialogDescription>
              {fixedProject ? `Chantier : ${fixedProject.label}` : "Dépense du lotissement (viabilisation, voirie, frais du site) ou du chantier d'un client."}
            </DialogDescription>
          </DialogHeader>

          {!fixedProject && (
            <div className="grid gap-4">
              <div role="radiogroup" aria-label="Rattachement" className="grid grid-cols-2 gap-2">
                {(["SITE", "PROJECT"] as ExpenseScope[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={scope === s}
                    onClick={() => setScope(s)}
                    className={cn("rounded-xl border p-3 text-left transition-colors", scope === s ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50")}
                  >
                    <span className="block text-sm font-semibold">{EXPENSE_SCOPE[s].label}</span>
                    <span className="block text-xs text-muted-foreground">{EXPENSE_SCOPE[s].hint}</span>
                  </button>
                ))}
              </div>
              {scope === "PROJECT" && (
                <Field label="Chantier *">
                  <Combobox
                    value={projectId}
                    onChange={(id) => {
                      setProjectId(id)
                      setPhaseId(null)
                    }}
                    placeholder="Référence, intitulé ou client…"
                    empty="Aucun chantier."
                    options={projects.map((p) => ({ value: p.id, label: p.label }))}
                  />
                </Field>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-6">
            <Field label="Désignation *" className="sm:col-span-4">
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. : Ciment CEM II 32,5 — 120 sacs" required autoFocus={!expense} />
            </Field>
            <Field label="Catégorie" className="sm:col-span-2">
              <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORY_ORDER.map((c) => (
                    <SelectItem key={c} value={c}>
                      {EXPENSE_CATEGORY[c].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Fournisseur / prestataire" className="sm:col-span-3">
              <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Ex. : Quincaillerie Touba" />
            </Field>
            <Field label="Date *" className="sm:col-span-3">
              <Input type="date" value={spentAt} onChange={(e) => setSpentAt(e.target.value)} required />
            </Field>
            <Field label="Quantité" className="sm:col-span-2">
              <Input
                inputMode="decimal"
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value)
                  syncAmount(e.target.value, unitPrice)
                }}
                className="tabular"
              />
            </Field>
            <Field label="Unité" className="sm:col-span-1">
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="sac" />
            </Field>
            <Field label="Prix unitaire" className="sm:col-span-3">
              <MoneyInput
                value={unitPrice}
                onChange={(v) => {
                  setUnitPrice(v)
                  syncAmount(quantity, v)
                }}
                suffix={currency}
              />
            </Field>
            <Field label="Montant total *" className="sm:col-span-3">
              <MoneyInput value={amount} onChange={setAmount} suffix={currency} className="h-11 text-lg font-semibold" />
            </Field>
            <Field label="Mode de règlement" className="sm:col-span-3">
              <Select value={method ?? NONE} onValueChange={(v) => setMethod(v === NONE ? null : (v as PaymentMethod))}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Non précisé</SelectItem>
                  {METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {PAYMENT_METHOD[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="N° de facture ou de bon" className="sm:col-span-3">
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </Field>
            {scope === "PROJECT" && (
              <Field label="Étape du chantier" className="sm:col-span-3">
                <Select value={phaseId ?? NONE} onValueChange={(v) => setPhaseId(v === NONE ? null : v)} disabled={!project || project.phases.length === 0}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Aucune étape</SelectItem>
                    {project?.phases.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label="Note" className="sm:col-span-6">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </Field>
          </div>

          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
              <Paperclip className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1 text-sm">
                {currentAttachment ? (
                  <p className="truncate font-medium">
                    {currentAttachment}
                    {file ? <span className="font-normal text-muted-foreground"> ({formatBytes(file.size)})</span> : null}
                  </p>
                ) : (
                  <p className="text-muted-foreground">Justificatif : facture, reçu ou bon de livraison (PDF ou photo)</p>
                )}
                {progress != null && <Progress value={progress * 100} className="mt-2 h-1.5" />}
              </div>
              {currentAttachment && (
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Retirer le justificatif" onClick={() => setFile(null)} disabled={busy}>
                  <X />
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
                {currentAttachment ? "Remplacer" : "Joindre"}
              </Button>
              <input ref={fileRef} type="file" hidden accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? undefined)} />
            </div>

            {scope === "PROJECT" && (
              <label className="flex items-start gap-3 rounded-xl border p-3">
                <Switch checked={visible} onCheckedChange={setVisible} className="mt-0.5" />
                <span>
                  <span className="block text-sm font-medium">Visible par le client</span>
                  <span className="block text-xs text-muted-foreground">
                    La dépense (désignation, montant, justificatif) apparaît dans son espace. Désactivez pour une dépense interne.
                  </span>
                </span>
              </label>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Annuler
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {expense ? "Enregistrer" : "Ajouter la dépense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
