"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Check, Inbox, Loader2, MessageSquareText, SquareStack, UserPlus, UserRound, Wallet } from "lucide-react"
import type { LotStatus, PaymentFrequency, PaymentMethod } from "@/generated/prisma/enums"
import { createSale } from "@/app/admin/(app)/ventes/actions"
import { useServerAction } from "@/hooks/use-server-action"
import { formatArea, formatMoney } from "@/lib/format"
import { PAYMENT_METHOD } from "@/lib/labels"
import { formatPhone } from "@/lib/phone"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { LotStatusBadge } from "@/components/shared/badges"
import { PhoneInput } from "@/components/shared/phone-input"
import { Combobox } from "@/components/admin/sales/combobox"
import { defaultFirstDue, Field, PlanFields, planPayload, SchedulePreview, usePlanSchedule, type PlanState } from "@/components/admin/sales/plan-fields"

export type NewSaleLot = {
  id: string
  number: string
  block: string | null
  areaM2: number
  status: LotStatus
  price: number | null
  plan: { deposit: number; count: number; frequency: PaymentFrequency; customIntervalDays: number | null; installmentAmount: number | null } | null
}

type BuyerOption = { id: string; name: string; phone: string }
type NewBuyer = { firstName: string; lastName: string; phone: string; email: string; address: string; city: string; profession: string; idType: string; idNumber: string }

const EMPTY_BUYER: NewBuyer = { firstName: "", lastName: "", phone: "", email: "", address: "", city: "", profession: "", idType: "CNI", idNumber: "" }
const METHODS = Object.keys(PAYMENT_METHOD) as PaymentMethod[]

function planFromLot(lot: NewSaleLot | undefined, today: string): PlanState {
  const frequency = lot?.plan?.frequency ?? "MONTHLY"
  const custom = lot?.plan?.customIntervalDays ?? null
  return {
    price: lot?.price ?? null,
    withDeposit: (lot?.plan?.deposit ?? 0) > 0,
    depositAmount: lot?.plan?.deposit ?? null,
    depositDueDate: today,
    installmentsCount: lot?.plan?.count ?? 12,
    frequency,
    customIntervalDays: custom,
    firstDueDate: defaultFirstDue(today, frequency, custom),
    fixedAmount: !!lot?.plan?.installmentAmount,
    installmentAmount: lot?.plan?.installmentAmount ?? null,
  }
}

export function NewSaleForm({
  lots,
  buyers,
  currency,
  today,
  initialLotId,
  initialBuyerId,
  prefillBuyer,
  request,
  smsDefault,
}: {
  lots: NewSaleLot[]
  buyers: BuyerOption[]
  currency: string
  today: string
  initialLotId?: string
  initialBuyerId?: string
  prefillBuyer: { firstName: string; lastName: string; phone: string; email: string } | null
  request: { id: string; fullName: string } | null
  smsDefault: boolean
}) {
  const router = useRouter()
  const { run, pending } = useServerAction()
  const [lotId, setLotId] = React.useState(initialLotId)
  const lot = lots.find((l) => l.id === lotId)
  const [buyerMode, setBuyerMode] = React.useState<"existing" | "new">(prefillBuyer || (!initialBuyerId && buyers.length === 0) ? "new" : "existing")
  const [buyerId, setBuyerId] = React.useState(initialBuyerId)
  const [newBuyer, setNewBuyer] = React.useState<NewBuyer>(prefillBuyer ? { ...EMPTY_BUYER, ...prefillBuyer } : EMPTY_BUYER)
  const [plan, setPlan] = React.useState<PlanState>(() => planFromLot(lot, today))
  const [firstDueTouched, setFirstDueTouched] = React.useState(false)
  const [signedAt, setSignedAt] = React.useState(today)
  const [collect, setCollect] = React.useState(true)
  const [method, setMethod] = React.useState<PaymentMethod>("WAVE")
  const [reference, setReference] = React.useState("")
  const [welcome, setWelcome] = React.useState(smsDefault)
  const [notes, setNotes] = React.useState("")
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const schedule = usePlanSchedule(plan)
  const buyer = buyers.find((b) => b.id === buyerId)

  function selectLot(id: string) {
    setLotId(id)
    const next = lots.find((l) => l.id === id)
    setPlan(planFromLot(next, signedAt))
    setFirstDueTouched(false)
  }

  function changePlan(next: PlanState) {
    const firstDueChanged = next.firstDueDate !== plan.firstDueDate
    if (firstDueChanged) setFirstDueTouched(true)
    const rhythmChanged = next.frequency !== plan.frequency || next.customIntervalDays !== plan.customIntervalDays
    if (rhythmChanged && !firstDueTouched && !firstDueChanged) {
      next = { ...next, firstDueDate: defaultFirstDue(next.depositDueDate || signedAt, next.frequency, next.customIntervalDays) }
    }
    setPlan(next)
  }

  function changeSignedAt(value: string) {
    setSignedAt(value)
    setPlan((p) => ({
      ...p,
      depositDueDate: value,
      firstDueDate: firstDueTouched ? p.firstDueDate : defaultFirstDue(value, p.frequency, p.customIntervalDays),
    }))
  }

  const deposit = plan.withDeposit ? (plan.depositAmount ?? 0) : 0

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setErrors({})
    if (!lotId) return setErrors({ lotId: "Choisissez un terrain" })
    if (buyerMode === "existing" && !buyerId) return setErrors({ buyerId: "Choisissez un acheteur" })
    run(
      () =>
        createSale({
          lotId,
          buyerId: buyerMode === "existing" ? buyerId : null,
          newBuyer: buyerMode === "new" ? newBuyer : null,
          requestId: request?.id ?? null,
          signedAt,
          notes,
          collectDeposit: deposit > 0 && collect ? { method, reference } : null,
          sendWelcomeSms: welcome,
          plan: planPayload(plan),
        }),
      {
        onSuccess: (data) => router.push(`/admin/ventes/${data.saleId}`),
        onError: (_, fieldErrors) => fieldErrors && setErrors(fieldErrors),
        refresh: false,
      },
    )
  }

  const setBuyerField = (key: keyof NewBuyer, value: string) => setNewBuyer((b) => ({ ...b, [key]: value }))

  return (
    <form onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-6">
        {request && (
          <div className="flex items-center gap-3 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm">
            <Inbox className="size-4 shrink-0 text-gold-strong" />
            <p>
              Conversion de la demande de <strong>{request.fullName}</strong> : elle sera marquée « Convertie en vente ».
            </p>
          </div>
        )}

        <Section step={1} icon={SquareStack} title="Terrain" description="Seuls les terrains disponibles ou réservés peuvent être attribués.">
          <Combobox
            value={lotId}
            onChange={selectLot}
            placeholder="Choisir un terrain…"
            searchPlaceholder="N° de terrain, îlot…"
            empty="Aucun terrain disponible."
            options={lots.map((l) => ({
              value: l.id,
              label: `Terrain ${l.number}`,
              keywords: [l.number, l.block ? `ilot ${l.block}` : "", String(l.areaM2)],
              render: (
                <div className="flex w-full items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      N° {l.number} {l.block && <span className="font-normal text-muted-foreground">· Îlot {l.block}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatArea(l.areaM2)} · {l.price ? formatMoney(l.price, currency) : "Prix non défini"}
                    </p>
                  </div>
                  {l.status === "RESERVED" && <LotStatusBadge status={l.status} />}
                </div>
              ),
            }))}
            renderValue={() =>
              lot && (
                <span className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-sm font-bold text-primary">{lot.number}</span>
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      Terrain n°{lot.number}
                      {lot.block ? ` · Îlot ${lot.block}` : ""}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatArea(lot.areaM2)} · {lot.price ? formatMoney(lot.price, currency) : "Prix non défini"}
                    </span>
                  </span>
                </span>
              )
            }
          />
          {errors.lotId && <p className="mt-1.5 text-xs font-medium text-destructive">{errors.lotId}</p>}
          {lot?.status === "RESERVED" && (
            <p className="mt-2 text-xs text-muted-foreground">Ce terrain est actuellement réservé (option posée) : l&apos;attribution lèvera l&apos;option.</p>
          )}
        </Section>

        <Section step={2} icon={UserRound} title="Acheteur">
          <Tabs value={buyerMode} onValueChange={(v) => setBuyerMode(v as "existing" | "new")}>
            <TabsList className="mb-4 w-full sm:w-auto">
              <TabsTrigger value="existing">
                <UserRound />
                Acheteur existant
              </TabsTrigger>
              <TabsTrigger value="new">
                <UserPlus />
                Nouvel acheteur
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {buyerMode === "existing" ? (
            <>
              <Combobox
                value={buyerId}
                onChange={setBuyerId}
                placeholder="Rechercher un acheteur…"
                searchPlaceholder="Nom ou téléphone…"
                empty="Aucun acheteur trouvé."
                options={buyers.map((b) => ({
                  value: b.id,
                  label: b.name,
                  keywords: [b.phone, b.phone.replace("+221", "")],
                  render: (
                    <div>
                      <p className="font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground tabular">{formatPhone(b.phone)}</p>
                    </div>
                  ),
                }))}
                renderValue={(o) => (
                  <span className="block">
                    <span className="block font-semibold">{o.label}</span>
                    <span className="block text-xs text-muted-foreground tabular">{buyer && formatPhone(buyer.phone)}</span>
                  </span>
                )}
              />
              {errors.buyerId && <p className="mt-1.5 text-xs font-medium text-destructive">{errors.buyerId}</p>}
            </>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Prénom *" error={errors["newBuyer.firstName"]}>
                <Input value={newBuyer.firstName} onChange={(e) => setBuyerField("firstName", e.target.value)} autoComplete="off" />
              </Field>
              <Field label="Nom *" error={errors["newBuyer.lastName"]}>
                <Input value={newBuyer.lastName} onChange={(e) => setBuyerField("lastName", e.target.value)} autoComplete="off" />
              </Field>
              <Field label="Téléphone *" error={errors["newBuyer.phone"]} hint="Sert à la connexion à l'espace client (code SMS)">
                <PhoneInput value={newBuyer.phone} onChange={(v) => setBuyerField("phone", v)} />
              </Field>
              <Field label="E-mail" error={errors["newBuyer.email"]}>
                <Input type="email" value={newBuyer.email} onChange={(e) => setBuyerField("email", e.target.value)} />
              </Field>
              <Field label="Adresse">
                <Input value={newBuyer.address} onChange={(e) => setBuyerField("address", e.target.value)} />
              </Field>
              <Field label="Ville">
                <Input value={newBuyer.city} onChange={(e) => setBuyerField("city", e.target.value)} />
              </Field>
              <Field label="Pièce d'identité">
                <Select value={newBuyer.idType} onValueChange={(v) => setBuyerField("idType", v)}>
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
                <Input value={newBuyer.idNumber} onChange={(e) => setBuyerField("idNumber", e.target.value)} />
              </Field>
              <Field label="Profession" className="sm:col-span-2">
                <Input value={newBuyer.profession} onChange={(e) => setBuyerField("profession", e.target.value)} />
              </Field>
            </div>
          )}
        </Section>

        <Section step={3} icon={Wallet} title="Prix et modalités de paiement" description="Prérempli avec les modalités du terrain : ajustez-les pour cet acheteur.">
          <div className="mb-5 max-w-xs">
            <Field label="Date de signature">
              <Input type="date" value={signedAt} onChange={(e) => changeSignedAt(e.target.value)} />
            </Field>
          </div>
          <PlanFields value={plan} onChange={changePlan} currency={currency} errors={errors} />
        </Section>

        <Section step={4} icon={MessageSquareText} title="Encaissement et notifications">
          <div className="space-y-4">
            {deposit > 0 && (
              <div className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Label htmlFor="collect" className="text-sm font-semibold">
                      Encaisser l&apos;acompte maintenant
                    </Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Enregistre un versement de {formatMoney(deposit, currency)} daté du jour de la signature, avec reçu.
                    </p>
                  </div>
                  <Switch id="collect" checked={collect} onCheckedChange={setCollect} />
                </div>
                {collect && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="Mode de paiement">
                      <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {METHODS.map((m) => (
                            <SelectItem key={m} value={m}>
                              {PAYMENT_METHOD[m]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Référence (transaction, chèque…)">
                      <Input value={reference} onChange={(e) => setReference(e.target.value)} />
                    </Field>
                  </div>
                )}
              </div>
            )}
            <div className="flex items-start justify-between gap-4 rounded-xl border p-4">
              <div>
                <Label htmlFor="welcome" className="text-sm font-semibold">
                  Envoyer un SMS de bienvenue
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">Le SMS confirme l&apos;attribution et donne le lien de l&apos;espace client.</p>
              </div>
              <Switch id="welcome" checked={welcome} onCheckedChange={setWelcome} />
            </div>
            <Field label="Notes internes">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Conditions particulières, accord de paiement…" />
            </Field>
          </div>
        </Section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20">
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="border-b bg-pine-deep px-5 py-4 text-white">
            <p className="text-xs font-semibold tracking-[0.16em] text-gold uppercase">Récapitulatif</p>
            <p className="mt-1 text-lg font-bold">{lot ? `Terrain n°${lot.number}` : "Aucun terrain choisi"}</p>
            <p className="text-sm text-white/70">
              {buyerMode === "existing"
                ? (buyer?.name ?? "Acheteur à choisir")
                : [newBuyer.firstName, newBuyer.lastName].filter(Boolean).join(" ") || "Nouvel acheteur"}
            </p>
            {plan.price ? <p className="mt-3 text-2xl font-extrabold">{formatMoney(plan.price, currency)}</p> : null}
          </div>
          <div className="p-5">
            <SchedulePreview lines={schedule} currency={currency} plan={plan} />
          </div>
        </div>
        <Button type="submit" size="lg" className="h-11 w-full text-sm" disabled={pending || schedule.length === 0}>
          {pending ? <Loader2 className="animate-spin" /> : <Check />}
          Enregistrer la vente
        </Button>
        <p className="text-center text-xs text-muted-foreground">Le terrain passera au statut « Vendu ».</p>
      </aside>
    </form>
  )
}

function Section({
  step,
  icon: Icon,
  title,
  description,
  children,
}: {
  step: number
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-xs sm:p-6">
      <header className="mb-5 flex items-start gap-3">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary")}>
          <Icon className="size-4" />
        </span>
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Étape {step}</p>
          <h2 className="text-base font-bold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </header>
      {children}
    </section>
  )
}
