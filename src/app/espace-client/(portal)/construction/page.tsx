import { Suspense } from "react"
import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Building2, Eye, FileCheck2, HardHat, Hammer, Wallet } from "lucide-react"
import { requireBuyer } from "@/lib/auth/client"
import type { ConstructionStatus } from "@/generated/prisma/enums"
import { isUnderContract, landLabel } from "@/lib/construction"
import { formatArea, formatMoney } from "@/lib/format"
import { CONSTRUCTION_STATUS } from "@/lib/labels"
import { getBuyerProjects, getHouseModels } from "@/lib/queries/construction"
import { getOwnerSales } from "@/lib/queries/portal"
import { getSettings } from "@/lib/settings"
import { Skeleton } from "@/components/ui/skeleton"
import { ToneBadge } from "@/components/shared/badges"
import { PageTitle, PortalCard } from "@/components/portal/card"
import { ConstructionRequestForm } from "@/components/portal/construction/client-actions"

export const metadata: Metadata = { title: "Construction" }

export default function ConstructionPage({ searchParams }: PageProps<"/espace-client/construction">) {
  return (
    <>
      <PageTitle title="Construction" description="Faites construire votre maison et suivez votre chantier en toute transparence." />
      <Suspense fallback={<Skeleton className="h-[520px] rounded-3xl" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  )
}

/** Où en est le projet, dit au client (les libellés de `CONSTRUCTION_STATUS.hint` s'adressent à l'administration). */
const CLIENT_HINT: Record<ConstructionStatus, string> = {
  REQUESTED: "Votre demande est bien reçue : nous l'étudions et vous contactons.",
  STUDY: "Nous préparons vos plans et votre offre détaillée.",
  OFFER_SENT: "Votre offre vous attend : consultez-la et répondez en ligne.",
  SIGNED: "Offre acceptée : le chantier va démarrer.",
  IN_PROGRESS: "Les travaux sont en cours.",
  SUSPENDED: "Le chantier est momentanément suspendu.",
  DELIVERED: "Votre maison est livrée.",
  CANCELLED: "Projet classé sans suite.",
}

const PROMISES = [
  { icon: FileCheck2, title: "Une offre détaillée", text: "Chaque poste de travaux et son prix, à accepter en ligne." },
  { icon: HardHat, title: "Le chantier en photos", text: "Étape par étape, avec l'avancement mis à jour." },
  { icon: Wallet, title: "Vos versements et reçus", text: "Appels de fonds, versements et reçus à télécharger." },
  { icon: Eye, title: "Les dépenses du chantier", text: "Matériaux, main-d'œuvre et justificatifs partagés." },
]

async function Content({ searchParams }: { searchParams: PageProps<"/espace-client/construction">["searchParams"] }) {
  const buyer = await requireBuyer()
  const [sp, settings, projects, sales, models] = await Promise.all([
    searchParams,
    getSettings(),
    getBuyerProjects(buyer.id),
    getOwnerSales(buyer.id),
    getHouseModels({ publishedOnly: true }),
  ])
  const currency = settings.currencyLabel

  return (
    <div className="space-y-6">
      {projects.length > 0 && (
        <ul className="grid gap-4 lg:grid-cols-2">
          {projects.map((project) => {
            const { finance, progress, contract } = project.summary
            const image = project.houseModel?.images[0]
            const cover = project.coverMediaId ? `/api/construction/media/${project.coverMediaId}` : null
            return (
              <li key={project.id}>
                <Link
                  href={`/espace-client/construction/${project.id}`}
                  className="group flex h-full flex-col overflow-hidden rounded-3xl border bg-card shadow-xs transition-shadow hover:shadow-[0_24px_50px_-28px_rgb(0_0_0/0.4)]"
                >
                  <div className="relative aspect-[16/8] bg-pine-deep">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element -- photo de chantier privée, servie par une route protégée
                      <img src={cover} alt="" className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                    ) : image ? (
                      <Image src={image} alt="" fill sizes="(min-width: 1024px) 520px, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                    ) : (
                      <div className="grid size-full place-items-center text-white/40">
                        <Hammer className="size-10" />
                      </div>
                    )}
                    <ToneBadge tone={`${CONSTRUCTION_STATUS[project.status].tone} bg-background`} className="absolute top-3 left-3 shadow-sm">
                      {CONSTRUCTION_STATUS[project.status].label}
                    </ToneBadge>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-lg leading-snug font-bold">{project.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {landLabel(project)} · {project.reference}
                    </p>
                    {isUnderContract(project.status) && (
                      <div className="mt-4">
                        <div className="flex items-baseline justify-between text-sm">
                          <span className="text-muted-foreground">Avancement du chantier</span>
                          <span className="font-semibold tabular">{progress} %</span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-gold" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    )}
                    {project.contractAmount ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground tabular">{formatMoney(finance.totalPaid, currency)}</span> versés sur{" "}
                        <span className="tabular">{formatMoney(contract, currency)}</span>
                        {finance.overdueAmount > 0 && <span className="font-medium text-status-sold-strong"> · {formatMoney(finance.overdueAmount, currency)} en retard</span>}
                      </p>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">{CLIENT_HINT[project.status]}</p>
                    )}
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                      Suivre mon projet
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <PortalCard title={projects.length ? "Un autre projet de construction ?" : "Faire construire ma maison"} icon={Building2} bodyClassName="space-y-6">
        <p className="-mt-1 max-w-2xl text-sm text-muted-foreground">
          {settings.companyName} construit votre maison sur votre terrain du lotissement, sur un terrain que vous possédez ailleurs, ou vous accompagne si vous n&apos;avez pas
          encore de terrain. Vous suivez tout ici :
        </p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PROMISES.map((p) => (
            <li key={p.title} className="rounded-2xl bg-muted/50 p-3.5">
              <p.icon className="size-5 text-gold-strong" />
              <p className="mt-2 text-sm font-semibold">{p.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{p.text}</p>
            </li>
          ))}
        </ul>
        <div id="demande" className="scroll-mt-24 border-t pt-6">
          <ConstructionRequestForm
            currency={currency}
            defaultModelId={typeof sp.modele === "string" ? sp.modele : undefined}
            lots={sales.map((s) => ({ saleId: s.id, number: s.lot.number, block: s.lot.block, areaM2: s.lot.areaM2 }))}
            models={models.map((m) => ({
              id: m.id,
              name: m.name,
              detail: [m.levels, m.bedrooms ? `${m.bedrooms} chambre${m.bedrooms > 1 ? "s" : ""}` : null, m.livingAreaM2 ? formatArea(m.livingAreaM2) : null].filter(Boolean).join(" · "),
              image: m.images[0] ?? null,
              basePrice: m.basePrice,
            }))}
          />
        </div>
      </PortalCard>
    </div>
  )
}
