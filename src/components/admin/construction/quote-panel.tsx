"use client"

import * as React from "react"
import { toast } from "sonner"
import { Check, Copy, FilePlus2, Loader2, MoreHorizontal, Pencil, Plus, Send, Trash2, X } from "lucide-react"
import type { QuoteStatus } from "@/generated/prisma/enums"
import { answerQuote, deleteQuote, saveQuote, sendQuote } from "@/app/admin/(app)/construction/actions"
import { useServerAction } from "@/hooks/use-server-action"
import { quoteLineTotal, quoteTotal, type QuoteItem } from "@/lib/construction"
import { formatDate, formatMoney, formatNumber } from "@/lib/format"
import { QUOTE_STATUS } from "@/lib/labels"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ToneBadge } from "@/components/shared/badges"
import { QuoteLines } from "@/components/shared/construction-bits"
import { MoneyInput } from "@/components/shared/money-input"
import { Field } from "@/components/admin/sales/plan-fields"

export type QuoteRow = {
  id: string
  number: string
  title: string
  status: QuoteStatus
  items: QuoteItem[]
  amount: number
  notes: string | null
  validUntil: string | null
  sentAt: string | null
  respondedAt: string | null
  createdAt: string
}

type Draft = { id: string | null; title: string; items: QuoteItem[]; notes: string; validUntil: string }

const EMPTY_ITEM: QuoteItem = { section: "", label: "", quantity: 1, unit: "", unitPrice: 0 }
const SECTIONS = ["Études et plans", "Gros œuvre", "Toiture et étanchéité", "Menuiseries", "Électricité", "Plomberie et sanitaires", "Revêtements et peinture", "Extérieurs"]

/** Offres de construction d'un projet : préparation, envoi au client, réponse. */
export function QuotePanel({
  projectId,
  projectTitle,
  quotes,
  currency,
  canEdit,
  hasAccount,
}: {
  projectId: string
  projectTitle: string
  quotes: QuoteRow[]
  currency: string
  canEdit: boolean
  /** Le client a un espace client : il y verra l'offre et pourra y répondre */
  hasAccount: boolean
}) {
  const { run, pending } = useServerAction()
  const [draft, setDraft] = React.useState<Draft | null>(null)
  const [sending, setSending] = React.useState<QuoteRow | null>(null)
  const [notify, setNotify] = React.useState(true)

  const blank = (): Draft => ({ id: null, title: `Offre de construction — ${projectTitle}`, items: [{ ...EMPTY_ITEM, section: "Gros œuvre" }], notes: "", validUntil: "" })
  const from = (q: QuoteRow, copy = false): Draft => ({
    id: copy ? null : q.id,
    title: q.title,
    items: q.items.map((i) => ({ ...i })),
    notes: q.notes ?? "",
    validUntil: copy ? "" : (q.validUntil?.slice(0, 10) ?? ""),
  })

  return (
    <div className="space-y-4">
      {quotes.length === 0 ? (
        <div className="rounded-xl border border-dashed px-5 py-10 text-center">
          <p className="text-sm font-medium">Aucune offre pour l&apos;instant</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Détaillez les travaux et leur prix. Une fois envoyée, l&apos;offre apparaît dans l&apos;espace du client ; son acceptation fixe le montant du contrat.
          </p>
          {canEdit && (
            <Button className="mt-4" onClick={() => setDraft(blank())}>
              <FilePlus2 />
              Préparer une offre
            </Button>
          )}
        </div>
      ) : (
        <>
          {canEdit && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setDraft(blank())}>
                <Plus />
                Nouvelle offre
              </Button>
            </div>
          )}
          <ul className="space-y-4">
            {quotes.map((q) => (
              <li key={q.id} className="overflow-hidden rounded-xl border">
                <div className="flex flex-wrap items-start justify-between gap-3 bg-muted/40 px-4 py-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {q.number}
                      <ToneBadge tone={QUOTE_STATUS[q.status].tone}>{QUOTE_STATUS[q.status].label}</ToneBadge>
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{q.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Créée le {formatDate(q.createdAt)}
                      {q.sentAt ? ` · envoyée le ${formatDate(q.sentAt)}` : ""}
                      {q.respondedAt ? ` · réponse le ${formatDate(q.respondedAt)}` : ""}
                      {q.validUntil && q.status !== "ACCEPTED" ? ` · valable jusqu'au ${formatDate(q.validUntil)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-bold tabular">{formatMoney(q.amount, currency)}</p>
                    {canEdit && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions sur l'offre ${q.number}`}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {q.status !== "ACCEPTED" && (
                            <DropdownMenuItem onSelect={() => setDraft(from(q))}>
                              <Pencil />
                              Modifier
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onSelect={() => setDraft(from(q, true))}>
                            <Copy />
                            Dupliquer (nouvelle version)
                          </DropdownMenuItem>
                          {q.status !== "ACCEPTED" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => confirm(`Supprimer l'offre ${q.number} ?`) && run(() => deleteQuote(q.id))}
                              >
                                <Trash2 />
                                Supprimer
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>

                <QuoteLines items={q.items} currency={currency} />
                {q.notes && <p className="border-t px-4 py-3 text-sm whitespace-pre-wrap text-muted-foreground">{q.notes}</p>}

                {canEdit && (q.status === "DRAFT" || q.status === "SENT") && (
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-muted/20 px-4 py-3">
                    {q.status === "DRAFT" ? (
                      <Button size="sm" onClick={() => setSending(q)}>
                        <Send />
                        Envoyer au client
                      </Button>
                    ) : (
                      <>
                        <span className="mr-auto text-xs text-muted-foreground">
                          {hasAccount ? "Le client peut répondre depuis son espace. Vous pouvez aussi saisir sa réponse :" : "Saisissez la réponse du client :"}
                        </span>
                        <Button size="sm" variant="outline" disabled={pending} onClick={() => confirm("Classer cette offre comme refusée ?") && run(() => answerQuote(q.id, false))}>
                          <X />
                          Refusée
                        </Button>
                        <Button
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            confirm(`Confirmer l'acceptation de l'offre ${q.number} ? Le montant du contrat sera fixé à ${formatMoney(q.amount, currency)}.`) &&
                            run(() => answerQuote(q.id, true))
                          }
                        >
                          <Check />
                          Acceptée
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {draft && <QuoteDialog projectId={projectId} draft={draft} currency={currency} onClose={() => setDraft(null)} />}

      <Dialog open={!!sending} onOpenChange={(open) => !open && setSending(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Envoyer l&apos;offre {sending?.number} ?</DialogTitle>
            <DialogDescription>
              {hasAccount
                ? "L'offre devient visible dans l'espace du client, qui pourra l'accepter ou la refuser en ligne."
                : "Ce client n'a pas encore d'espace client : l'offre sera marquée comme envoyée, à vous de la lui remettre."}
            </DialogDescription>
          </DialogHeader>
          <Label className="flex items-start gap-3 rounded-lg border p-3 font-normal">
            <Checkbox checked={notify} onCheckedChange={(v) => setNotify(!!v)} className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium">Prévenir le client par SMS</span>
              <span className="block text-xs text-muted-foreground">Numéro de l&apos;offre et montant{hasAccount ? ", avec le lien vers son espace" : ""}.</span>
            </span>
          </Label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSending(null)}>
              Annuler
            </Button>
            <Button disabled={pending} onClick={() => sending && run(() => sendQuote(sending.id, notify), { onSuccess: () => setSending(null) })}>
              {pending ? <Loader2 className="animate-spin" /> : <Send />}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function QuoteDialog({ projectId, draft, currency, onClose }: { projectId: string; draft: Draft; currency: string; onClose: () => void }) {
  const { run, pending } = useServerAction()
  const [title, setTitle] = React.useState(draft.title)
  const [items, setItems] = React.useState<QuoteItem[]>(draft.items.length ? draft.items : [{ ...EMPTY_ITEM }])
  const [notes, setNotes] = React.useState(draft.notes)
  const [validUntil, setValidUntil] = React.useState(draft.validUntil)

  const setItem = (index: number, patch: Partial<QuoteItem>) => setItems((list) => list.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  const total = quoteTotal(items)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const filled = items.filter((i) => i.label.trim())
    if (filled.length === 0) return toast.error("Ajoutez au moins une ligne avec sa désignation")
    run(() => saveQuote(projectId, { id: draft.id, title, items: filled, notes, validUntil: validUntil || null }), { onSuccess: onClose })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Modifier l'offre" : "Nouvelle offre de construction"}</DialogTitle>
            <DialogDescription>Regroupez les lignes par lot de travaux. L&apos;offre reste un brouillon tant que vous ne l&apos;envoyez pas.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
            <Field label="Intitulé">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </Field>
            <Field label="Valable jusqu'au">
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </Field>
          </div>

          <div className="space-y-3">
            <datalist id="quote-sections">
              {SECTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            {items.map((item, index) => (
              <div key={index} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[150px_1fr_84px_70px_130px_auto] sm:items-end sm:border-0 sm:p-0">
                <Field label={index === 0 ? "Lot de travaux" : ""} className={index > 0 ? "sm:[&>label]:hidden" : ""}>
                  <Input list="quote-sections" value={item.section} onChange={(e) => setItem(index, { section: e.target.value })} placeholder="Gros œuvre" aria-label="Lot de travaux" />
                </Field>
                <Field label={index === 0 ? "Désignation" : ""} className={index > 0 ? "sm:[&>label]:hidden" : ""}>
                  <Input value={item.label} onChange={(e) => setItem(index, { label: e.target.value })} placeholder="Fondations et soubassement" aria-label="Désignation" />
                </Field>
                <Field label={index === 0 ? "Quantité" : ""} className={index > 0 ? "sm:[&>label]:hidden" : ""}>
                  <Input
                    inputMode="decimal"
                    value={item.quantity || ""}
                    onChange={(e) => setItem(index, { quantity: Math.max(0, Number(e.target.value.replace(",", ".")) || 0) })}
                    className="tabular"
                    aria-label="Quantité"
                  />
                </Field>
                <Field label={index === 0 ? "Unité" : ""} className={index > 0 ? "sm:[&>label]:hidden" : ""}>
                  <Input value={item.unit} onChange={(e) => setItem(index, { unit: e.target.value })} placeholder="m²" aria-label="Unité" />
                </Field>
                <Field label={index === 0 ? "Prix unitaire" : ""} className={index > 0 ? "sm:[&>label]:hidden" : ""}>
                  <MoneyInput value={item.unitPrice || null} onChange={(v) => setItem(index, { unitPrice: v ?? 0 })} suffix="" aria-label="Prix unitaire" />
                </Field>
                <div className="flex items-center justify-between gap-2 sm:h-8">
                  <span className="text-sm font-semibold tabular sm:w-28 sm:text-right">{formatNumber(quoteLineTotal(item))}</span>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Retirer la ligne" disabled={items.length === 1} onClick={() => setItems((list) => list.filter((_, i) => i !== index))}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setItems((list) => [...list, { ...EMPTY_ITEM, section: list[list.length - 1]?.section ?? "" }])}>
                <Plus />
                Ajouter une ligne
              </Button>
              <p className="text-sm">
                Total : <strong className="text-lg tabular">{formatMoney(total, currency)}</strong>
              </p>
            </div>
          </div>

          <Field label="Conditions et précisions" hint="Délais, modalités de paiement, ce qui est inclus ou non…">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </Field>

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
