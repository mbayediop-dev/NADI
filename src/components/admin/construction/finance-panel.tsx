"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { addMonths, format } from "date-fns"
import { toast } from "sonner"
import { CalendarCog, Loader2, MoreHorizontal, Pencil, Plus, Receipt as ReceiptIcon, ReceiptText, Trash2, Wand2 } from "lucide-react"
import type { PaymentMethod } from "@/generated/prisma/enums"
import { deleteConstructionPayment, recordConstructionPayment, saveSchedule, updateConstructionPayment } from "@/app/admin/(app)/construction/actions"
import { useServerAction } from "@/hooks/use-server-action"
import { formatDate, formatMoney } from "@/lib/format"
import { PAYMENT_METHOD } from "@/lib/labels"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { MoneyInput } from "@/components/shared/money-input"
import { MethodIcon } from "@/components/admin/payments/method-icon"
import { Field } from "@/components/admin/sales/plan-fields"

const METHODS = Object.keys(PAYMENT_METHOD) as PaymentMethod[]

// ─────────────────────────────────────────────────────────────
// Échéancier des appels de fonds
// ─────────────────────────────────────────────────────────────

export type ScheduleLineInput = { label: string; dueDate: string; amount: number | null }

/** Répartition courante d'un contrat de construction, calée sur l'avancement du chantier. */
const TEMPLATE: { label: string; share: number }[] = [
  { label: "À la signature", share: 30 },
  { label: "Fin des fondations", share: 20 },
  { label: "Fin de l'élévation des murs", share: 20 },
  { label: "Dalle et toiture terminées", share: 20 },
  { label: "Remise des clés", share: 10 },
]

export function ScheduleEditor({
  projectId,
  lines,
  contract,
  currency,
  today,
}: {
  projectId: string
  lines: ScheduleLineInput[]
  contract: number | null
  currency: string
  today: string
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CalendarCog />
        {lines.length ? "Modifier" : "Définir l'échéancier"}
      </Button>
      {open && <ScheduleDialog projectId={projectId} initial={lines} contract={contract} currency={currency} today={today} onClose={() => setOpen(false)} />}
    </>
  )
}

function ScheduleDialog({
  projectId,
  initial,
  contract,
  currency,
  today,
  onClose,
}: {
  projectId: string
  initial: ScheduleLineInput[]
  contract: number | null
  currency: string
  today: string
  onClose: () => void
}) {
  const { run, pending } = useServerAction()
  const [lines, setLines] = React.useState<ScheduleLineInput[]>(initial.length ? initial : [{ label: "À la signature", dueDate: today, amount: null }])
  const setLine = (index: number, patch: Partial<ScheduleLineInput>) => setLines((list) => list.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  const total = lines.reduce((sum, l) => sum + (l.amount ?? 0), 0)
  const gap = contract != null ? contract - total : null

  function applyTemplate() {
    if (!contract) return toast.error("Indiquez d'abord le montant du contrat (offre acceptée).")
    let rest = contract
    setLines(
      TEMPLATE.map((t, i) => {
        const amount = i === TEMPLATE.length - 1 ? rest : Math.round((contract * t.share) / 100 / 1000) * 1000
        rest -= amount
        return { label: `${t.label} (${t.share} %)`, dueDate: format(addMonths(new Date(today), i * 2), "yyyy-MM-dd"), amount }
      }),
    )
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const filled = lines.filter((l) => l.label.trim() || l.amount)
    if (filled.some((l) => !l.label.trim() || !l.amount || !l.dueDate)) return toast.error("Chaque appel de fonds a besoin d'un intitulé, d'une date et d'un montant")
    run(() => saveSchedule(projectId, filled.map((l) => ({ label: l.label, dueDate: l.dueDate, amount: l.amount ?? 0 }))), { onSuccess: onClose })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>Appels de fonds</DialogTitle>
            <DialogDescription>
              Les versements reçus s&apos;imputent sur ces échéances dans l&apos;ordre des dates. Un appel en retard est signalé ici et dans l&apos;espace du client.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {lines.map((line, index) => (
              <div key={index} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_150px_170px_auto] sm:items-end sm:border-0 sm:p-0">
                <Field label={index === 0 ? "Intitulé" : ""} className={index > 0 ? "sm:[&>label]:hidden" : ""}>
                  <Input value={line.label} onChange={(e) => setLine(index, { label: e.target.value })} placeholder="Ex. : Fin des fondations" aria-label="Intitulé" />
                </Field>
                <Field label={index === 0 ? "Échéance" : ""} className={index > 0 ? "sm:[&>label]:hidden" : ""}>
                  <Input type="date" value={line.dueDate} onChange={(e) => setLine(index, { dueDate: e.target.value })} aria-label="Échéance" />
                </Field>
                <Field label={index === 0 ? "Montant" : ""} className={index > 0 ? "sm:[&>label]:hidden" : ""}>
                  <MoneyInput value={line.amount} onChange={(v) => setLine(index, { amount: v })} suffix={currency} aria-label="Montant" />
                </Field>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Retirer" className="justify-self-end" onClick={() => setLines((list) => list.filter((_, i) => i !== index))}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setLines((list) => [...list, { label: "", dueDate: list[list.length - 1]?.dueDate ?? today, amount: null }])}>
                <Plus />
                Ajouter un appel de fonds
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={applyTemplate}>
                <Wand2 />
                Répartition type (30 / 20 / 20 / 20 / 10)
              </Button>
            </div>
          </div>

          <div className="rounded-xl bg-muted/50 px-4 py-3 text-sm">
            <p className="flex justify-between gap-3">
              <span className="text-muted-foreground">Total des appels de fonds</span>
              <strong className="tabular">{formatMoney(total, currency)}</strong>
            </p>
            {contract != null && (
              <p className="mt-1 flex justify-between gap-3">
                <span className="text-muted-foreground">Montant du contrat</span>
                <span className="tabular">{formatMoney(contract, currency)}</span>
              </p>
            )}
            {gap != null && gap !== 0 && (
              <p className="mt-1.5 font-medium text-status-sold-strong">
                {gap > 0 ? `Il reste ${formatMoney(gap, currency)} à répartir.` : `L'échéancier dépasse le contrat de ${formatMoney(-gap, currency)}.`}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Enregistrer l&apos;échéancier
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────
// Versements du client
// ─────────────────────────────────────────────────────────────

export type ConstructionPaymentRow = {
  id: string
  amount: number
  paidAt: string
  method: PaymentMethod
  reference: string | null
  note: string | null
  receiptNumber: string
  recordedBy: string | null
}

type PaymentContext = { projectId: string; clientName: string; remaining: number | null; nextDue: number | null; currency: string; today: string; smsDefault: boolean }

/** Bouton « Enregistrer un versement » (désactivé tant que l'offre n'est pas acceptée). */
export function RecordPaymentButton({ context, disabledReason, size = "default" }: { context: PaymentContext; disabledReason?: string; size?: "default" | "sm" }) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button size={size} disabled={!!disabledReason} title={disabledReason} onClick={() => setOpen(true)}>
        <ReceiptIcon />
        Enregistrer un versement
      </Button>
      {open && <PaymentDialog context={context} onClose={() => setOpen(false)} />}
    </>
  )
}

export function ConstructionPayments({ payments, context, canEdit }: { payments: ConstructionPaymentRow[]; context: PaymentContext; canEdit: boolean }) {
  const { run, pending } = useServerAction()
  const [editing, setEditing] = React.useState<ConstructionPaymentRow | null>(null)
  const { currency } = context

  if (payments.length === 0) return <p className="px-5 py-10 text-center text-sm text-muted-foreground">Aucun versement enregistré pour le moment.</p>

  return (
    <>
      <ul className="divide-y">
        {payments.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <MethodIcon method={p.method} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold tabular">{formatMoney(p.amount, currency)}</span>
                <span className="text-xs text-muted-foreground">{PAYMENT_METHOD[p.method]}</span>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {formatDate(p.paidAt)} · {p.receiptNumber}
                {p.reference ? ` · réf. ${p.reference}` : ""}
                {p.recordedBy ? ` · saisi par ${p.recordedBy}` : ""}
              </p>
              {p.note && <p className="mt-0.5 truncate text-xs text-muted-foreground italic">{p.note}</p>}
            </div>
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
              <Link href={`/admin/construction/versements/${p.id}/recu`}>
                <ReceiptText />
                Reçu
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/admin/construction/versements/${p.id}/recu`}>
                    <ReceiptText />
                    Voir / imprimer le reçu
                  </Link>
                </DropdownMenuItem>
                {canEdit && (
                  <>
                    <DropdownMenuItem onSelect={() => setEditing(p)}>
                      <Pencil />
                      Modifier
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={pending}
                      onSelect={() =>
                        confirm(`Supprimer le versement ${p.receiptNumber} (${formatMoney(p.amount, currency)}) ? Cette action est irréversible.`) &&
                        run(() => deleteConstructionPayment(p.id))
                      }
                    >
                      <Trash2 />
                      Supprimer
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>
      {editing && <PaymentDialog context={context} payment={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function PaymentDialog({ context, payment, onClose }: { context: PaymentContext; payment?: ConstructionPaymentRow; onClose: () => void }) {
  const router = useRouter()
  const { run, pending } = useServerAction()
  const { currency, remaining, nextDue } = context
  const [amount, setAmount] = React.useState<number | null>(payment ? payment.amount : (nextDue ?? remaining))
  const [paidAt, setPaidAt] = React.useState(payment?.paidAt ?? context.today)
  const [method, setMethod] = React.useState<PaymentMethod>(payment?.method ?? "BANK_TRANSFER")
  const [reference, setReference] = React.useState(payment?.reference ?? "")
  const [note, setNote] = React.useState(payment?.note ?? "")
  const [sms, setSms] = React.useState(context.smsDefault)
  const tooMuch = !payment && remaining != null && amount != null && amount > remaining

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!amount || amount <= 0) return toast.error("Indiquez un montant")
    const values = { amount, paidAt, method, reference, note }
    if (payment) {
      run(() => updateConstructionPayment(payment.id, values), { onSuccess: onClose })
      return
    }
    run(() => recordConstructionPayment(context.projectId, { ...values, sendSms: sms }), {
      success: () => "",
      onSuccess: (data) => {
        onClose()
        toast.success(`Versement enregistré — reçu ${data.receiptNumber}`, {
          action: { label: "Voir le reçu", onClick: () => router.push(`/admin/construction/versements/${data.paymentId}/recu`) },
        })
      },
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{payment ? `Modifier le versement ${payment.receiptNumber}` : "Enregistrer un versement"}</DialogTitle>
            <DialogDescription>
              {context.clientName}
              {remaining != null ? ` · reste à payer ${formatMoney(remaining, currency)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Montant reçu"
              className="sm:col-span-2"
              error={tooMuch ? `Dépasse le reste à payer (${formatMoney(remaining, currency)})` : undefined}
              hint={nextDue && !payment ? `Prochain appel de fonds : ${formatMoney(nextDue, currency)}` : undefined}
            >
              <MoneyInput value={amount} onChange={setAmount} suffix={currency} className="h-11 text-lg font-semibold" autoFocus />
            </Field>
            <Field label="Date du versement">
              <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} required />
            </Field>
            <Field label="Mode de paiement">
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {PAYMENT_METHOD[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Référence" className="sm:col-span-2" hint="N° de virement, de chèque, de transaction…">
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </Field>
            <Field label="Note" className="sm:col-span-2">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </Field>
          </div>
          {!payment && (
            <Label className="flex items-start gap-3 rounded-lg border p-3 font-normal">
              <Checkbox checked={sms} onCheckedChange={(v) => setSms(!!v)} className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium">Confirmer par SMS au client</span>
                <span className="block text-xs text-muted-foreground">Montant reçu, numéro de reçu et reste à payer.</span>
              </span>
            </Label>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending || tooMuch}>
              {pending ? <Loader2 className="animate-spin" /> : <ReceiptIcon />}
              {payment ? "Enregistrer" : "Valider le versement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
