"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BadgeDollarSign, Bookmark, BookmarkX, ExternalLink, Pencil, Trash2 } from "lucide-react"
import type { LotStatus } from "@/generated/prisma/enums"
import { useServerAction } from "@/hooks/use-server-action"
import { deleteLot, setLotReservation } from "@/app/admin/(app)/terrains/actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { FormField } from "@/components/admin/settings/form-bits"

/** Dialogue « Poser une option » (terrain réservé avec note) */
export function ReserveDialog({
  lotId,
  lotNumber,
  open,
  onOpenChange,
  defaultNote = "",
}: {
  lotId: string
  lotNumber: string
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultNote?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <ReserveForm lotId={lotId} lotNumber={lotNumber} defaultNote={defaultNote} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

/** Contenu monté à chaque ouverture : l'état repart de zéro. */
function ReserveForm({ lotId, lotNumber, defaultNote, onDone }: { lotId: string; lotNumber: string; defaultNote: string; onDone: () => void }) {
  const { run, pending } = useServerAction()
  const [note, setNote] = React.useState(defaultNote)
  return (
    <>
      <DialogHeader>
        <DialogTitle>Poser une option sur le terrain n° {lotNumber}</DialogTitle>
        <DialogDescription>Le terrain apparaîtra comme « Réservé » sur le site et ne pourra plus être demandé.</DialogDescription>
      </DialogHeader>
      <FormField label="Note (optionnelle)" htmlFor="reserve-note" hint="Pour qui, jusqu'à quand, en attente de quoi…">
        <Textarea
          id="reserve-note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Option pour M. Ndiaye jusqu'au 30/11, en attente de l'acompte."
        />
      </FormField>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button disabled={pending} onClick={() => run(() => setLotReservation(lotId, true, note), { onSuccess: onDone })}>
          {pending && <Spinner />}
          Poser l&apos;option
        </Button>
      </DialogFooter>
    </>
  )
}

export function LotDetailActions({
  lot,
  canEdit,
  hasSale,
  hasHistory,
}: {
  lot: { id: string; number: string; status: LotStatus; reservedNote: string | null }
  canEdit: boolean
  hasSale: boolean
  hasHistory: boolean
}) {
  const router = useRouter()
  const { run, pending } = useServerAction()
  const [reserveOpen, setReserveOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)

  return (
    <>
      <Button variant="outline" size="sm" className="h-9" asChild>
        <Link href={`/terrains/${encodeURIComponent(lot.number)}`} target="_blank">
          <ExternalLink />
          Sur le site
        </Link>
      </Button>
      {canEdit && (
        <>
          {!hasSale && lot.status === "AVAILABLE" && (
            <Button variant="outline" size="sm" className="h-9" onClick={() => setReserveOpen(true)}>
              <Bookmark />
              Poser une option
            </Button>
          )}
          {!hasSale && lot.status === "RESERVED" && (
            <Button variant="outline" size="sm" className="h-9" disabled={pending} onClick={() => run(() => setLotReservation(lot.id, false))}>
              <BookmarkX />
              Lever l&apos;option
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-9" asChild>
            <Link href={`/admin/terrains/${lot.id}/modifier`}>
              <Pencil />
              Modifier
            </Link>
          </Button>
          {!hasSale && lot.status !== "UNAVAILABLE" && (
            <Button size="sm" className="h-9" asChild>
              <Link href={`/admin/ventes/nouvelle?lot=${lot.id}`}>
                <BadgeDollarSign />
                Attribuer
              </Link>
            </Button>
          )}
          {!hasHistory && (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
              aria-label="Supprimer le terrain"
            >
              <Trash2 />
            </Button>
          )}
          <ReserveDialog lotId={lot.id} lotNumber={lot.number} open={reserveOpen} onOpenChange={setReserveOpen} />
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer le terrain n° {lot.number} ?</AlertDialogTitle>
                <AlertDialogDescription>Le terrain disparaîtra du plan, de la liste et du site public. Cette action est définitive.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={(e) => {
                    e.preventDefault()
                    run(() => deleteLot(lot.id), { onSuccess: () => router.push("/admin/terrains"), refresh: false })
                  }}
                >
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </>
  )
}
