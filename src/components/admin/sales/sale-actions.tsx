"use client"

import * as React from "react"
import Link from "next/link"
import { Ban, BellRing, CalendarCog, FileText, Loader2, MessageCircle, MoreHorizontal, Phone, Plus } from "lucide-react"
import { cancelSale, remindSale, updateSchedule } from "@/app/admin/(app)/ventes/actions"
import { useServerAction } from "@/hooks/use-server-action"
import { formatMoney } from "@/lib/format"
import { whatsappLink } from "@/lib/phone"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { PaymentDialog, type PaymentSaleInfo } from "@/components/admin/payments/payment-dialog"
import { PlanFields, planPayload, SchedulePreview, usePlanSchedule, type PlanState } from "@/components/admin/sales/plan-fields"

export type SaleActionsProps = {
  sale: PaymentSaleInfo & {
    status: "ACTIVE" | "COMPLETED" | "CANCELLED"
    phone: string
    paid: number
    overdue: number
    plan: PlanState
  }
  currency: string
  today: string
  smsDefault: boolean
  canEdit: boolean
}

/** Boutons d'action de l'en-tête d'une vente */
export function SaleActions({ sale, currency, today, smsDefault, canEdit }: SaleActionsProps) {
  const { run, pending } = useServerAction()
  const [paymentOpen, setPaymentOpen] = React.useState(false)
  const [scheduleOpen, setScheduleOpen] = React.useState(false)
  const [cancelOpen, setCancelOpen] = React.useState(false)
  const active = sale.status === "ACTIVE"
  const message =
    sale.overdue > 0
      ? `Bonjour ${sale.buyerName.split(" ")[0]}, nous revenons vers vous au sujet du terrain n°${sale.lotNumber} : un montant de ${formatMoney(sale.overdue, currency)} est en attente de règlement. Merci de nous recontacter.`
      : `Bonjour ${sale.buyerName.split(" ")[0]}, `

  return (
    <>
      {canEdit && active && (
        <Button onClick={() => setPaymentOpen(true)}>
          <Plus />
          Enregistrer un versement
        </Button>
      )}
      {canEdit && active && (
        <Button variant="outline" onClick={() => run(() => remindSale(sale.id))} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <BellRing />}
          <span className="hidden sm:inline">Relancer par SMS</span>
          <span className="sm:hidden">Relancer</span>
        </Button>
      )}
      <Button variant="outline" size="icon" asChild aria-label="Écrire sur WhatsApp">
        <a href={whatsappLink(sale.phone, message)} target="_blank" rel="noreferrer">
          <MessageCircle />
        </a>
      </Button>
      <Button variant="outline" size="icon" asChild aria-label="Appeler">
        <a href={`tel:${sale.phone}`}>
          <Phone />
        </a>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Plus d'actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem asChild>
            <Link href={`/admin/ventes/${sale.id}/releve`}>
              <FileText />
              Relevé de compte
            </Link>
          </DropdownMenuItem>
          {canEdit && sale.status !== "CANCELLED" && (
            <>
              <DropdownMenuItem onSelect={() => setScheduleOpen(true)}>
                <CalendarCog />
                Modifier l&apos;échéancier
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setCancelOpen(true)}>
                <Ban />
                Annuler la vente
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {canEdit && active && (
        <PaymentDialog sale={sale} currency={currency} today={today} smsDefault={smsDefault} open={paymentOpen} onOpenChange={setPaymentOpen} />
      )}
      {canEdit && (
        <ScheduleDialog saleId={sale.id} initial={sale.plan} paid={sale.paid} currency={currency} open={scheduleOpen} onOpenChange={setScheduleOpen} />
      )}
      {canEdit && <CancelSaleDialog sale={sale} currency={currency} open={cancelOpen} onOpenChange={setCancelOpen} />}
    </>
  )
}

function ScheduleDialog({
  open,
  onOpenChange,
  ...props
}: {
  saleId: string
  initial: PlanState
  paid: number
  currency: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
        <ScheduleForm {...props} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function ScheduleForm({ saleId, initial, paid, currency, onDone }: { saleId: string; initial: PlanState; paid: number; currency: string; onDone: () => void }) {
  const { run, pending } = useServerAction()
  const [plan, setPlan] = React.useState(initial)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const lines = usePlanSchedule(plan)
  return (
    <>
      <DialogHeader>
        <DialogTitle>Modifier l&apos;échéancier</DialogTitle>
        <DialogDescription>
          L&apos;échéancier est recalculé. Les versements déjà enregistrés ({formatMoney(paid, currency)}) restent acquis et sont réimputés dans l&apos;ordre
          des nouvelles échéances.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
        <PlanFields value={plan} onChange={setPlan} currency={currency} errors={errors} />
        <div className="rounded-xl border bg-muted/20 p-4">
          <p className="mb-3 text-sm font-semibold">Nouvel échéancier</p>
          <SchedulePreview lines={lines} currency={currency} plan={plan} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button
          disabled={pending || lines.length === 0}
          onClick={() =>
            run(() => updateSchedule(saleId, planPayload(plan)), {
              onSuccess: onDone,
              onError: (_, fieldErrors) => setErrors(Object.fromEntries(Object.entries(fieldErrors ?? {}).map(([k, v]) => [`plan.${k}`, v]))),
            })
          }
        >
          {pending && <Loader2 className="animate-spin" />}
          Appliquer le nouvel échéancier
        </Button>
      </DialogFooter>
    </>
  )
}

function CancelSaleDialog({
  sale,
  currency,
  open,
  onOpenChange,
}: {
  sale: SaleActionsProps["sale"]
  currency: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { run, pending } = useServerAction()
  const [reason, setReason] = React.useState("")
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Annuler la vente {sale.reference} ?</AlertDialogTitle>
          <AlertDialogDescription>
            Le terrain n°{sale.lotNumber} redeviendra disponible à la vente. Les versements déjà reçus ({formatMoney(sale.paid, currency)}) restent enregistrés
            dans l&apos;historique pour le suivi d&apos;un éventuel remboursement.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motif (désistement, défaut de paiement…)" rows={3} />
        <AlertDialogFooter>
          <AlertDialogCancel>Retour</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={pending || reason.trim().length < 3}
            onClick={() => run(() => cancelSale(sale.id, reason), { onSuccess: () => onOpenChange(false) })}
          >
            {pending && <Loader2 className="animate-spin" />}
            Confirmer l&apos;annulation
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
