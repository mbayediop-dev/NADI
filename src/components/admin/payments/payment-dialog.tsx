"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Receipt as ReceiptIcon } from "lucide-react"
import type { PaymentMethod } from "@/generated/prisma/enums"
import { listActiveSalesForPayment, recordPayment, updatePayment } from "@/app/admin/(app)/ventes/actions"
import { useServerAction } from "@/hooks/use-server-action"
import { formatMoney } from "@/lib/format"
import { PAYMENT_METHOD } from "@/lib/labels"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { MoneyInput } from "@/components/shared/money-input"
import { Combobox } from "@/components/admin/sales/combobox"
import { Field } from "@/components/admin/sales/plan-fields"

const METHODS = Object.keys(PAYMENT_METHOD) as PaymentMethod[]

export type PaymentSaleInfo = { id: string; reference: string; lotNumber: string; buyerName: string; remaining: number; nextDue: number | null }
export type EditablePayment = {
  id: string
  amount: number
  paidAt: string
  method: PaymentMethod
  reference: string | null
  note: string | null
  receiptNumber: string
}

/**
 * Saisie (ou modification) d'un versement.
 * - `sale` fourni : versement sur cette vente
 * - sans `sale` : l'utilisateur choisit d'abord une vente en cours
 * - `payment` fourni : mode modification
 */
export function PaymentDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  ...props
}: {
  sale?: PaymentSaleInfo
  payment?: EditablePayment
  currency: string
  today: string
  smsDefault: boolean
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [innerOpen, setInnerOpen] = React.useState(false)
  const open = controlledOpen ?? innerOpen
  const setOpen = onOpenChange ?? setInnerOpen
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg">
        {/* Le formulaire est monté à chaque ouverture : son état repart des valeurs initiales */}
        <PaymentForm {...props} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function PaymentForm({
  sale,
  payment,
  currency,
  today,
  smsDefault,
  onDone,
}: {
  sale?: PaymentSaleInfo
  payment?: EditablePayment
  currency: string
  today: string
  smsDefault: boolean
  onDone: () => void
}) {
  const router = useRouter()
  const { run, pending } = useServerAction()

  const [sales, setSales] = React.useState<PaymentSaleInfo[] | null>(null)
  const [pickedId, setPickedId] = React.useState<string | undefined>(sale?.id)
  const current = sale ?? sales?.find((s) => s.id === pickedId)

  const [amount, setAmount] = React.useState<number | null>(payment ? payment.amount : sale ? (sale.nextDue ?? sale.remaining) : null)
  const [paidAt, setPaidAt] = React.useState(payment?.paidAt ?? today)
  const [method, setMethod] = React.useState<PaymentMethod>(payment?.method ?? "WAVE")
  const [reference, setReference] = React.useState(payment?.reference ?? "")
  const [note, setNote] = React.useState(payment?.note ?? "")
  const [sms, setSms] = React.useState(smsDefault)

  // Sans vente imposée : chargement des ventes en cours
  React.useEffect(() => {
    if (sale || payment) return
    let cancelled = false
    listActiveSalesForPayment().then((res) => !cancelled && setSales(res.ok ? res.data : []))
    return () => {
      cancelled = true
    }
  }, [sale, payment])

  function pick(id: string) {
    setPickedId(id)
    const s = sales?.find((x) => x.id === id)
    if (s) setAmount(s.nextDue ?? s.remaining)
  }

  const maxAmount = payment ? undefined : current?.remaining
  const tooMuch = maxAmount != null && amount != null && amount > maxAmount

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!amount || amount <= 0) return toast.error("Indiquez un montant")
    const values = { amount, paidAt, method, reference, note }
    if (payment) {
      run(() => updatePayment(payment.id, values), { onSuccess: onDone })
      return
    }
    if (!current) return toast.error("Choisissez une vente")
    run(() => recordPayment(current.id, { ...values, sendSms: sms }), {
      success: () => "",
      onSuccess: (data) => {
        onDone()
        toast.success(data.completed ? `Versement enregistré — le terrain est entièrement payé 🎉` : `Versement enregistré — reçu ${data.receiptNumber}`, {
          action: { label: "Voir le reçu", onClick: () => router.push(`/admin/versements/${data.paymentId}/recu`) },
        })
      },
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{payment ? `Modifier le versement ${payment.receiptNumber}` : "Enregistrer un versement"}</DialogTitle>
        <DialogDescription>
          {current
            ? `${current.buyerName} · Terrain n°${current.lotNumber} · reste à payer ${formatMoney(current.remaining, currency)}`
            : "Choisissez la vente concernée, puis saisissez le montant reçu."}
        </DialogDescription>
      </DialogHeader>

      {!sale && !payment && (
        <Field label="Vente">
          {sales === null ? (
            <Skeleton className="h-11 w-full" />
          ) : (
            <Combobox
              value={pickedId}
              onChange={pick}
              placeholder="Acheteur, n° de terrain ou référence…"
              searchPlaceholder="Rechercher…"
              empty="Aucune vente en cours."
              options={sales.map((s) => ({
                value: s.id,
                label: `${s.buyerName} — terrain ${s.lotNumber}`,
                keywords: [s.reference, s.lotNumber],
                render: (
                  <div className="flex w-full items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.buyerName}</p>
                      <p className="text-xs text-muted-foreground">
                        Terrain n°{s.lotNumber} · {s.reference}
                      </p>
                    </div>
                    <span className="text-xs font-semibold whitespace-nowrap tabular">{formatMoney(s.remaining, currency)}</span>
                  </div>
                ),
              }))}
            />
          )}
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Montant reçu"
          className="sm:col-span-2"
          error={tooMuch ? `Dépasse le reste à payer (${formatMoney(maxAmount, currency)})` : undefined}
          hint={current?.nextDue && !payment ? `Prochaine échéance : ${formatMoney(current.nextDue, currency)}` : undefined}
        >
          <MoneyInput value={amount} onChange={setAmount} suffix={currency} className="h-11 text-lg font-semibold" autoFocus />
        </Field>
        {current && !payment && current.nextDue != null && current.nextDue !== current.remaining && (
          <div className="-mt-2 flex flex-wrap gap-2 sm:col-span-2">
            <Button type="button" size="xs" variant="outline" onClick={() => setAmount(current.nextDue)}>
              Échéance ({formatMoney(current.nextDue, currency)})
            </Button>
            <Button type="button" size="xs" variant="outline" onClick={() => setAmount(current.remaining)}>
              Solde total ({formatMoney(current.remaining, currency)})
            </Button>
          </div>
        )}
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
        <Field label="Référence" className="sm:col-span-2" hint="N° de transaction Wave / Orange Money, n° de chèque…">
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
            <span className="block text-sm font-medium">Confirmer par SMS à l&apos;acheteur</span>
            <span className="block text-xs text-muted-foreground">Montant reçu, numéro de reçu et reste à payer.</span>
          </span>
        </Label>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending || tooMuch || (!sale && !payment && !current)}>
          {pending ? <Loader2 className="animate-spin" /> : <ReceiptIcon />}
          {payment ? "Enregistrer" : "Valider le versement"}
        </Button>
      </DialogFooter>
    </form>
  )
}
