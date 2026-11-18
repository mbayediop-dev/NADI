import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { AlertTriangle, ArrowLeft, CalendarDays, Camera, Check, CheckCircle2, FileText, FolderOpen, ListChecks, Paperclip, ReceiptText, Wallet } from "lucide-react"
import { requireBuyer } from "@/lib/auth/client"
import { landLabel } from "@/lib/construction"
import { formatDate, formatMoney } from "@/lib/format"
import { CONSTRUCTION_FLOW, CONSTRUCTION_STATUS, EXPENSE_CATEGORY, MILESTONE_STATUS, PAYMENT_METHOD, QUOTE_STATUS } from "@/lib/labels"
import { getBuyerProject } from "@/lib/queries/construction"
import { getSettings } from "@/lib/settings"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { ToneBadge } from "@/components/shared/badges"
import { ExpenseBreakdown, QuoteLines } from "@/components/shared/construction-bits"
import { ScheduleTable } from "@/components/shared/schedule-table"
import { PortalCard } from "@/components/portal/card"
import { ContactButtons } from "@/components/portal/contact-buttons"
import { DocumentItem } from "@/components/portal/document-item"
import { MediaGallery } from "@/components/portal/media-gallery"
import { ProgressRing } from "@/components/portal/progress-ring"
import { ClientDocumentUpload, QuoteResponse } from "@/components/portal/construction/client-actions"

export const metadata: Metadata = { title: "Mon projet de construction" }

export default function ProjectPage({ params }: PageProps<"/espace-client/construction/[id]">) {
  return (
    <div className="space-y-5">
      <Link href="/espace-client/construction" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Construction
      </Link>
      <Suspense fallback={<Skeleton className="h-[640px] rounded-3xl" />}>
        <Content params={params} />
      </Suspense>
    </div>
  )
}

async function Content({ params }: { params: PageProps<"/espace-client/construction/[id]">["params"] }) {
  const buyer = await requireBuyer()
  const [{ id }, settings] = await Promise.all([params, getSettings()])
  const project = await getBuyerProject(buyer.id, id)
  if (!project || project.status === "CANCELLED") notFound()

  const { summary } = project
  const { finance } = summary
  const currency = settings.currencyLabel
  const hasContract = !!project.contractAmount
  const pending = project.quotes.filter((q) => q.status === "SENT")
  const answered = project.quotes.filter((q) => q.status !== "SENT")
  const step = project.status === "SUSPENDED" ? CONSTRUCTION_FLOW.indexOf("IN_PROGRESS") : CONSTRUCTION_FLOW.indexOf(project.status)
  const contact = { company: settings.companyName, phone: settings.companyPhone, whatsapp: settings.companyWhatsapp, email: settings.companyEmail }

  return (
    <div className="space-y-5 md:space-y-6">
      {/* En-tête : projet, étape, avancement, situation financière */}
      <section className="relative isolate overflow-hidden rounded-3xl bg-pine-deep p-5 text-white shadow-lg sm:p-7">
        <div aria-hidden className="bg-grain pointer-events-none absolute inset-0 -z-10 opacity-60" />
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">Projet {project.reference}</p>
            <h1 className="mt-1 text-2xl leading-tight font-bold tracking-tight sm:text-3xl">{project.title}</h1>
            <p className="mt-1.5 text-sm text-white/75">{landLabel(project)}</p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-sm font-semibold">
              <span className="size-2 rounded-full bg-gold" />
              {CONSTRUCTION_STATUS[project.status].label}
            </p>
            {(project.startDate || project.plannedEndDate) && (
              <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/75">
                <CalendarDays className="size-4" />
                {project.startDate && <span>Début : {formatDate(project.startDate)}</span>}
                {project.plannedEndDate && <span>Livraison prévue : {formatDate(project.plannedEndDate)}</span>}
              </p>
            )}
          </div>
          <div className="flex items-center gap-5 md:gap-7">
            <ProgressRing value={summary.progress / 100} size={120} stroke={11}>
              <div>
                <p className="text-2xl leading-none font-bold tabular">{summary.progress} %</p>
                <p className="mt-1 text-[0.65rem] font-semibold tracking-wide text-white/65 uppercase">Chantier</p>
              </div>
            </ProgressRing>
            {hasContract && (
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-white/60">Montant du contrat</dt>
                  <dd className="text-base font-bold tabular">{formatMoney(summary.contract, currency)}</dd>
                </div>
                <div>
                  <dt className="text-white/60">Déjà versé</dt>
                  <dd className="font-semibold tabular">{formatMoney(finance.totalPaid, currency)}</dd>
                </div>
                <div>
                  <dt className="text-white/60">Reste à payer</dt>
                  <dd className="font-semibold tabular">{formatMoney(finance.remaining, currency)}</dd>
                </div>
              </dl>
            )}
          </div>
        </div>
      </section>

      {/* Déroulé du projet */}
      <ol className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-6 sm:gap-3 sm:px-0" aria-label="Étapes du projet">
        {CONSTRUCTION_FLOW.map((status, index) => {
          const done = index < step
          const current = index === step
          return (
            <li
              key={status}
              aria-current={current ? "step" : undefined}
              className={cn(
                "flex min-w-36 shrink-0 items-center gap-2.5 rounded-2xl border px-3 py-2.5 sm:min-w-0",
                current ? "border-primary bg-primary/5" : done ? "bg-card" : "bg-card/60 text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold",
                  done ? "bg-status-available text-white" : current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span className="text-xs leading-tight font-semibold">{CONSTRUCTION_STATUS[status].step}</span>
            </li>
          )
        })}
      </ol>

      {project.status === "SUSPENDED" && (
        <Notice icon={AlertTriangle} tone="danger">
          <strong>Le chantier est momentanément suspendu.</strong> Contactez-nous pour en connaître la raison et la date de reprise.
        </Notice>
      )}
      {project.status === "REQUESTED" && (
        <Notice icon={CheckCircle2} tone="success">
          <strong>Votre demande est bien enregistrée.</strong> Notre équipe l&apos;étudie et vous contacte pour préciser votre projet ; votre offre détaillée apparaîtra ici.
        </Notice>
      )}
      {finance.overdueAmount > 0 && (
        <Notice icon={AlertTriangle} tone="danger">
          <strong>{formatMoney(finance.overdueAmount, currency)} en retard</strong> ({finance.overdueCount} appel{finance.overdueCount > 1 ? "s" : ""} de fonds). Merci de
          régulariser pour ne pas ralentir le chantier.
        </Notice>
      )}

      {/* Offre en attente de réponse */}
      {pending.map((quote) => (
        <PortalCard key={quote.id} title={`Votre offre ${quote.number}`} icon={FileText} className="border-gold/50 ring-1 ring-gold/30" bodyClassName="space-y-4 px-0 pb-5">
          <div className="flex flex-col gap-2 px-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-semibold">{quote.title}</p>
              <p className="text-sm text-muted-foreground">
                Reçue le {formatDate(quote.sentAt ?? quote.createdAt)}
                {quote.validUntil ? ` · valable jusqu'au ${formatDate(quote.validUntil)}` : ""}
              </p>
            </div>
            <p className="text-2xl font-bold tabular">{formatMoney(quote.amount, currency)}</p>
          </div>
          <QuoteLines items={quote.items} currency={currency} />
          {quote.notes && <p className="px-5 text-sm whitespace-pre-wrap text-muted-foreground">{quote.notes}</p>}
          <div className="px-5">
            <QuoteResponse quoteId={quote.id} number={quote.number} amount={quote.amount} currency={currency} />
          </div>
        </PortalCard>
      ))}

      <div className="grid grid-cols-1 items-start gap-5 md:gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5 md:space-y-6">
          {/* Étapes du chantier */}
          <PortalCard title="Étapes du chantier" icon={ListChecks} bodyClassName="pt-3">
            {project.phases.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Les étapes de votre chantier apparaîtront ici dès son lancement.</p>
            ) : (
              <ol className="space-y-4">
                {project.phases.map((phase, index) => (
                  <li key={phase.id} className="flex gap-3">
                    <span
                      className={cn(
                        "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold tabular",
                        phase.status === "DONE" ? "bg-status-available text-white" : phase.status === "IN_PROGRESS" ? "bg-gold text-gold-foreground" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {phase.status === "DONE" ? <Check className="size-4" /> : index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <p className={cn("font-semibold", phase.status === "PLANNED" && "text-muted-foreground")}>{phase.title}</p>
                        <span className="text-sm font-semibold tabular">{phase.progress} %</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full", phase.status === "DONE" ? "bg-status-available" : "bg-gold")} style={{ width: `${phase.progress}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {MILESTONE_STATUS[phase.status].label}
                        {phase.startDate || phase.endDate ? ` · ${phase.startDate ? formatDate(phase.startDate) : "…"} → ${phase.endDate ? formatDate(phase.endDate) : "…"}` : ""}
                      </p>
                      {phase.description && <p className="mt-1 text-sm text-muted-foreground">{phase.description}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </PortalCard>

          {/* Journal de chantier */}
          <PortalCard title="Nouvelles du chantier" icon={Camera} bodyClassName="pt-3">
            {project.updates.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Les photos et nouvelles de votre chantier seront publiées ici.</p>
            ) : (
              <ul className="space-y-6">
                {project.updates.map((update) => (
                  <li key={update.id} className="border-b pb-6 last:border-0 last:pb-0">
                    <p className="text-xs font-medium text-muted-foreground">
                      {formatDate(update.publishedAt)}
                      {update.phase ? ` · ${update.phase.title}` : ""}
                    </p>
                    <p className="mt-0.5 text-base font-bold">{update.title}</p>
                    {update.body && <p className="mt-1.5 text-sm whitespace-pre-wrap text-muted-foreground">{update.body}</p>}
                    {update.media.length > 0 && (
                      <div className="mt-3">
                        <MediaGallery media={update.media.map((m) => ({ id: m.id, type: m.type, url: `/api/construction/media/${m.id}`, caption: m.caption }))} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </PortalCard>

          {/* Paiements */}
          {(project.installments.length > 0 || project.payments.length > 0) && (
            <PortalCard title="Mes paiements" icon={Wallet} bodyClassName="space-y-5 pt-3">
              {project.installments.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">Appels de fonds</h3>
                  <ScheduleTable rows={finance.rows} currency={currency} />
                </div>
              )}
              <div>
                <h3 className="mb-1 text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">Versements reçus</h3>
                {project.payments.length === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">Aucun versement enregistré pour le moment.</p>
                ) : (
                  <ul className="divide-y">
                    {project.payments.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold tabular">{formatMoney(p.amount, currency)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(p.paidAt)} · {PAYMENT_METHOD[p.method]} · {p.receiptNumber}
                          </p>
                        </div>
                        <Link
                          href={`/espace-client/construction/recus/${p.id}`}
                          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-primary/10 px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/15"
                        >
                          <ReceiptText className="size-4" />
                          Reçu
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </PortalCard>
          )}

          {/* Dépenses partagées */}
          {project.showExpensesToClient && project.expenses.length > 0 && (
            <PortalCard title="Dépenses de votre chantier" icon={ReceiptText} bodyClassName="space-y-5 pt-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm text-muted-foreground">Ce qui a été acheté et réglé pour votre maison, en toute transparence.</p>
                <p className="text-lg font-bold tabular">{formatMoney(summary.spent, currency)}</p>
              </div>
              <ExpenseBreakdown items={summary.byCategory} currency={currency} />
              <ul className="divide-y border-t">
                {project.expenses.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 py-3">
                    <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: EXPENSE_CATEGORY[e.category].color }} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{e.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(e.spentAt)} · {EXPENSE_CATEGORY[e.category].label}
                        {e.supplier ? ` · ${e.supplier}` : ""}
                        {e.phase ? ` · ${e.phase.title}` : ""}
                      </p>
                      {e.attachmentKey && (
                        <a href={`/api/construction/expenses/${e.id}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                          <Paperclip className="size-3.5" />
                          Voir le justificatif
                        </a>
                      )}
                    </div>
                    <p className="font-semibold whitespace-nowrap tabular">{formatMoney(e.amount, currency)}</p>
                  </li>
                ))}
              </ul>
            </PortalCard>
          )}

          {/* Offres déjà traitées */}
          {answered.length > 0 && (
            <PortalCard title="Mes offres" icon={FileText} bodyClassName="space-y-4 px-0 pt-3 pb-2">
              {answered.map((quote) => (
                <details key={quote.id} className="group border-b last:border-0" open={quote.status === "ACCEPTED" && answered.length === 1}>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-5 pb-3 [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2 font-semibold">
                        {quote.number}
                        <ToneBadge tone={QUOTE_STATUS[quote.status].tone}>{QUOTE_STATUS[quote.status].label}</ToneBadge>
                      </span>
                      <span className="block text-sm text-muted-foreground">{quote.title}</span>
                    </span>
                    <span className="text-right">
                      <span className="block text-lg font-bold tabular">{formatMoney(quote.amount, currency)}</span>
                      <span className="text-xs font-medium text-primary group-open:hidden">Voir le détail</span>
                    </span>
                  </summary>
                  <QuoteLines items={quote.items} currency={currency} />
                  {quote.notes && <p className="px-5 py-3 text-sm whitespace-pre-wrap text-muted-foreground">{quote.notes}</p>}
                </details>
              ))}
            </PortalCard>
          )}
        </div>

        <div className="min-w-0 space-y-5 md:space-y-6">
          <PortalCard title="Documents" icon={FolderOpen} bodyClassName="space-y-4 pt-2">
            {project.documents.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">Vos plans, votre permis de construire et votre contrat seront déposés ici.</p>
            ) : (
              <ul className="divide-y">
                {project.documents.map((doc) => (
                  <DocumentItem key={doc.id} doc={doc} compact subtitle={doc.fromClient ? "Envoyé par vous" : undefined} />
                ))}
              </ul>
            )}
            <ClientDocumentUpload projectId={project.id} />
          </PortalCard>

          {(project.houseModel || project.requirements) && (
            <PortalCard title="Ma maison" bodyClassName="space-y-3 pt-3 text-sm">
              {project.houseModel && (
                <p>
                  <span className="text-muted-foreground">Modèle :</span> <span className="font-semibold">{project.houseModel.name}</span>
                  {project.customPlan ? " (adapté sur mesure)" : ""}
                </p>
              )}
              {!project.houseModel && project.customPlan && <p className="font-semibold">Plan sur mesure</p>}
              {project.requirements && <p className="whitespace-pre-wrap text-muted-foreground">{project.requirements}</p>}
            </PortalCard>
          )}

          <PortalCard title="Une question sur votre chantier ?" bodyClassName="pt-3">
            <ContactButtons contact={contact} />
          </PortalCard>
        </div>
      </div>
    </div>
  )
}

function Notice({ icon: Icon, tone, children }: { icon: typeof AlertTriangle; tone: "danger" | "success"; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm",
        tone === "danger" ? "bg-status-sold/10 text-status-sold-strong" : "bg-status-available/10 text-status-available-strong",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  )
}
