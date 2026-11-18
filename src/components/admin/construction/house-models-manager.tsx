"use client"

import * as React from "react"
import Image from "next/image"
import { BedDouble, Eye, EyeOff, Layers, Loader2, Pencil, Plus, Ruler, Trash2 } from "lucide-react"
import { deleteHouseModel, saveHouseModel, setHouseModelPublished } from "@/app/admin/(app)/modeles/actions"
import { useServerAction } from "@/hooks/use-server-action"
import { formatArea, formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { MoneyInput } from "@/components/shared/money-input"
import { ImageField } from "@/components/admin/settings/image-field"
import { TagInput } from "@/components/admin/settings/form-bits"
import { Field } from "@/components/admin/sales/plan-fields"

export type HouseModelCard = {
  id: string
  name: string
  tagline: string
  description: string
  levels: string | null
  bedrooms: number | null
  bathrooms: number | null
  livingAreaM2: number | null
  minLandM2: number | null
  basePrice: number | null
  images: string[]
  features: string[]
  published: boolean
  projects: number
}

type Draft = Omit<HouseModelCard, "projects" | "id"> & { id: string | null }

const EMPTY: Draft = {
  id: null,
  name: "",
  tagline: "",
  description: "",
  levels: "",
  bedrooms: null,
  bathrooms: null,
  livingAreaM2: null,
  minLandM2: null,
  basePrice: null,
  images: [],
  features: [],
  published: true,
}

/** Catalogue des modèles de maisons proposés aux clients (plans types). */
export function HouseModelsManager({ models, currency, canEdit }: { models: HouseModelCard[]; currency: string; canEdit: boolean }) {
  const { run, pending } = useServerAction()
  const [draft, setDraft] = React.useState<Draft | null>(null)

  return (
    <>
      {canEdit && (
        <div className="mb-5 flex justify-end">
          <Button onClick={() => setDraft(EMPTY)}>
            <Plus />
            Nouveau modèle
          </Button>
        </div>
      )}
      {models.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-6 py-14 text-center">
          <p className="font-medium">Aucun modèle de maison</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Ajoutez vos plans types (villa de plain-pied, R+1, immeuble…) avec leurs visuels : ils sont proposés sur le site et dans l&apos;espace client.
          </p>
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {models.map((model) => (
            <li key={model.id} className={cn("flex flex-col overflow-hidden rounded-2xl border bg-card shadow-xs", !model.published && "opacity-75")}>
              <div className="relative aspect-[16/10] bg-muted">
                {model.images[0] ? (
                  <Image src={model.images[0]} alt={model.name} fill sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
                ) : (
                  <div className="grid size-full place-items-center text-sm text-muted-foreground">Sans visuel</div>
                )}
                {!model.published && <span className="absolute top-3 left-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-semibold">Masqué du site</span>}
                {model.images.length > 1 && <span className="absolute right-3 bottom-3 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">{model.images.length} visuels</span>}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="font-semibold">{model.name}</p>
                {model.tagline && <p className="mt-0.5 text-sm text-muted-foreground">{model.tagline}</p>}
                <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {model.levels && (
                    <span className="inline-flex items-center gap-1">
                      <Layers className="size-3.5" />
                      {model.levels}
                    </span>
                  )}
                  {model.bedrooms != null && (
                    <span className="inline-flex items-center gap-1">
                      <BedDouble className="size-3.5" />
                      {model.bedrooms} ch.
                    </span>
                  )}
                  {model.livingAreaM2 != null && (
                    <span className="inline-flex items-center gap-1">
                      <Ruler className="size-3.5" />
                      {formatArea(model.livingAreaM2)}
                    </span>
                  )}
                </p>
                <p className="mt-3 text-sm">
                  {model.basePrice != null ? (
                    <>
                      À partir de <strong className="tabular">{formatMoney(model.basePrice, currency)}</strong>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Prix sur étude</span>
                  )}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {model.projects} projet{model.projects > 1 ? "s" : ""} sur ce modèle
                </p>
                {canEdit && (
                  <div className="mt-4 flex items-center gap-1 border-t pt-3">
                    <Button variant="ghost" size="sm" onClick={() => setDraft({ ...model, levels: model.levels ?? "" })}>
                      <Pencil />
                      Modifier
                    </Button>
                    <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => setHouseModelPublished(model.id, !model.published))}>
                      {model.published ? <EyeOff /> : <Eye />}
                      {model.published ? "Masquer" : "Afficher"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="ml-auto"
                      aria-label={`Supprimer ${model.name}`}
                      disabled={pending}
                      onClick={() => confirm(`Supprimer le modèle « ${model.name} » ? Les projets existants sont conservés.`) && run(() => deleteHouseModel(model.id))}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {draft && <ModelDialog draft={draft} currency={currency} onClose={() => setDraft(null)} />}
    </>
  )
}

const toInt = (v: string) => (v.trim() && Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : null)
const toFloat = (v: string) => {
  const n = Number(v.replace(",", "."))
  return v.trim() && Number.isFinite(n) && n >= 0 ? n : null
}

function ModelDialog({ draft, currency, onClose }: { draft: Draft; currency: string; onClose: () => void }) {
  const { run, pending } = useServerAction()
  const [values, setValues] = React.useState(draft)
  const set = <K extends keyof Draft>(key: K, v: Draft[K]) => setValues((s) => ({ ...s, [key]: v }))

  function submit(event: React.FormEvent) {
    event.preventDefault()
    run(() => saveHouseModel({ ...values, levels: values.levels || null }), { onSuccess: onClose })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Modifier le modèle" : "Nouveau modèle de maison"}</DialogTitle>
            <DialogDescription>Un plan type que vous proposez de construire. Le prix est indicatif : chaque projet reçoit sa propre offre.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-6">
            <Field label="Nom *" className="sm:col-span-4">
              <Input value={values.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex. : Villa Teranga" required autoFocus={!draft.id} />
            </Field>
            <Field label="Niveaux" className="sm:col-span-2">
              <Input value={values.levels ?? ""} onChange={(e) => set("levels", e.target.value)} placeholder="Plain-pied, R+1…" />
            </Field>
            <Field label="Accroche" className="sm:col-span-6">
              <Input value={values.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder="Ex. : La maison familiale, lumineuse et évolutive" />
            </Field>
            <Field label="Chambres" className="sm:col-span-2">
              <Input type="number" min={0} value={values.bedrooms ?? ""} onChange={(e) => set("bedrooms", toInt(e.target.value))} />
            </Field>
            <Field label="Salles d'eau" className="sm:col-span-2">
              <Input type="number" min={0} value={values.bathrooms ?? ""} onChange={(e) => set("bathrooms", toInt(e.target.value))} />
            </Field>
            <Field label="Surface habitable (m²)" className="sm:col-span-2">
              <Input inputMode="decimal" value={values.livingAreaM2 ?? ""} onChange={(e) => set("livingAreaM2", toFloat(e.target.value))} />
            </Field>
            <Field label="Terrain minimum (m²)" className="sm:col-span-3">
              <Input inputMode="decimal" value={values.minLandM2 ?? ""} onChange={(e) => set("minLandM2", toFloat(e.target.value))} />
            </Field>
            <Field label="Prix indicatif « à partir de »" className="sm:col-span-3">
              <MoneyInput value={values.basePrice} onChange={(v) => set("basePrice", v)} suffix={currency} />
            </Field>
            <Field label="Description" className="sm:col-span-6">
              <Textarea value={values.description} onChange={(e) => set("description", e.target.value)} rows={3} />
            </Field>
            <Field label="Points forts" className="sm:col-span-6" hint="Appuyez sur Entrée après chaque point (ex. : Terrasse couverte, Garage, Suite parentale)">
              <TagInput value={values.features} onChange={(v) => set("features", v)} placeholder="Ajouter un point fort" />
            </Field>
          </div>

          <div className="grid gap-2">
            <p className="text-sm font-medium">Visuels</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[...values.images, null].slice(0, 12).map((url, index) => (
                <ImageField
                  key={url ?? "new"}
                  value={url}
                  folder="models"
                  aspect="aspect-[4/3]"
                  onChange={(next) =>
                    set(
                      "images",
                      next ? (index < values.images.length ? values.images.map((x, i) => (i === index ? next : x)) : [...values.images, next]) : values.images.filter((_, i) => i !== index),
                    )
                  }
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Le premier visuel sert d&apos;image principale. Perspectives, façades, plans…</p>
          </div>

          <label className="flex items-start gap-3 rounded-xl border p-3">
            <Switch checked={values.published} onCheckedChange={(v) => set("published", v)} className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium">Afficher sur le site et dans l&apos;espace client</span>
              <span className="block text-xs text-muted-foreground">Désactivé : le modèle reste utilisable pour vos projets, sans être proposé publiquement.</span>
            </span>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
