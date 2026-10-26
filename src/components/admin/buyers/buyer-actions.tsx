"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, MessageCircle, MessageSquareText, MoreHorizontal, Pencil, Phone, Plus, Trash2 } from "lucide-react"
import { deleteBuyer, sendBuyerSms, setPortalAccess } from "@/app/admin/(app)/acheteurs/actions"
import { useServerAction } from "@/hooks/use-server-action"
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
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { BuyerFormDialog, type BuyerFormValues } from "@/components/admin/buyers/buyer-form-dialog"

export function BuyerActions({
  buyer,
  canEdit,
  hasSales,
  companyName,
}: {
  buyer: { id: string; firstName: string; phone: string; form: BuyerFormValues }
  canEdit: boolean
  hasSales: boolean
  companyName: string
}) {
  const router = useRouter()
  const { run, pending } = useServerAction()
  const [editOpen, setEditOpen] = React.useState(false)
  const [smsOpen, setSmsOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [message, setMessage] = React.useState("")

  return (
    <>
      {canEdit && (
        <Button asChild>
          <Link href={`/admin/ventes/nouvelle?buyer=${buyer.id}`}>
            <Plus />
            Nouvelle vente
          </Link>
        </Button>
      )}
      <Button variant="outline" size="icon" asChild aria-label="Appeler">
        <a href={`tel:${buyer.phone}`}>
          <Phone />
        </a>
      </Button>
      <Button variant="outline" size="icon" asChild aria-label="WhatsApp">
        <a href={whatsappLink(buyer.phone, `Bonjour ${buyer.firstName}, `)} target="_blank" rel="noreferrer">
          <MessageCircle />
        </a>
      </Button>
      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Plus d'actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              <Pencil />
              Modifier la fiche
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setSmsOpen(true)}>
              <MessageSquareText />
              Envoyer un SMS
            </DropdownMenuItem>
            {!hasSales && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                  <Trash2 />
                  Supprimer
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {canEdit && <BuyerFormDialog buyerId={buyer.id} initial={buyer.form} open={editOpen} onOpenChange={setEditOpen} />}

      <Dialog open={smsOpen} onOpenChange={setSmsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Envoyer un SMS</DialogTitle>
            <DialogDescription>Le message est envoyé au numéro principal de l&apos;acheteur.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            maxLength={640}
            placeholder={`Bonjour ${buyer.firstName}, ${companyName} vous informe…`}
            autoFocus
          />
          <p className="text-right text-xs text-muted-foreground tabular">
            {message.length} / 640 · {Math.max(1, Math.ceil(message.length / 160))} SMS
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSmsOpen(false)}>
              Annuler
            </Button>
            <Button
              disabled={pending || message.trim().length < 2}
              onClick={() =>
                run(() => sendBuyerSms(buyer.id, message), {
                  onSuccess: () => {
                    setSmsOpen(false)
                    setMessage("")
                  },
                })
              }
            >
              {pending && <Loader2 className="animate-spin" />}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet acheteur ?</AlertDialogTitle>
            <AlertDialogDescription>La fiche sera définitivement supprimée. Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <Button variant="destructive" disabled={pending} onClick={() => run(() => deleteBuyer(buyer.id), { onSuccess: () => router.push("/admin/acheteurs"), refresh: false })}>
              Supprimer
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/** Interrupteur d'accès à l'espace client */
export function PortalToggle({ buyerId, enabled, canEdit }: { buyerId: string; enabled: boolean; canEdit: boolean }) {
  const { run, pending } = useServerAction()
  return (
    <Switch
      checked={enabled}
      disabled={!canEdit || pending}
      onCheckedChange={(value) => run(() => setPortalAccess(buyerId, value))}
      aria-label="Accès à l'espace client"
    />
  )
}
