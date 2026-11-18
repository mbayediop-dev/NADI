import { Suspense } from "react"
import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { AlertTriangle, ArrowUpRight, Ban, CheckCircle2, Coins, FileText, HardHat, Inbox, Mail, Phone, ReceiptText, TrendingUp, UserRoundX, Wallet } from "lucide-react"
import { hasRole, requireAdmin } from "@/lib/auth/admin"
import { isUnderContract, landLabel } from "@/lib/construction"
import { formatArea, formatDate, formatDateLong, formatMoney, formatPercent, fullName } from "@/lib/format"
import { CONSTRUCTION_STATUS, LAND_ORIGIN } from "@/lib/labels"
import { formatPhone } from "@/lib/phone"
import { getProjectDetail, getProjectFormOptions } from "@/lib/queries/construction"
import { getSettings } from "@/lib/settings"
import { PageHeader } from "@/components/admin/page-header"
import { StatCard } from "@/components/admin/stat-card"
import { Amount } from "@/components/admin/sales/amount"
import { Card } from "@/components/admin/sales/card"
import { PaymentProgress } from "@/components/admin/sales/payment-progress"
import { ToneBadge } from "@/components/shared/badges"
import { ScheduleTable } from "@/components/shared/schedule-table"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ExpenseBreakdown, ExpenseList, NewExpenseButton } from "@/components/admin/construction/expenses"
import { ConstructionPayments, RecordPaymentButton, ScheduleEditor } from "@/components/admin/construction/finance-panel"
import { JournalPanel } from "@/components/admin/construction/journal-panel"
import { PhasesPanel } from "@/components/admin/construction/phases-panel"
import { AttachBuyerButton, ProjectActions, ProjectNotes } from "@/components/admin/construction/project-actions"
import { ProjectDocuments } from "@/components/admin/construction/project-documents"
import { QuotePanel } from "@/components/admin/construction/quote-panel"

export const metadata: Metadata = { title: "Projet de construction" }

export default function ProjectPage({ params, searchParams }: PageProps<"/admin/construction/[id]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <ProjectContent params={params} searchParams={searchParams} />
    </Suspense>
  )
}

const TABS = ["suivi", "offre", "finances", "documents"] as const

async function ProjectContent({ params, searchParams }: Pick<PageProps<"/admin/construction/[id]">, "params" | "searchParams">) {
  const admin = await requireAdmin()
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const [project, settings, options] = await Promise.all([getProjectDetail(id), getSettings(), getProjectFormOptions()])
  if (!project) notFound()

  const { summary, buyer, lot, houseModel } = project
  const { finance } = summary
  const currency = settings.currencyLabel
  const canEdit = hasRole(admin, "ADMIN")
  const today = format(new Date(), "yyyy-MM-dd")
  const tab = TABS.find((t) => t === sp.onglet) ?? (project.status === "REQUESTED" || project.status === "STUDY" || project.status === "OFFER_SENT" ? "offre" : "suivi")
  const clientName = buyer ? fullName(buyer) : project.contactName
  const phone = buyer?.phone ?? project.contactPhone
  const email = buyer?.email ?? project.contactEmail
  const underContract = isUnderContract(project.status)
  const hasContract = !!project.contractAmount
  const accepted = project.quotes.find((q) => q.status === "ACCEPTED")
  const phasesDone = project.phases.filter((p) => p.status === "DONE").length
  const currentPhase = project.phases.find((p) => p.status === "IN_PROGRESS")
  const sharedDocs = project.documents.filter((d) => d.visibility !== "PRIVATE").length

  const paymentContext = {
    projectId: project.id,
    clientName,
    remaining: hasContract ? finance.remaining : null,
    nextDue: finance.nextDue?.remaining ?? null,
    currency,
    today,
    smsDefault: settings.smsOnPayment,
  }
  const expenseContext = {
    currency,
    today,
    fixedProject: { id: project.id, label: `${project.reference} — ${project.title}`, phases: project.phases.map((p) => ({ id: p.id, title: p.title })) },
  }

  return (
    <>
      <PageHeader
        back={{ href: "/admin/construction", label: "Construction" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {project.title}
            <ToneBadge tone={CONSTRUCTION_STATUS[project.status].tone}>{CONSTRUCTION_STATUS[project.status].label}</ToneBadge>
          </span>
        }
        description={
          <>
            Projet {project.reference} · {landLabel(project)} — pour{" "}
            {buyer ? (
              <Link href={`/admin/acheteurs/${buyer.id}`} className="font-medium text-foreground hover:underline">
                {clientName}
              </Link>
            ) : (
              <span className="font-medium text-foreground">{clientName}</span>
            )}
            , ouvert le {formatDateLong(project.createdAt)}
          </>
        }
        actions={
          canEdit ? (
            <ProjectActions
              currency={currency}
              lots={options.lots}
              models={options.models}
              canDelete={project.payments.length === 0 && project.expenses.length === 0}
              project={{
                id: project.id,
                reference: project.reference,
                status: project.status,
                buyerId: project.buyerId,
                land: {
                  landOrigin: project.landOrigin,
                  lotId: project.lotId,
                  landAddress: project.landAddress ?? "",
                  landAreaM2: project.landAreaM2,
                  landReference: project.landReference ?? "",
                },
                house: {
                  title: project.title,
                  houseModelId: project.houseModelId,
                  customPlan: project.customPlan,
                  requirements: project.requirements ?? "",
                  budget: project.budget,
                },
                contractAmount: project.contractAmount,
                startDate: project.startDate ? format(project.startDate, "yyyy-MM-dd") : "",
                plannedEndDate: project.plannedEndDate ? format(project.plannedEndDate, "yyyy-MM-dd") : "",
                showExpensesToClient: project.showExpensesToClient,
              }}
            />
          ) : undefined
        }
      />

      {project.status === "CANCELLED" && (
        <Banner icon={Ban} tone="muted">
          <strong>Projet classé sans suite</strong> le {formatDate(project.cancelledAt)}. {project.cancelReason && <>Motif : {project.cancelReason}.</>}
        </Banner>
      )}
      {project.status === "REQUESTED" && (
        <Banner icon={Inbox} tone="gold">
          <strong>Nouvelle demande</strong> reçue {project.source === "SITE" ? "depuis le site" : project.source === "PORTAL" ? "depuis l'espace client" : "à l'accueil"}.
          Contactez le client, puis démarrez l&apos;étude pour préparer son offre.
        </Banner>
      )}
      {!buyer && project.status !== "CANCELLED" && (
        <Banner icon={UserRoundX} tone="gold" action={canEdit ? <AttachBuyerButton projectId={project.id} contact={{ name: project.contactName, phone: project.contactPhone, email: project.contactEmail }} /> : null}>
          <strong>Ce demandeur n&apos;a pas encore d&apos;espace client.</strong> Rattachez-le à une fiche client pour qu&apos;il suive son offre, ses versements et son chantier en
          ligne.
        </Banner>
      )}
      {finance.overdueAmount > 0 && (
        <Banner icon={AlertTriangle} tone="danger">
          <strong className="text-status-sold-strong">{formatMoney(finance.overdueAmount, currency)} en retard</strong> — {finance.overdueCount} appel
          {finance.overdueCount > 1 ? "s" : ""} de fonds impayé{finance.overdueCount > 1 ? "s" : ""}, le plus ancien depuis {finance.daysLate} jour
          {finance.daysLate > 1 ? "s" : ""}.
        </Banner>
      )}
      {project.status === "DELIVERED" && (
        <Banner icon={CheckCircle2} tone="success">
          <strong className="text-status-available-strong">Maison livrée</strong>
          {project.deliveredAt ? ` le ${formatDate(project.deliveredAt)}` : ""}.{" "}
          {finance.remaining > 0 ? `Il reste ${formatMoney(finance.remaining, currency)} à encaisser.` : "Le contrat est entièrement réglé."}
        </Banner>
      )}

      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <StatCard
          label="Montant du contrat"
          value={hasContract ? <Amount value={summary.contract} currency={currency} /> : "À définir"}
          icon={Coins}
          hint={
            accepted
              ? `Offre ${accepted.number} acceptée`
              : project.budget
                ? `Budget indiqué : ${formatMoney(project.budget, currency)}`
                : "Fixé par l'acceptation d'une offre"
          }
        />
        <StatCard label="Encaissé" value={<Amount value={finance.totalPaid} currency={currency} />} icon={Wallet} tone="success" hint={hasContract ? `${formatPercent(finance.progress)} du contrat` : `${project.payments.length} versement(s)`}>
          {hasContract && <PaymentProgress progress={finance.progress} overdueRatio={finance.overdueAmount / summary.contract} className="mt-3" />}
        </StatCard>
        <StatCard
          label="Dépensé sur le chantier"
          value={<Amount value={summary.spent} currency={currency} />}
          icon={ReceiptText}
          tone={summary.balance < 0 ? "danger" : "default"}
          hint={`Trésorerie du chantier : ${formatMoney(summary.balance, currency)}`}
        />
        <StatCard
          label="Avancement du chantier"
          value={`${summary.progress} %`}
          icon={TrendingUp}
          tone="gold"
          hint={
            project.phases.length
              ? `${phasesDone} / ${project.phases.length} étapes terminées${currentPhase ? ` · en cours : ${currentPhase.title}` : ""}`
              : "Aucune étape définie"
          }
        >
          <PaymentProgress progress={summary.progress / 100} className="mt-3" />
        </StatCard>
      </div>

      <div className="mt-6 grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Tabs defaultValue={tab} className="min-w-0 gap-5">
          <div className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <TabsList className="h-10">
              <TabsTrigger value="suivi" className="px-3">
                <HardHat />
                Chantier
              </TabsTrigger>
              <TabsTrigger value="offre" className="px-3">
                <FileText />
                Offre
                <Count value={project.quotes.length} />
              </TabsTrigger>
              <TabsTrigger value="finances" className="px-3">
                <Wallet />
                Versements et dépenses
              </TabsTrigger>
              <TabsTrigger value="documents" className="px-3">
                <FileText />
                Documents
                <Count value={project.documents.length} />
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="suivi" className="space-y-6">
            <Card title="Étapes du chantier" description="Déplacez le curseur pour mettre à jour l'avancement ; le client le voit dans son espace.">
              <PhasesPanel
                projectId={project.id}
                canEdit={canEdit}
                phases={project.phases.map((p) => ({
                  id: p.id,
                  title: p.title,
                  description: p.description,
                  status: p.status,
                  progress: p.progress,
                  weight: p.weight,
                  startDate: p.startDate?.toISOString() ?? null,
                  endDate: p.endDate?.toISOString() ?? null,
                }))}
              />
            </Card>
            <Card title="Journal de chantier" description={`${project.updates.length} publication${project.updates.length > 1 ? "s" : ""} · photos et vidéos du chantier`}>
              <JournalPanel
                projectId={project.id}
                canEdit={canEdit}
                today={today}
                phases={project.phases.map((p) => ({ id: p.id, title: p.title }))}
                entries={project.updates.map((u) => ({
                  id: u.id,
                  title: u.title,
                  body: u.body,
                  phaseId: u.phaseId,
                  phaseTitle: u.phase?.title ?? null,
                  visibleToClient: u.visibleToClient,
                  publishedAt: u.publishedAt.toISOString(),
                  media: u.media.map((m) => ({ id: m.id, type: m.type, caption: m.caption })),
                }))}
              />
            </Card>
          </TabsContent>

          <TabsContent value="offre">
            <Card title="Offre de construction" description="Devis détaillé des travaux. Son acceptation fixe le montant du contrat.">
              <div className="px-5 pb-5">
                <QuotePanel
                  projectId={project.id}
                  projectTitle={project.title}
                  currency={currency}
                  canEdit={canEdit && project.status !== "CANCELLED"}
                  hasAccount={!!buyer}
                  quotes={project.quotes.map((q) => ({
                    id: q.id,
                    number: q.number,
                    title: q.title,
                    status: q.status,
                    items: q.items,
                    amount: q.amount,
                    notes: q.notes,
                    validUntil: q.validUntil?.toISOString() ?? null,
                    sentAt: q.sentAt?.toISOString() ?? null,
                    respondedAt: q.respondedAt?.toISOString() ?? null,
                    createdAt: q.createdAt.toISOString(),
                  }))}
                />
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="finances" className="space-y-6">
            <Card
              title="Appels de fonds"
              description={
                project.installments.length
                  ? `${project.installments.length} échéance${project.installments.length > 1 ? "s" : ""} · ${formatMoney(project.installments.reduce((s, i) => s + i.amount, 0), currency)}`
                  : "Échéancier de paiement du contrat"
              }
              action={
                canEdit && project.status !== "CANCELLED" ? (
                  <ScheduleEditor
                    projectId={project.id}
                    contract={project.contractAmount}
                    currency={currency}
                    today={today}
                    lines={project.installments.map((i) => ({ label: i.label, dueDate: format(i.dueDate, "yyyy-MM-dd"), amount: i.amount }))}
                  />
                ) : undefined
              }
            >
              {project.installments.length ? (
                <ScheduleTable rows={finance.rows} currency={currency} className="rounded-none border-0 border-t" />
              ) : (
                <p className="border-t px-5 py-8 text-center text-sm text-muted-foreground">
                  Aucun appel de fonds défini. Répartissez le montant du contrat en échéances (à la signature, à la fin des fondations…).
                </p>
              )}
            </Card>

            <Card
              title="Versements du client"
              description={`${project.payments.length} versement${project.payments.length > 1 ? "s" : ""} · ${formatMoney(finance.totalPaid, currency)}`}
              action={
                canEdit ? (
                  <RecordPaymentButton
                    size="sm"
                    context={paymentContext}
                    disabledReason={
                      !underContract ? "Possible après l'acceptation de l'offre" : hasContract && finance.remaining <= 0 ? "Le contrat est entièrement réglé" : undefined
                    }
                  />
                ) : undefined
              }
            >
              <div className="border-t">
                <ConstructionPayments
                  canEdit={canEdit}
                  context={paymentContext}
                  payments={project.payments.map((p) => ({
                    id: p.id,
                    amount: p.amount,
                    paidAt: format(p.paidAt, "yyyy-MM-dd"),
                    method: p.method,
                    reference: p.reference,
                    note: p.note,
                    receiptNumber: p.receiptNumber,
                    recordedBy: p.recordedBy?.name ?? null,
                  }))}
                />
              </div>
            </Card>

            <Card
              title="Dépenses du chantier"
              description={`${project.expenses.length} dépense${project.expenses.length > 1 ? "s" : ""} · ${formatMoney(summary.spent, currency)}${project.showExpensesToClient ? "" : " · non partagées avec le client"}`}
              action={canEdit && project.status !== "CANCELLED" ? <NewExpenseButton context={expenseContext} size="sm" variant="outline" /> : undefined}
            >
              {summary.byCategory.length > 0 && <ExpenseBreakdown items={summary.byCategory} currency={currency} className="border-t px-5 py-4" />}
              <div className="border-t">
                <ExpenseList
                  canEdit={canEdit}
                  context={expenseContext}
                  empty="Aucune dépense. Enregistrez les achats de matériaux, la main-d'œuvre, les locations… au fur et à mesure."
                  expenses={project.expenses.map((e) => ({
                    id: e.id,
                    scope: e.scope,
                    projectId: e.projectId,
                    projectLabel: null,
                    phaseId: e.phaseId,
                    phaseTitle: e.phase?.title ?? null,
                    category: e.category,
                    label: e.label,
                    supplier: e.supplier,
                    quantity: e.quantity,
                    unit: e.unit,
                    unitPrice: e.unitPrice,
                    amount: e.amount,
                    spentAt: e.spentAt.toISOString(),
                    method: e.method,
                    reference: e.reference,
                    note: e.note,
                    visibleToClient: e.visibleToClient,
                    attachmentName: e.attachmentName,
                  }))}
                />
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <Card title="Documents du projet" description={`${sharedDocs} partagé${sharedDocs > 1 ? "s" : ""} avec le client · ${project.documents.length - sharedDocs} interne${project.documents.length - sharedDocs > 1 ? "s" : ""}`}>
              <div className="px-5 pb-5">
                <ProjectDocuments
                  projectId={project.id}
                  canEdit={canEdit}
                  documents={project.documents.map((d) => ({
                    id: d.id,
                    title: d.title,
                    category: d.category,
                    visibility: d.visibility,
                    fromClient: d.fromClient,
                    size: d.size,
                    createdAt: d.createdAt.toISOString(),
                  }))}
                />
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="min-w-0 space-y-6">
          <Card
            title="Client"
            action={
              buyer ? (
                <Link href={`/admin/acheteurs/${buyer.id}`} className="text-xs font-medium text-primary hover:underline">
                  Fiche <ArrowUpRight className="inline size-3" />
                </Link>
              ) : undefined
            }
          >
            <div className="space-y-2 px-5 pb-5 text-sm">
              <p className="text-base font-semibold">{clientName}</p>
              <a href={`tel:${phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                <Phone className="size-4" />
                <span className="tabular">{formatPhone(phone)}</span>
              </a>
              {email && (
                <a href={`mailto:${email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                  <Mail className="size-4" />
                  {email}
                </a>
              )}
              <p className="text-xs text-muted-foreground">{buyer ? "Suit son projet dans l'espace client" : "Pas encore d'espace client"}</p>
            </div>
          </Card>

          <Card title="Terrain et maison">
            {houseModel?.images[0] && (
              <div className="relative mx-5 mb-4 aspect-[16/10] overflow-hidden rounded-xl bg-muted">
                <Image src={houseModel.images[0]} alt={houseModel.name} fill sizes="340px" className="object-cover" />
              </div>
            )}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 pb-5 text-sm">
              <Detail label="Terrain" value={LAND_ORIGIN[project.landOrigin].short} />
              <Detail
                label={project.landOrigin === "COMPANY_LOT" ? "Lot" : "Localisation"}
                value={
                  lot ? (
                    <Link href={`/admin/terrains/${lot.id}`} className="hover:underline">
                      N° {lot.number}
                      {lot.block ? ` · îlot ${lot.block}` : ""}
                    </Link>
                  ) : (
                    project.landAddress || "—"
                  )
                }
              />
              <Detail label="Surface du terrain" value={lot ? formatArea(lot.areaM2) : project.landAreaM2 ? formatArea(project.landAreaM2) : "—"} />
              <Detail label="Titre" value={project.landReference || "—"} />
              <Detail label="Modèle" value={houseModel?.name ?? "Aucun"} />
              <Detail label="Plan" value={project.customPlan ? "Personnalisé" : houseModel ? "Modèle du catalogue" : "À définir"} />
              <Detail label="Début du chantier" value={project.startDate ? formatDate(project.startDate) : "—"} />
              <Detail label="Livraison prévue" value={project.plannedEndDate ? formatDate(project.plannedEndDate) : "—"} />
            </dl>
            {project.requirements && (
              <div className="border-t px-5 py-4">
                <p className="text-xs text-muted-foreground">Besoins exprimés par le client</p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{project.requirements}</p>
              </div>
            )}
          </Card>

          <Card title="Notes internes" description="Jamais montrées au client">
            <div className="px-5 pb-5">
              <ProjectNotes projectId={project.id} notes={project.notes} canEdit={canEdit} />
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}

function Count({ value }: { value: number }) {
  if (value === 0) return null
  return <span className="rounded-full bg-muted px-1.5 text-[0.7rem] font-semibold text-muted-foreground tabular">{value}</span>
}

const BANNER_TONES = {
  muted: { box: "border-border bg-muted/60", icon: "text-muted-foreground" },
  gold: { box: "border-gold/40 bg-gold/10", icon: "text-gold-strong" },
  danger: { box: "border-status-sold/30 bg-status-sold/8", icon: "text-status-sold-strong" },
  success: { box: "border-status-available/30 bg-status-available/8", icon: "text-status-available-strong" },
}

function Banner({ icon: Icon, tone, action, children }: { icon: typeof Ban; tone: keyof typeof BANNER_TONES; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={`mb-6 flex flex-col gap-3 rounded-2xl border p-4 text-sm sm:flex-row sm:items-center ${BANNER_TONES[tone].box}`}>
      <div className="flex flex-1 items-start gap-3">
        <Icon className={`mt-0.5 size-4 shrink-0 ${BANNER_TONES[tone].icon}`} />
        <p>{children}</p>
      </div>
      {action && <div className="shrink-0 pl-7 sm:pl-0">{action}</div>}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium break-words">{value}</dd>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-96 max-w-full" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  )
}
