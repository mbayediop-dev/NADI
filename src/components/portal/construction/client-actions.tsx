"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Building2, Check, FileUp, Loader2, MapPinned, PencilRuler, Search, Send, X } from "lucide-react"
import type { LandOrigin } from "@/generated/prisma/enums"
import { answerMyQuote, requestConstruction } from "@/app/espace-client/(portal)/construction/actions"
import { useServerAction } from "@/hooks/use-server-action"
import { formatArea, formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { MoneyInput } from "@/components/shared/money-input"

// ─────────────────────────────────────────────────────────────
// Demande de construction
// ─────────────────────────────────────────────────────────────

export type OwnedLot = { saleId: string; number: string; block: string | null; areaM2: number }
export type ModelChoice = { id: string; name: string; detail: string; image: string | null; basePrice: number | null }

const ORIGINS: { value: LandOrigin; icon: typeof Building2; label: string; hint: string }[] = [
  { value: "COMPANY_LOT", icon: Building2, label: "Sur mon terrain du lotissement", hint: "Le terrain que vous avez acquis chez nous" },
  { value: "OWN_LAND", icon: MapPinned, label: "Sur un terrain que je possède ailleurs", hint: "Nous construisons aussi hors du lotissement" },
  { value: "NO_LAND", icon: Search, label: "Je n'ai pas encore de terrain", hint: "Nous vous aidons à trouver le terrain et à bâtir" },
]

const CUSTOM = "custom"

export function ConstructionRequestForm({ lots, models, currency, defaultModelId }: { lots: OwnedLot[]; models: ModelChoice[]; currency: string; defaultModelId?: string }) {
  const router = useRouter()
  const { run, pending } = useServerAction()
  const origins = lots.length ? ORIGINS : ORIGINS.filter((o) => o.value !== "COMPANY_LOT")
  const [landOrigin, setLandOrigin] = React.useState<LandOrigin>(lots.length ? "COMPANY_LOT" : "OWN_LAND")
  const [saleId, setSaleId] = React.useState(lots[0]?.saleId ?? "")
  const [landAddress, setLandAddress] = React.useState("")
  const [landArea, setLandArea] = React.useState("")
  const [choice, setChoice] = React.useState<string>(defaultModelId && models.some((m) => m.id === defaultModelId) ? defaultModelId : models.length ? "" : CUSTOM)
  const [requirements, setRequirements] = React.useState("")
  const [budget, setBudget] = React.useState<number | null>(null)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setErrors({})
    if (!choice) return setErrors({ requirements: "Choisissez un modèle ou « Plan sur mesure »" })
    const area = Number(landArea.replace(",", "."))
    run(
      () =>
        requestConstruction({
          landOrigin,
          saleId: landOrigin === "COMPANY_LOT" ? saleId : null,
          landAddress,
          landAreaM2: landArea.trim() && Number.isFinite(area) && area > 0 ? area : null,
          houseModelId: choice === CUSTOM ? null : choice,
          customPlan: choice === CUSTOM,
          requirements,
          budget,
        }),
      {
        refresh: false,
        onSuccess: (data) => router.push(`/espace-client/construction/${data.projectId}`),
        onError: (_, fieldErrors) => setErrors(fieldErrors ?? {}),
      },
    )
  }

  return (
    <form onSubmit={submit} className="grid gap-6">
      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-semibold">1. Où souhaitez-vous construire ?</legend>
        <div className="grid gap-2 lg:grid-cols-3">
          {origins.map(({ value, icon: Icon, label, hint }) => {
            const active = landOrigin === value
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setLandOrigin(value)}
                className={cn("flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors", active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50")}
              >
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  <Icon className="size-[1.1rem]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm leading-snug font-semibold">{label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
                </span>
              </button>
            )
          })}
        </div>
        {landOrigin === "COMPANY_LOT" && lots.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {lots.map((lot) => (
              <button
                key={lot.saleId}
                type="button"
                onClick={() => setSaleId(lot.saleId)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  saleId === lot.saleId ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                )}
              >
                Terrain n° {lot.number} · {formatArea(lot.areaM2)}
              </button>
            ))}
          </div>
        )}
        {landOrigin === "COMPANY_LOT" && lots.length === 1 && (
          <p className="text-sm text-muted-foreground">
            Votre terrain n° {lots[0].number}
            {lots[0].block ? ` (îlot ${lots[0].block})` : ""} · {formatArea(lots[0].areaM2)}
          </p>
        )}
        {landOrigin === "OWN_LAND" && (
          <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
            <div className="grid gap-1.5">
              <Label htmlFor="land-address">Où se trouve votre terrain ?</Label>
              <Input id="land-address" value={landAddress} onChange={(e) => setLandAddress(e.target.value)} placeholder="Quartier, commune, ville" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="land-area">Surface (m²)</Label>
              <Input id="land-area" inputMode="decimal" value={landArea} onChange={(e) => setLandArea(e.target.value)} placeholder="300" />
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-semibold">2. Quelle maison ?</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {models.map((model) => {
            const active = choice === model.id
            return (
              <button
                key={model.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setChoice(model.id)}
                className={cn("overflow-hidden rounded-2xl border text-left transition-colors", active ? "border-primary ring-2 ring-primary" : "hover:border-primary/40")}
              >
                <span className="relative block aspect-[16/10] bg-muted">
                  {model.image && <Image src={model.image} alt="" fill sizes="(min-width: 1024px) 300px, 50vw" className="object-cover" />}
                  {active && (
                    <span className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3.5" />
                    </span>
                  )}
                </span>
                <span className="block p-3">
                  <span className="block text-sm font-semibold">{model.name}</span>
                  {model.detail && <span className="mt-0.5 block text-xs text-muted-foreground">{model.detail}</span>}
                  {model.basePrice != null && <span className="mt-1 block text-xs font-medium tabular">À partir de {formatMoney(model.basePrice, currency)}</span>}
                </span>
              </button>
            )
          })}
          <button
            type="button"
            role="radio"
            aria-checked={choice === CUSTOM}
            onClick={() => setChoice(CUSTOM)}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-5 text-center transition-colors",
              choice === CUSTOM ? "border-solid border-primary bg-primary/5 ring-2 ring-primary" : "hover:bg-muted/50",
            )}
          >
            <span className={cn("grid size-10 place-items-center rounded-xl", choice === CUSTOM ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
              <PencilRuler className="size-5" />
            </span>
            <span className="text-sm font-semibold">Plan sur mesure</span>
            <span className="text-xs text-muted-foreground">Nous dessinons la maison selon vos besoins (ou à partir de votre propre plan).</span>
          </button>
        </div>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-semibold">3. Votre projet</legend>
        <div className="grid gap-1.5">
          <Label htmlFor="requirements">Décrivez la maison souhaitée</Label>
          <Textarea
            id="requirements"
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            rows={4}
            placeholder="Nombre de chambres, d'étages, garage, terrasse, délais souhaités…"
            aria-invalid={!!errors.requirements}
          />
          {errors.requirements && <p className="text-xs font-medium text-destructive">{errors.requirements}</p>}
        </div>
        <div className="grid gap-1.5 sm:max-w-xs">
          <Label htmlFor="budget">Budget envisagé (facultatif)</Label>
          <MoneyInput id="budget" value={budget} onChange={setBudget} suffix={currency} />
        </div>
      </fieldset>

      <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">Sans engagement : nous étudions votre demande et vous présentons une offre détaillée dans cet espace.</p>
        <Button type="submit" size="lg" disabled={pending} className="h-11 shrink-0 px-5">
          {pending ? <Loader2 className="animate-spin" /> : <Send />}
          Envoyer ma demande
        </Button>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────
// Réponse à une offre
// ─────────────────────────────────────────────────────────────

export function QuoteResponse({ quoteId, number, amount, currency }: { quoteId: string; number: string; amount: number; currency: string }) {
  const { run, pending } = useServerAction()
  const [mode, setMode] = React.useState<"accept" | "decline" | null>(null)
  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={() => setMode("decline")} className="h-11">
          <X />
          Je ne donne pas suite
        </Button>
        <Button onClick={() => setMode("accept")} className="h-11 px-5">
          <Check />
          J&apos;accepte cette offre
        </Button>
      </div>
      <Dialog open={mode != null} onOpenChange={(open) => !open && setMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{mode === "accept" ? `Accepter l'offre ${number} ?` : `Refuser l'offre ${number} ?`}</DialogTitle>
            <DialogDescription>
              {mode === "accept"
                ? `Vous donnez votre accord pour la construction au prix de ${formatMoney(amount, currency)}. Nous vous contactons pour signer le contrat et convenir de l'échéancier de paiement.`
                : "Nous serons informés de votre décision. Vous pouvez nous contacter pour ajuster l'offre à votre budget ou à vos besoins."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>
              Annuler
            </Button>
            <Button variant={mode === "decline" ? "destructive" : "default"} disabled={pending} onClick={() => run(() => answerMyQuote(quoteId, mode === "accept"), { onSuccess: () => setMode(null) })}>
              {pending && <Loader2 className="animate-spin" />}
              {mode === "accept" ? "Confirmer mon accord" : "Confirmer le refus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// Dépôt d'un document par le client
// ─────────────────────────────────────────────────────────────

export function ClientDocumentUpload({ projectId }: { projectId: string }) {
  const router = useRouter()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [progress, setProgress] = React.useState<number | null>(null)

  function send(file: File) {
    if (file.size > 15 * 1024 * 1024) return toast.error("Fichier trop volumineux (15 Mo maximum)")
    const form = new FormData()
    form.append("file", file)
    form.append("projectId", projectId)
    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/api/espace-client/upload")
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(e.loaded / e.total)
    xhr.onload = () => {
      setProgress(null)
      let body: { error?: string } = {}
      try {
        body = JSON.parse(xhr.responseText)
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) {
        toast.success("Document envoyé")
        router.refresh()
      } else toast.error(body.error ?? "L'envoi a échoué. Réessayez.")
    }
    xhr.onerror = () => {
      setProgress(null)
      toast.error("Erreur réseau pendant l'envoi")
    }
    setProgress(0)
    xhr.send(form)
  }

  return (
    <div className="rounded-2xl border border-dashed p-4">
      <div className="flex flex-col gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Transmettre un document</p>
          <p className="text-xs text-muted-foreground">Titre de propriété, pièce d&apos;identité, plan ou croquis souhaité… PDF, photo ou Word, 15 Mo maximum.</p>
        </div>
        <Button variant="outline" disabled={progress != null} onClick={() => inputRef.current?.click()} className="h-10 w-full shrink-0">
          {progress != null ? <Loader2 className="animate-spin" /> : <FileUp />}
          {progress != null ? "Envoi en cours…" : "Choisir un fichier"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          hidden
          accept=".pdf,image/*,.doc,.docx"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) send(file)
            e.target.value = ""
          }}
        />
      </div>
      {progress != null && <Progress value={progress * 100} className="mt-3 h-1.5" />}
    </div>
  )
}
