"use client"

import { Building2, MapPinned, Search } from "lucide-react"
import type { LandOrigin } from "@/generated/prisma/enums"
import { formatArea } from "@/lib/format"
import { LAND_ORIGIN } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { MoneyInput } from "@/components/shared/money-input"
import { Combobox } from "@/components/admin/sales/combobox"
import { Field } from "@/components/admin/sales/plan-fields"

export type LotOption = { id: string; number: string; block: string | null; areaM2: number; owner: string | null; ownerId: string | null }
export type ModelOption = { id: string; name: string; detail: string }

export type LandValues = { landOrigin: LandOrigin; lotId: string | null; landAddress: string; landAreaM2: number | null; landReference: string }
export type HouseValues = { title: string; houseModelId: string | null; customPlan: boolean; requirements: string; budget: number | null }

const ORIGINS: { value: LandOrigin; icon: typeof Building2 }[] = [
  { value: "COMPANY_LOT", icon: Building2 },
  { value: "OWN_LAND", icon: MapPinned },
  { value: "NO_LAND", icon: Search },
]

const NO_MODEL = "none"

/** Terrain du projet : lot du lotissement, terrain du client ailleurs, ou pas encore de terrain. */
export function LandFields({
  value,
  onChange,
  lots,
  buyerId,
  errors = {},
}: {
  value: LandValues
  onChange: (value: LandValues) => void
  lots: LotOption[]
  /** Client choisi : ses terrains sont proposés en premier */
  buyerId?: string | null
  errors?: Record<string, string>
}) {
  const set = <K extends keyof LandValues>(key: K, v: LandValues[K]) => onChange({ ...value, [key]: v })
  const sorted = buyerId ? [...lots].sort((a, b) => Number(b.ownerId === buyerId) - Number(a.ownerId === buyerId)) : lots
  return (
    <div className="grid gap-4">
      <div role="radiogroup" aria-label="Origine du terrain" className="grid gap-2 sm:grid-cols-3">
        {ORIGINS.map(({ value: origin, icon: Icon }) => {
          const active = value.landOrigin === origin
          return (
            <button
              key={origin}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => set("landOrigin", origin)}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50",
              )}
            >
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{LAND_ORIGIN[origin].label}</span>
                <span className="block text-xs text-muted-foreground">{LAND_ORIGIN[origin].hint}</span>
              </span>
            </button>
          )
        })}
      </div>

      {value.landOrigin === "COMPANY_LOT" && (
        <Field label="Terrain du lotissement *" error={errors.lotId}>
          <Combobox
            value={value.lotId ?? undefined}
            onChange={(id) => set("lotId", id)}
            placeholder="Numéro de terrain ou nom du propriétaire…"
            empty="Aucun terrain trouvé."
            options={sorted.map((lot) => ({
              value: lot.id,
              label: `Terrain n° ${lot.number}${lot.owner ? ` — ${lot.owner}` : ""}`,
              keywords: [lot.number, lot.block ?? "", lot.owner ?? ""],
              render: (
                <div className="flex w-full items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      Terrain n° {lot.number}
                      {lot.block ? ` · îlot ${lot.block}` : ""}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{lot.owner ?? "Non attribué"}</p>
                  </div>
                  <span className="text-xs whitespace-nowrap text-muted-foreground tabular">{formatArea(lot.areaM2)}</span>
                </div>
              ),
            }))}
          />
        </Field>
      )}

      {value.landOrigin === "OWN_LAND" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Localisation du terrain" className="sm:col-span-2" hint="Quartier, commune, ville">
            <Input value={value.landAddress} onChange={(e) => set("landAddress", e.target.value)} placeholder="Ex. : Keur Massar, Dakar" />
          </Field>
          <Field label="Surface (m²)">
            <Input
              inputMode="decimal"
              value={value.landAreaM2 ?? ""}
              onChange={(e) => {
                const n = Number(e.target.value.replace(",", "."))
                set("landAreaM2", e.target.value.trim() && Number.isFinite(n) && n > 0 ? n : null)
              }}
              placeholder="300"
            />
          </Field>
          <Field label="Référence du titre" hint="Titre foncier, bail, NICAD…">
            <Input value={value.landReference} onChange={(e) => set("landReference", e.target.value)} />
          </Field>
        </div>
      )}

      {value.landOrigin === "NO_LAND" && (
        <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
          Le client souhaite une maison mais n&apos;a pas encore de terrain. Vous pourrez rattacher un terrain du lotissement (ou le sien) plus tard, en
          modifiant le projet.
        </p>
      )}
    </div>
  )
}

/** Maison souhaitée : intitulé, modèle du catalogue ou plan personnalisé, besoins, budget. */
export function HouseFields({
  value,
  onChange,
  models,
  currency,
  errors = {},
}: {
  value: HouseValues
  onChange: (value: HouseValues) => void
  models: ModelOption[]
  currency: string
  errors?: Record<string, string>
}) {
  const set = <K extends keyof HouseValues>(key: K, v: HouseValues[K]) => onChange({ ...value, [key]: v })
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Intitulé du projet *" className="sm:col-span-2" error={errors.title} hint="Tel qu'il apparaîtra dans l'espace du client">
        <Input value={value.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex. : Villa R+1 de 4 chambres" />
      </Field>
      <Field label="Modèle du catalogue">
        <Select value={value.houseModelId ?? NO_MODEL} onValueChange={(v) => set("houseModelId", v === NO_MODEL ? null : v)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_MODEL}>Aucun modèle</SelectItem>
            {models.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
                {m.detail ? ` — ${m.detail}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Budget indiqué par le client">
        <MoneyInput value={value.budget} onChange={(v) => set("budget", v)} suffix={currency} />
      </Field>
      <label className="flex items-start gap-3 rounded-xl border p-3 sm:col-span-2">
        <Switch checked={value.customPlan} onCheckedChange={(v) => set("customPlan", v)} className="mt-0.5" />
        <span>
          <span className="block text-sm font-medium">Plan personnalisé</span>
          <span className="block text-xs text-muted-foreground">Le client veut un plan sur mesure (ou adapté d&apos;un modèle) plutôt qu&apos;un modèle tel quel.</span>
        </span>
      </label>
      <Field label="Besoins exprimés" className="sm:col-span-2" hint="Nombre de chambres, d'étages, style, contraintes, délais…">
        <Textarea value={value.requirements} onChange={(e) => set("requirements", e.target.value)} rows={4} />
      </Field>
    </div>
  )
}
