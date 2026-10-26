"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  ArrowRight,
  Bookmark,
  CheckCheck,
  Clock,
  ExternalLink,
  Inbox,
  Mail,
  MessageCircle,
  MessageSquareText,
  Phone,
  Search,
  Send,
  Sparkles,
  Trash2,
  Users,
  XCircle,
} from "lucide-react"
import type { LotStatus, RequestStatus } from "@/generated/prisma/enums"
import { formatArea, formatDateTime, formatMoney, formatRelative } from "@/lib/format"
import { CONTACT_PREFERENCE, REQUEST_STATUS } from "@/lib/labels"
import { formatPhone, whatsappLink } from "@/lib/phone"
import { cn } from "@/lib/utils"
import { useServerAction } from "@/hooks/use-server-action"
import { deleteRequest, proposeAlternativeLot, reserveRequestedLot, saveRequestNotes, setRequestStatus } from "@/app/admin/(app)/demandes/actions"
import { LotStatusBadge, ToneBadge } from "@/components/shared/badges"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type LotRef = { id: string; number: string; status: LotStatus; areaM2: number; price: number | null; block: string | null }

export type RequestItem = {
  id: string
  fullName: string
  phone: string
  email: string | null
  message: string | null
  preferredContact: string
  status: RequestStatus
  adminNotes: string | null
  createdAt: Date
  handledAt: Date | null
  lot: LotRef | null
  proposedLot: LotRef | null
  sale: { id: string; reference: string } | null
  buyerId: string | null
  lotDemand: number
}

type Props = {
  requests: RequestItem[]
  availableLots: LotRef[]
  currency: string
  companyName: string
  appUrl: string
  canEdit: boolean
  initialId?: string
}

const ACTIVE: RequestStatus[] = ["NEW", "CONTACTED", "ALTERNATIVE_PROPOSED"]
const ARCHIVE: RequestStatus[] = ["CONVERTED", "DECLINED"]
const ORDER: RequestStatus[] = [...ACTIVE, ...ARCHIVE]

const firstName = (name: string) => name.split(/\s+/)[0]

const COLUMN_TITLE: Record<RequestStatus, string> = {
  NEW: "Nouvelles",
  CONTACTED: "Contactées",
  ALTERNATIVE_PROPOSED: "Autre terrain proposé",
  CONVERTED: "Converties en vente",
  DECLINED: "Sans suite",
}

export function RequestsBoard({ requests, availableLots, currency, companyName, appUrl, canEdit, initialId }: Props) {
  const [query, setQuery] = React.useState("")
  const [tab, setTab] = React.useState<RequestStatus>("NEW")
  const [openId, setOpenId] = React.useState<string | null>(initialId ?? null)
  const router = useRouter()
  const pathname = usePathname()

  const filtered = React.useMemo(() => {
    const q = query.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    if (!q) return requests
    return requests.filter((r) =>
      [r.fullName, r.phone, r.email, r.lot?.number, r.message].filter(Boolean).join(" ").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(q),
    )
  }, [requests, query])

  const by = (s: RequestStatus) => filtered.filter((r) => r.status === s)
  const open = requests.find((r) => r.id === openId) ?? null

  function openRequest(id: string | null) {
    setOpenId(id)
    if (!id && initialId) router.replace(pathname, { scroll: false })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative md:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom, téléphone, n° de terrain…" className="h-9 pl-9" />
        </div>
        {/* Onglets (mobile et tablette) */}
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0 xl:hidden">
          {ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setTab(s)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium",
                tab === s ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
              )}
            >
              {COLUMN_TITLE[s]}
              <span className="tabular opacity-70">{by(s).length}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Liste (mobile et tablette) */}
      <div className="grid gap-3 md:grid-cols-2 xl:hidden">
        {by(tab).length === 0 ? (
          <EmptyColumn status={tab} />
        ) : (
          by(tab).map((r) => <RequestCard key={r.id} request={r} onOpen={() => openRequest(r.id)} canEdit={canEdit} />)
        )}
      </div>

      {/* Tableau Kanban (grand écran) */}
      <div className="hidden gap-4 xl:grid xl:grid-cols-3">
        {ACTIVE.map((s) => (
          <section key={s} className="flex min-h-64 flex-col rounded-2xl border bg-muted/40 p-3">
            <header className="mb-3 flex items-center justify-between px-1">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <span className={cn("size-2 rounded-full", s === "NEW" ? "bg-gold" : s === "CONTACTED" ? "bg-primary" : "bg-status-reserved")} />
                {COLUMN_TITLE[s]}
              </h2>
              <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold tabular">{by(s).length}</span>
            </header>
            <div className="space-y-3">
              {by(s).length === 0 ? (
                <EmptyColumn status={s} compact />
              ) : (
                by(s).map((r) => <RequestCard key={r.id} request={r} onOpen={() => openRequest(r.id)} canEdit={canEdit} />)
              )}
            </div>
          </section>
        ))}
      </div>
      <div className="hidden gap-4 xl:grid xl:grid-cols-2">
        {ARCHIVE.map((s) => (
          <section key={s} className="rounded-2xl border bg-card">
            <header className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold">{COLUMN_TITLE[s]}</h2>
              <span className="text-xs text-muted-foreground tabular">{by(s).length}</span>
            </header>
            {by(s).length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">Aucune demande.</p>
            ) : (
              <ul className="max-h-72 divide-y overflow-y-auto">
                {by(s).map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => openRequest(r.id)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{r.fullName}</span>
                        <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                          {r.lot ? `Terrain n° ${r.lot.number} · ` : ""}
                          {formatRelative(r.createdAt)}
                        </span>
                      </span>
                      {r.sale && <span className="text-xs font-semibold text-primary">{r.sale.reference}</span>}
                      <ArrowRight className="size-4 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <RequestSheet
        request={open}
        onClose={() => openRequest(null)}
        availableLots={availableLots}
        currency={currency}
        companyName={companyName}
        appUrl={appUrl}
        canEdit={canEdit}
      />
    </div>
  )
}

function EmptyColumn({ status, compact }: { status: RequestStatus; compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/60 px-4 text-center text-sm text-muted-foreground md:col-span-2",
        compact ? "py-8" : "py-14",
      )}
    >
      <Inbox className="mb-2 size-5" />
      {status === "NEW" ? "Aucune nouvelle demande. Tout est traité 👌" : "Aucune demande ici."}
    </div>
  )
}

function ContactIcon({ value }: { value: string }) {
  const Icon = value === "WHATSAPP" ? MessageCircle : value === "EMAIL" ? Mail : Phone
  return <Icon className="size-3.5" />
}

function RequestCard({ request: r, onOpen, canEdit }: { request: RequestItem; onOpen: () => void; canEdit: boolean }) {
  const { run, pending } = useServerAction()
  const lotTaken = r.lot && r.lot.status !== "AVAILABLE" && r.status !== "CONVERTED"
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="group cursor-pointer rounded-xl border bg-card p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{r.fullName}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground" suppressHydrationWarning>
            <Clock className="size-3" />
            {formatRelative(r.createdAt)}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
          <ContactIcon value={r.preferredContact} />
          {CONTACT_PREFERENCE[r.preferredContact] ?? r.preferredContact}
        </span>
      </div>

      {r.lot && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">Terrain n° {r.lot.number}</span>
          <LotStatusBadge status={r.lot.status} className="h-5 px-2 text-[0.68rem]" />
          {r.lotDemand > 1 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold-strong">
              <Users className="size-3.5" />
              {r.lotDemand} intéressés
            </span>
          )}
        </div>
      )}
      {lotTaken && <p className="mt-1 text-xs font-medium text-status-sold-strong">Ce terrain n&apos;est plus disponible : proposez-en un autre.</p>}
      {r.proposedLot && r.status === "ALTERNATIVE_PROPOSED" && (
        <p className="mt-1 text-xs text-muted-foreground">
          Proposé : <strong className="text-foreground">n° {r.proposedLot.number}</strong>
        </p>
      )}
      {r.message && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">« {r.message} »</p>}

      <div className="mt-3 flex items-center gap-1.5 border-t pt-3" onClick={(e) => e.stopPropagation()}>
        <Button variant="outline" size="icon-sm" asChild>
          <a href={`tel:${r.phone}`} aria-label={`Appeler ${r.fullName}`}>
            <Phone />
          </a>
        </Button>
        <Button variant="outline" size="icon-sm" asChild>
          <a href={whatsappLink(r.phone, `Bonjour ${firstName(r.fullName)},`)} target="_blank" rel="noreferrer" aria-label="WhatsApp">
            <MessageCircle />
          </a>
        </Button>
        <span className="truncate text-xs text-muted-foreground tabular">{formatPhone(r.phone)}</span>
        {canEdit && r.status === "NEW" && (
          <Button size="sm" variant="secondary" className="ml-auto" disabled={pending} onClick={() => run(() => setRequestStatus(r.id, "CONTACTED"))}>
            <CheckCheck /> Contacté
          </Button>
        )}
      </div>
    </article>
  )
}

type SheetProps = {
  onClose: () => void
  availableLots: LotRef[]
  currency: string
  companyName: string
  appUrl: string
  canEdit: boolean
}

function RequestSheet({ request, ...props }: SheetProps & { request: RequestItem | null }) {
  return (
    <Sheet open={!!request} onOpenChange={(o) => !o && props.onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        {request && <RequestDetail key={request.id} request={request} {...props} />}
      </SheetContent>
    </Sheet>
  )
}

/** Contenu de la fiche (remonté pour chaque demande : l'état local repart de zéro). */
function RequestDetail({ request, onClose, availableLots, currency, companyName, appUrl, canEdit }: SheetProps & { request: RequestItem }) {
  const { run, pending } = useServerAction()
  const [notes, setNotes] = React.useState(request.adminNotes ?? "")
  const [proposing, setProposing] = React.useState(false)
  const [lotId, setLotId] = React.useState<string>("")
  const [message, setMessage] = React.useState("")
  const proposed = availableLots.find((l) => l.id === lotId)

  function pickLot(id: string) {
    setLotId(id)
    const l = availableLots.find((x) => x.id === id)
    if (!l) return
    setMessage(
      `Bonjour ${firstName(request.fullName)}, merci pour votre intérêt pour ${companyName}. ${
        request.lot && request.lot.status !== "AVAILABLE" ? `Le terrain n° ${request.lot.number} n'étant plus disponible, nous` : "Nous"
      } vous proposons le terrain n° ${l.number} (${formatArea(l.areaM2)}${l.price ? `, ${formatMoney(l.price, currency)}` : ""}). Détails : ${appUrl}/terrains/${encodeURIComponent(l.number)}`,
    )
  }

  const lot = request.proposedLot && request.status === "ALTERNATIVE_PROPOSED" ? request.proposedLot : request.lot
  const canReserve = lot && lot.status === "AVAILABLE" && request.status !== "CONVERTED"

  return (
    <>
      <SheetHeader className="border-b bg-muted/30 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <ToneBadge tone={REQUEST_STATUS[request.status].tone}>{REQUEST_STATUS[request.status].label}</ToneBadge>
          <span className="text-xs text-muted-foreground">Reçue le {formatDateTime(request.createdAt)}</span>
        </div>
        <SheetTitle className="text-xl">{request.fullName}</SheetTitle>
        <SheetDescription className="flex items-center gap-1.5">
          <ContactIcon value={request.preferredContact} />
          Contact préféré : {CONTACT_PREFERENCE[request.preferredContact] ?? "Appel téléphonique"}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-6 p-5">
        {/* Coordonnées */}
        <div className="space-y-3">
          <p className="text-lg font-semibold tabular">{formatPhone(request.phone)}</p>
          {request.email && <p className="text-sm text-muted-foreground">{request.email}</p>}
          <div className="flex flex-wrap gap-2 [&>*]:flex-1">
            <Button variant="outline" asChild>
              <a href={`tel:${request.phone}`}>
                <Phone /> Appeler
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={whatsappLink(request.phone, `Bonjour ${firstName(request.fullName)},`)} target="_blank" rel="noreferrer">
                <MessageCircle /> WhatsApp
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={`sms:${request.phone}`}>
                <MessageSquareText /> SMS
              </a>
            </Button>
            {request.email && (
              <Button variant="outline" asChild>
                <a href={`mailto:${request.email}`}>
                  <Mail /> E-mail
                </a>
              </Button>
            )}
          </div>
        </div>

        {request.message && <blockquote className="rounded-xl border-l-4 border-gold bg-gold/10 px-4 py-3 text-sm italic">{request.message}</blockquote>}

        {/* Terrain */}
        {lot && (
          <div className="rounded-xl border p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase">
              {request.status === "ALTERNATIVE_PROPOSED" && request.proposedLot ? "Terrain proposé" : "Terrain demandé"}
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-lg font-bold">Terrain n° {lot.number}</p>
                <p className="text-sm text-muted-foreground tabular">
                  {formatArea(lot.areaM2)}
                  {lot.price ? ` · ${formatMoney(lot.price, currency)}` : ""}
                </p>
              </div>
              <LotStatusBadge status={lot.status} />
            </div>
            {request.lot && request.status === "ALTERNATIVE_PROPOSED" && request.proposedLot && (
              <p className="mt-2 text-xs text-muted-foreground">Demande initiale : terrain n° {request.lot.number}</p>
            )}
            {request.lotDemand > 1 && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-gold-strong">
                <Users className="size-3.5" /> {request.lotDemand} personnes intéressées par ce terrain
              </p>
            )}
            <Link href={`/admin/terrains/${lot.id}`} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Fiche du terrain <ExternalLink className="size-3.5" />
            </Link>
          </div>
        )}

        {request.status === "CONVERTED" && request.sale && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-status-available/30 bg-status-available/10 p-4 text-sm">
            <span>
              Convertie en vente <strong>{request.sale.reference}</strong>
            </span>
            <Button size="sm" asChild>
              <Link href={`/admin/ventes/${request.sale.id}`}>Voir la vente</Link>
            </Button>
          </div>
        )}

        {canEdit && request.status !== "CONVERTED" && (
          <>
            {/* Actions principales */}
            <div className="space-y-2">
              <Button className="h-10 w-full" asChild>
                <Link href={`/admin/ventes/nouvelle?request=${request.id}`}>
                  <Sparkles /> Valider et créer la vente
                </Link>
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setProposing((v) => !v)}>
                  <Send /> Autre terrain
                </Button>
                <Button variant="outline" disabled={!canReserve || pending} onClick={() => run(() => reserveRequestedLot(request.id))}>
                  <Bookmark /> Poser une option
                </Button>
              </div>
            </div>

            {proposing && (
              <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
                <p className="text-sm font-semibold">Proposer un autre terrain</p>
                <Select value={lotId} onValueChange={pickLot}>
                  <SelectTrigger className="h-9 w-full bg-background">
                    <SelectValue placeholder="Choisir un terrain disponible" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {availableLots.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        N° {l.number}
                        {l.block ? ` · îlot ${l.block}` : ""} · {formatArea(l.areaM2)}
                        {l.price ? ` · ${formatMoney(l.price, currency)}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {proposed && (
                  <>
                    <Textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} className="bg-background text-sm" />
                    <p className="text-right text-xs text-muted-foreground tabular">{message.length} caractères</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        asChild
                        onClick={() => run(() => proposeAlternativeLot(request.id, { lotId }), { success: "Proposition enregistrée" })}
                      >
                        <a href={whatsappLink(request.phone, message)} target="_blank" rel="noreferrer">
                          <MessageCircle /> Via WhatsApp
                        </a>
                      </Button>
                      <Button disabled={pending} onClick={() => run(() => proposeAlternativeLot(request.id, { lotId, sms: message }))}>
                        {pending ? <Spinner /> : <Send />} Envoyer par SMS
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Statut */}
            <div className="flex flex-wrap gap-2">
              {request.status !== "CONTACTED" && (
                <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => setRequestStatus(request.id, "CONTACTED"))}>
                  <CheckCheck /> Marquer contacté
                </Button>
              )}
              {request.status !== "DECLINED" ? (
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => setRequestStatus(request.id, "DECLINED"))}>
                  <XCircle /> Sans suite
                </Button>
              ) : (
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => setRequestStatus(request.id, "NEW"))}>
                  Rouvrir la demande
                </Button>
              )}
            </div>
          </>
        )}

        {/* Notes */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">Notes internes</p>
          <Textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Compte rendu d'appel, disponibilités, budget…"
            disabled={!canEdit}
          />
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending || notes === (request.adminNotes ?? "")}
              onClick={() => run(() => saveRequestNotes(request.id, notes))}
            >
              Enregistrer les notes
            </Button>
          )}
        </div>

        {canEdit && request.status !== "CONVERTED" && (
          <div className="border-t pt-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={pending}
              onClick={() => window.confirm("Supprimer définitivement cette demande ?") && run(() => deleteRequest(request.id), { onSuccess: onClose })}
            >
              <Trash2 /> Supprimer (spam, doublon…)
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
