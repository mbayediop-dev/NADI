"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2, MoreHorizontal, Pencil, ReceiptText, Trash2 } from "lucide-react"
import { deletePayment } from "@/app/admin/(app)/ventes/actions"
import { useServerAction } from "@/hooks/use-server-action"
import { formatDate, formatMoney } from "@/lib/format"
import { PAYMENT_METHOD } from "@/lib/labels"
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { PaymentDialog, type EditablePayment } from "@/components/admin/payments/payment-dialog"
import { MethodIcon } from "@/components/admin/payments/method-icon"

export type SalePaymentRow = EditablePayment & { recordedBy: string | null }

/** Historique des versements d'une vente, avec modification / suppression. */
export function SalePayments({ payments, currency, today, canEdit }: { payments: SalePaymentRow[]; currency: string; today: string; canEdit: boolean }) {
  const [editing, setEditing] = React.useState<SalePaymentRow | null>(null)
  const [deleting, setDeleting] = React.useState<SalePaymentRow | null>(null)
  const { run, pending } = useServerAction()

  if (payments.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-muted-foreground">Aucun versement enregistré pour le moment.</p>
  }

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
              <Link href={`/admin/versements/${p.id}/recu`}>
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
                  <Link href={`/admin/versements/${p.id}/recu`}>
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
                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(p)}>
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

      {editing && (
        <PaymentDialog
          payment={editing}
          currency={currency}
          today={today}
          smsDefault={false}
          open={!!editing}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce versement ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && `${formatMoney(deleting.amount, currency)} du ${formatDate(deleting.paidAt)} (reçu ${deleting.receiptNumber}). `}
              La situation de la vente sera recalculée. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => deleting && run(() => deletePayment(deleting.id), { onSuccess: () => setDeleting(null) })}
            >
              {pending && <Loader2 className="animate-spin" />}
              Supprimer
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

