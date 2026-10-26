"use client"

import * as React from "react"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ReservationForm } from "@/components/site/reservation-form"

/** Bouton « Nous contacter » : ouvre le formulaire de rappel dans une fenêtre. */
export function ContactDialog({
  companyName,
  companyWhatsapp,
  lotOptions,
}: {
  companyName: string
  companyWhatsapp: string
  lotOptions: { id: string; number: string; label: string }[]
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-12 rounded-md bg-gold px-6 text-[0.95rem] font-semibold text-gold-foreground shadow-[0_14px_30px_-14px_oklch(0.797_0.115_79/0.9)] hover:bg-gold/90">
          Nous contacter
          <ArrowRight />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto p-6 sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-2xl font-semibold">Demander à être recontacté</DialogTitle>
          <DialogDescription>Laissez vos coordonnées : un conseiller {companyName} vous rappelle rapidement.</DialogDescription>
        </DialogHeader>
        <ReservationForm variant="compact" lotOptions={lotOptions} companyName={companyName} companyWhatsapp={companyWhatsapp} submitLabel="Être recontacté" />
      </DialogContent>
    </Dialog>
  )
}
