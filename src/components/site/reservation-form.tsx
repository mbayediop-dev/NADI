"use client"

import * as React from "react"
import { ArrowRight, CheckCircle2, Loader2, Mail, MessageCircle, Phone, Send } from "lucide-react"
import { createReservationRequest } from "@/app/(site)/actions"
import { whatsappLink } from "@/lib/phone"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PhoneInput } from "@/components/shared/phone-input"
import { WhatsAppIcon } from "@/components/site/whatsapp-fab"

const CONTACTS = [
  { value: "CALL", label: "Appel", icon: Phone },
  { value: "WHATSAPP", label: "WhatsApp", icon: MessageCircle },
  { value: "EMAIL", label: "E-mail", icon: Mail },
] as const

type Contact = (typeof CONTACTS)[number]["value"]

/** Formulaire de réservation d'un terrain (ou de demande de rappel si aucun terrain n'est fourni). */
export function ReservationForm({
  lot,
  companyName,
  companyWhatsapp,
  onSuccess,
  submitLabel,
  className,
  variant = "full",
  lotOptions,
}: {
  lot?: { id: string; number: string } | null
  companyName: string
  companyWhatsapp: string
  onSuccess?: () => void
  submitLabel?: string
  className?: string
  /** « compact » : nom, téléphone, terrain et message uniquement */
  variant?: "full" | "compact"
  /** Terrains proposés dans la liste « Terrain qui vous intéresse » */
  lotOptions?: { id: string; number: string; label: string }[]
}) {
  const [pending, startTransition] = React.useTransition()
  const [phone, setPhone] = React.useState("")
  const [contact, setContact] = React.useState<Contact>("CALL")
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})
  const [done, setDone] = React.useState<{ name: string; lot: { id: string; number: string } | null } | null>(null)
  const [chosenLotId, setChosenLotId] = React.useState("none")
  const id = React.useId()
  const compact = variant === "compact"
  const chosenLot = lot ?? lotOptions?.find((o) => o.id === chosenLotId) ?? null

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const fullName = String(form.get("fullName") ?? "")
    setError(null)
    setFieldErrors({})
    startTransition(async () => {
      try {
        const result = await createReservationRequest({
          lotId: chosenLot?.id ?? null,
          fullName,
          phone,
          email: String(form.get("email") ?? "") || null,
          preferredContact: contact,
          message: String(form.get("message") ?? "") || null,
          website: String(form.get("website") ?? "") || null,
        })
        if (!result.ok) {
          setError(result.error)
          setFieldErrors(result.fieldErrors ?? {})
          return
        }
        setDone({ name: fullName.split(" ")[0] ?? "", lot: chosenLot ? { id: chosenLot.id, number: chosenLot.number } : null })
        onSuccess?.()
      } catch {
        setError("Impossible d'envoyer votre demande. Vérifiez votre connexion et réessayez.")
      }
    })
  }

  if (done) {
    return (
      <div className={cn("flex flex-col items-center py-6 text-center", className)} role="status">
        <span className="relative grid size-16 place-items-center rounded-full bg-status-available/15 text-status-available-strong">
          <span className="absolute inset-0 animate-pulse-ring rounded-full bg-status-available/25" aria-hidden />
          <CheckCircle2 className="relative size-8" />
        </span>
        <h3 className="mt-5 font-display text-2xl">Merci{done.name ? ` ${done.name}` : ""} !</h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {done.lot
            ? `Votre demande pour le terrain n° ${done.lot.number} est bien enregistrée. Un conseiller ${companyName} vous contacte très rapidement pour finaliser la réservation.`
            : `Votre demande est bien enregistrée. Un conseiller ${companyName} vous rappelle très rapidement.`}
        </p>
        {companyWhatsapp && (
          <Button asChild className="mt-6 h-11 rounded-md bg-[#25D366] px-5 text-white hover:bg-[#1fb757]">
            <a
              href={whatsappLink(
                companyWhatsapp,
                done.lot ? `Bonjour ${companyName}, je viens de demander le terrain n° ${done.lot.number} sur votre site.` : `Bonjour ${companyName}, je viens de vous laisser mes coordonnées sur votre site.`,
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WhatsAppIcon className="size-5" />
              Nous écrire sur WhatsApp
            </a>
          </Button>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className={cn("space-y-4", className)} noValidate>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-name`}>Nom complet</Label>
        <Input id={`${id}-name`} name="fullName" required autoComplete="name" placeholder={compact ? "Votre nom" : "Prénom et nom"} className="h-11" aria-invalid={!!fieldErrors.fullName} />
        {fieldErrors.fullName && <p className="text-xs text-destructive">{fieldErrors.fullName}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-phone`}>Téléphone</Label>
        <PhoneInput id={`${id}-phone`} value={phone} onChange={setPhone} className="h-11" />
        {fieldErrors.phone && <p className="text-xs text-destructive">{fieldErrors.phone}</p>}
      </div>
      {lotOptions && lotOptions.length > 0 && !lot && (
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-lot`}>
            Terrain qui vous intéresse <span className="font-normal text-muted-foreground">(facultatif)</span>
          </Label>
          <Select value={chosenLotId} onValueChange={setChosenLotId}>
            <SelectTrigger id={`${id}-lot`} className="h-11 w-full">
              <SelectValue placeholder="Sélectionner un terrain" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="none">Je ne sais pas encore</SelectItem>
              {lotOptions.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {!compact && (
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Comment préférez-vous être contacté ?</legend>
        <div className="grid grid-cols-3 gap-2 pt-1">
          {CONTACTS.map((c) => (
            <label
              key={c.value}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1 rounded-md border px-2 py-2.5 text-xs font-semibold transition-colors",
                contact === c.value ? "border-primary bg-primary/[0.06] text-primary ring-2 ring-primary/15" : "hover:bg-muted",
              )}
            >
              <input type="radio" name="contact" value={c.value} checked={contact === c.value} onChange={() => setContact(c.value)} className="sr-only" />
              <c.icon className="size-4" />
              {c.label}
            </label>
          ))}
        </div>
      </fieldset>
      )}
      {!compact && (
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-email`}>
          E-mail <span className="font-normal text-muted-foreground">{contact === "EMAIL" ? "" : "(facultatif)"}</span>
        </Label>
        <Input id={`${id}-email`} name="email" type="email" autoComplete="email" placeholder="vous@exemple.com" className="h-11" aria-invalid={!!fieldErrors.email} />
        {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
      </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-message`}>
          Message <span className="font-normal text-muted-foreground">(facultatif)</span>
        </Label>
        <Textarea
          id={`${id}-message`}
          name="message"
          rows={compact ? 3 : 3}
          placeholder={compact ? "Votre message" : lot ? "Une question sur ce terrain, vos disponibilités pour une visite…" : "Votre projet, votre budget, vos disponibilités…"}
        />
      </div>
      {/* Champ piège pour les robots */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="h-12 w-full rounded-md bg-pine-deep text-base font-semibold text-white hover:bg-pine-deep/90">
        {pending ? <Loader2 className="animate-spin" /> : compact ? null : <Send />}
        {submitLabel ?? (lot ? `Réserver le terrain n° ${lot.number}` : "Être rappelé")}
        {compact && !pending && <ArrowRight />}
      </Button>
      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        Sans engagement. Vos coordonnées sont utilisées uniquement par {companyName} pour vous recontacter.
      </p>
    </form>
  )
}
