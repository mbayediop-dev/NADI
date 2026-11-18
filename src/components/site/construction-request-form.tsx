"use client"

import * as React from "react"
import { Building2, CheckCircle2, Loader2, MapPinned, Search, Send } from "lucide-react"
import type { LandOrigin } from "@/generated/prisma/enums"
import { createConstructionRequest } from "@/app/(site)/actions"
import { whatsappLink } from "@/lib/phone"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { MoneyInput } from "@/components/shared/money-input"
import { PhoneInput } from "@/components/shared/phone-input"
import { WhatsAppIcon } from "@/components/site/whatsapp-fab"

const SITUATIONS: { value: LandOrigin; icon: typeof Building2; label: string }[] = [
  { value: "COMPANY_LOT", icon: Building2, label: "J'ai un terrain dans votre lotissement" },
  { value: "OWN_LAND", icon: MapPinned, label: "J'ai déjà un terrain ailleurs" },
  { value: "NO_LAND", icon: Search, label: "Je n'ai pas encore de terrain" },
]

const CUSTOM = "custom"

/** Demande d'étude de construction (site public) : situation du terrain, maison souhaitée, coordonnées. */
export function ConstructionRequestForm({
  models,
  companyName,
  companyWhatsapp,
  currency,
  defaultModelId,
  className,
}: {
  models: { id: string; name: string; detail: string }[]
  companyName: string
  companyWhatsapp: string
  currency: string
  defaultModelId?: string
  className?: string
}) {
  const id = React.useId()
  const [pending, startTransition] = React.useTransition()
  const [situation, setSituation] = React.useState<LandOrigin>("OWN_LAND")
  const [model, setModel] = React.useState(defaultModelId && models.some((m) => m.id === defaultModelId) ? defaultModelId : CUSTOM)
  const [phone, setPhone] = React.useState("")
  const [budget, setBudget] = React.useState<number | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})
  const [done, setDone] = React.useState<{ name: string } | null>(null)

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const fullName = String(form.get("fullName") ?? "")
    const area = Number(String(form.get("landArea") ?? "").replace(",", "."))
    setError(null)
    setFieldErrors({})
    startTransition(async () => {
      const result = await createConstructionRequest({
        landOrigin: situation,
        fullName,
        phone,
        email: String(form.get("email") ?? ""),
        landAddress: String(form.get("landAddress") ?? ""),
        landAreaM2: Number.isFinite(area) && area > 0 ? area : null,
        houseModelId: model === CUSTOM ? null : model,
        message: String(form.get("message") ?? ""),
        budget,
        website: String(form.get("website") ?? ""),
      }).catch(() => null)
      if (!result) return setError("Impossible d'envoyer votre demande. Vérifiez votre connexion et réessayez.")
      if (!result.ok) {
        setError(result.error)
        setFieldErrors(result.fieldErrors ?? {})
        return
      }
      setDone({ name: fullName.trim().split(/\s+/)[0] ?? "" })
    })
  }

  if (done) {
    return (
      <div className={cn("flex flex-col items-center py-8 text-center", className)} role="status">
        <span className="relative grid size-16 place-items-center rounded-full bg-status-available/15 text-status-available-strong">
          <span className="absolute inset-0 animate-pulse-ring rounded-full bg-status-available/25" aria-hidden />
          <CheckCircle2 className="relative size-8" />
        </span>
        <h3 className="mt-5 font-display text-2xl">Merci{done.name ? ` ${done.name}` : ""} !</h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Votre demande de construction est bien enregistrée. Un conseiller {companyName} vous contacte très rapidement pour étudier votre projet et préparer votre offre.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {companyWhatsapp && (
            <Button asChild className="h-11 rounded-md bg-[#25D366] px-5 text-white hover:bg-[#1fb757]">
              <a href={whatsappLink(companyWhatsapp, `Bonjour ${companyName}, je viens de vous envoyer une demande de construction sur votre site.`)} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon className="size-5" />
                Nous écrire sur WhatsApp
              </a>
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className={cn("space-y-5", className)} noValidate>
      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-sm font-medium">Votre situation</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {SITUATIONS.map(({ value, icon: Icon, label }) => {
            const active = situation === value
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSituation(value)}
                className={cn(
                  "flex items-center gap-2.5 rounded-md border p-3 text-left text-sm leading-snug font-medium transition-colors",
                  active ? "border-pine-deep bg-pine-deep text-white" : "bg-card hover:border-pine-deep/40",
                )}
              >
                <Icon className={cn("size-5 shrink-0", active ? "text-gold" : "text-gold-strong")} strokeWidth={1.7} />
                {label}
              </button>
            )
          })}
        </div>
      </fieldset>

      {situation === "OWN_LAND" && (
        <div className="grid gap-4 sm:grid-cols-[1fr_150px]">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-address`}>Où se trouve votre terrain ?</Label>
            <Input id={`${id}-address`} name="landAddress" placeholder="Quartier, commune, ville" className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-area`}>Surface (m²)</Label>
            <Input id={`${id}-area`} name="landArea" inputMode="decimal" placeholder="300" className="h-11" />
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-model`}>Maison souhaitée</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger id={`${id}-model`} className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CUSTOM}>Plan sur mesure</SelectItem>
              {models.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                  {m.detail ? ` — ${m.detail}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-budget`}>
            Budget envisagé <span className="font-normal text-muted-foreground">(facultatif)</span>
          </Label>
          <MoneyInput id={`${id}-budget`} value={budget} onChange={setBudget} suffix={currency} className="h-11" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-message`}>Votre projet</Label>
        <Textarea id={`${id}-message`} name="message" rows={4} placeholder="Nombre de chambres, d'étages, garage, terrasse, délais souhaités…" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-name`}>Nom complet</Label>
          <Input id={`${id}-name`} name="fullName" required autoComplete="name" placeholder="Prénom et nom" className="h-11" aria-invalid={!!fieldErrors.fullName} />
          {fieldErrors.fullName && <p className="text-xs text-destructive">{fieldErrors.fullName}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-phone`}>Téléphone</Label>
          <PhoneInput id={`${id}-phone`} value={phone} onChange={setPhone} className="h-11" />
          {fieldErrors.phone && <p className="text-xs text-destructive">{fieldErrors.phone}</p>}
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`${id}-email`}>
            E-mail <span className="font-normal text-muted-foreground">(facultatif)</span>
          </Label>
          <Input id={`${id}-email`} name="email" type="email" autoComplete="email" placeholder="vous@exemple.com" className="h-11" aria-invalid={!!fieldErrors.email} />
          {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
        </div>
      </div>

      {/* Champ piège anti-robots, invisible pour les visiteurs */}
      <div aria-hidden className="absolute -left-[9999px] size-px overflow-hidden">
        <label>
          Site web
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-muted-foreground">Étude gratuite et sans engagement. Vos coordonnées ne servent qu&apos;à vous recontacter.</p>
        <Button type="submit" disabled={pending} className="h-12 shrink-0 rounded-md bg-pine-deep px-6 text-[0.95rem] font-semibold text-white hover:bg-pine">
          {pending ? <Loader2 className="animate-spin" /> : <Send />}
          Demander mon étude
        </Button>
      </div>
    </form>
  )
}
