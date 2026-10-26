"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { createBuyer, updateBuyer, type BuyerInput } from "@/app/admin/(app)/acheteurs/actions"
import { useServerAction } from "@/hooks/use-server-action"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { PhoneInput } from "@/components/shared/phone-input"
import { Field } from "@/components/admin/sales/plan-fields"

export type BuyerFormValues = Required<{ [K in keyof BuyerInput]: string }>

const EMPTY: BuyerFormValues = {
  firstName: "",
  lastName: "",
  phone: "",
  phoneAlt: "",
  email: "",
  address: "",
  city: "",
  country: "Sénégal",
  profession: "",
  idType: "CNI",
  idNumber: "",
  notes: "",
}

/** Création / modification d'une fiche acheteur. */
export function BuyerFormDialog({
  buyerId,
  initial,
  trigger,
  open: controlledOpen,
  onOpenChange,
  redirectOnCreate = true,
}: {
  buyerId?: string
  initial?: Partial<BuyerFormValues>
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  redirectOnCreate?: boolean
}) {
  const [innerOpen, setInnerOpen] = React.useState(false)
  const open = controlledOpen ?? innerOpen
  const setOpen = onOpenChange ?? setInnerOpen

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <BuyerForm buyerId={buyerId} initial={initial} redirectOnCreate={redirectOnCreate} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function BuyerForm({
  buyerId,
  initial,
  redirectOnCreate,
  onDone,
}: {
  buyerId?: string
  initial?: Partial<BuyerFormValues>
  redirectOnCreate: boolean
  onDone: () => void
}) {
  const router = useRouter()
  const { run, pending } = useServerAction()
  const [values, setValues] = React.useState<BuyerFormValues>({ ...EMPTY, ...initial })
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const set = (key: keyof BuyerFormValues) => (value: string) => setValues((v) => ({ ...v, [key]: value }))

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setErrors({})
    run(() => (buyerId ? updateBuyer(buyerId, values) : createBuyer(values)), {
      onSuccess: (data) => {
        onDone()
        if (!buyerId && redirectOnCreate) router.push(`/admin/acheteurs/${data.id}`)
      },
      onError: (_, fieldErrors) => setErrors(fieldErrors ?? {}),
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{buyerId ? "Modifier la fiche acheteur" : "Nouvel acheteur"}</DialogTitle>
        <DialogDescription>Le numéro de téléphone principal permet à l&apos;acheteur de se connecter à son espace client.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom *" error={errors.firstName}>
          <Input value={values.firstName} onChange={(e) => set("firstName")(e.target.value)} required autoFocus />
        </Field>
        <Field label="Nom *" error={errors.lastName}>
          <Input value={values.lastName} onChange={(e) => set("lastName")(e.target.value)} required />
        </Field>
        <Field label="Téléphone principal *" error={errors.phone}>
          <PhoneInput value={values.phone} onChange={set("phone")} />
        </Field>
        <Field label="Second téléphone" error={errors.phoneAlt}>
          <PhoneInput value={values.phoneAlt} onChange={set("phoneAlt")} />
        </Field>
        <Field label="E-mail" error={errors.email} className="sm:col-span-2">
          <Input type="email" value={values.email} onChange={(e) => set("email")(e.target.value)} />
        </Field>
        <Field label="Adresse" className="sm:col-span-2">
          <Input value={values.address} onChange={(e) => set("address")(e.target.value)} />
        </Field>
        <Field label="Ville">
          <Input value={values.city} onChange={(e) => set("city")(e.target.value)} />
        </Field>
        <Field label="Pays">
          <Input value={values.country} onChange={(e) => set("country")(e.target.value)} />
        </Field>
        <Field label="Pièce d'identité">
          <Select value={values.idType || "CNI"} onValueChange={set("idType")}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["CNI", "Passeport", "Carte consulaire", "Permis de conduire", "Autre"].map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="N° de pièce">
          <Input value={values.idNumber} onChange={(e) => set("idNumber")(e.target.value)} />
        </Field>
        <Field label="Profession" className="sm:col-span-2">
          <Input value={values.profession} onChange={(e) => set("profession")(e.target.value)} />
        </Field>
        <Field label="Notes internes" className="sm:col-span-2">
          <Textarea value={values.notes} onChange={(e) => set("notes")(e.target.value)} rows={3} />
        </Field>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {buyerId ? "Enregistrer" : "Créer l'acheteur"}
        </Button>
      </DialogFooter>
    </form>
  )
}
