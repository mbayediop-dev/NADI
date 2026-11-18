"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { HardHat, Loader2 } from "lucide-react"
import { createProject } from "@/app/admin/(app)/construction/actions"
import { useServerAction } from "@/hooks/use-server-action"
import { formatPhone } from "@/lib/phone"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PhoneInput } from "@/components/shared/phone-input"
import { Card } from "@/components/admin/sales/card"
import { Combobox } from "@/components/admin/sales/combobox"
import { Field } from "@/components/admin/sales/plan-fields"
import { HouseFields, LandFields, type HouseValues, type LandValues, type LotOption, type ModelOption } from "@/components/admin/construction/project-fields"

export type BuyerOption = { id: string; name: string; phone: string }

const EMPTY_BUYER = { firstName: "", lastName: "", phone: "", email: "" }

/** Ouverture d'un projet de construction : client, terrain, maison souhaitée. */
export function NewProjectForm({
  buyers,
  lots,
  models,
  currency,
  initialBuyerId,
}: {
  buyers: BuyerOption[]
  lots: LotOption[]
  models: ModelOption[]
  currency: string
  initialBuyerId?: string
}) {
  const router = useRouter()
  const { run, pending } = useServerAction()
  const [buyerMode, setBuyerMode] = React.useState<"existing" | "new">(buyers.length === 0 ? "new" : "existing")
  const [buyerId, setBuyerId] = React.useState<string | undefined>(initialBuyerId)
  const [newBuyer, setNewBuyer] = React.useState(EMPTY_BUYER)
  const ownsLot = (id?: string) => !!id && lots.some((l) => l.ownerId === id)
  const [land, setLand] = React.useState<LandValues>({
    landOrigin: ownsLot(initialBuyerId) ? "COMPANY_LOT" : "OWN_LAND",
    lotId: lots.find((l) => l.ownerId === initialBuyerId)?.id ?? null,
    landAddress: "",
    landAreaM2: null,
    landReference: "",
  })
  const [house, setHouse] = React.useState<HouseValues>({ title: "", houseModelId: null, customPlan: false, requirements: "", budget: null })
  const [withPhases, setWithPhases] = React.useState(true)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  function pickBuyer(id: string) {
    setBuyerId(id)
    // Le client a un terrain chez nous : on le propose d'office
    const owned = lots.find((l) => l.ownerId === id)
    if (owned) setLand((v) => ({ ...v, landOrigin: "COMPANY_LOT", lotId: owned.id }))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setErrors({})
    if (buyerMode === "existing" && !buyerId) return setErrors({ buyerId: "Choisissez un client" })
    run(
      () =>
        createProject({
          ...land,
          ...house,
          buyerId: buyerMode === "existing" ? buyerId : null,
          newBuyer: buyerMode === "new" ? newBuyer : null,
          withDefaultPhases: withPhases,
        }),
      {
        refresh: false,
        onSuccess: (data) => router.push(`/admin/construction/${data.projectId}`),
        onError: (_, fieldErrors) => setErrors(fieldErrors ?? {}),
      },
    )
  }

  return (
    <form onSubmit={submit} className="mx-auto grid max-w-3xl gap-6">
      <Card title="Client" description="Il suivra son projet dans l'espace client, avec son numéro de téléphone.">
        <div className="grid gap-4 px-5 pb-5">
          <Tabs value={buyerMode} onValueChange={(v) => setBuyerMode(v as "existing" | "new")}>
            <TabsList>
              <TabsTrigger value="existing" disabled={buyers.length === 0}>
                Client existant
              </TabsTrigger>
              <TabsTrigger value="new">Nouveau client</TabsTrigger>
            </TabsList>
          </Tabs>
          {buyerMode === "existing" ? (
            <Field label="Client *" error={errors.buyerId}>
              <Combobox
                value={buyerId}
                onChange={pickBuyer}
                placeholder="Nom ou téléphone…"
                empty="Aucun client trouvé."
                options={buyers.map((b) => ({
                  value: b.id,
                  label: b.name,
                  keywords: [b.phone],
                  render: (
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="truncate font-medium">{b.name}</span>
                      <span className="text-xs whitespace-nowrap text-muted-foreground tabular">{formatPhone(b.phone)}</span>
                    </div>
                  ),
                }))}
              />
            </Field>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Prénom *" error={errors["newBuyer.firstName"]}>
                <Input value={newBuyer.firstName} onChange={(e) => setNewBuyer((b) => ({ ...b, firstName: e.target.value }))} autoComplete="off" />
              </Field>
              <Field label="Nom *" error={errors["newBuyer.lastName"]}>
                <Input value={newBuyer.lastName} onChange={(e) => setNewBuyer((b) => ({ ...b, lastName: e.target.value }))} autoComplete="off" />
              </Field>
              <Field label="Téléphone *" error={errors["newBuyer.phone"]} hint="Sert à la connexion à l'espace client (code SMS)">
                <PhoneInput value={newBuyer.phone} onChange={(v) => setNewBuyer((b) => ({ ...b, phone: v }))} />
              </Field>
              <Field label="E-mail" error={errors["newBuyer.email"]}>
                <Input type="email" value={newBuyer.email} onChange={(e) => setNewBuyer((b) => ({ ...b, email: e.target.value }))} />
              </Field>
            </div>
          )}
        </div>
      </Card>

      <Card title="Terrain" description="Où la maison sera-t-elle construite ?">
        <div className="px-5 pb-5">
          <LandFields value={land} onChange={setLand} lots={lots} buyerId={buyerMode === "existing" ? buyerId : null} errors={errors} />
        </div>
      </Card>

      <Card title="Maison souhaitée">
        <div className="grid gap-4 px-5 pb-5">
          <HouseFields value={house} onChange={setHouse} models={models} currency={currency} errors={errors} />
          <Label className="flex items-start gap-3 rounded-xl border p-3 font-normal">
            <Checkbox checked={withPhases} onCheckedChange={(v) => setWithPhases(!!v)} className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium">Créer les étapes types du chantier</span>
              <span className="block text-xs text-muted-foreground">Des études à la remise des clés ; vous pourrez les adapter ensuite.</span>
            </span>
          </Label>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" asChild>
          <Link href="/admin/construction">Annuler</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <HardHat />}
          Ouvrir le projet
        </Button>
      </div>
    </form>
  )
}
