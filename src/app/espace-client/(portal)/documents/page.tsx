import { Suspense } from "react"
import type { Metadata } from "next"
import { FileStack, FolderLock, ShieldCheck } from "lucide-react"
import type { DocumentCategory } from "@/generated/prisma/enums"
import { requireBuyer } from "@/lib/auth/client"
import { getOwnerDocuments } from "@/lib/queries/portal"
import { DOCUMENT_CATEGORY } from "@/lib/labels"
import { Skeleton } from "@/components/ui/skeleton"
import { PageTitle, PortalCard } from "@/components/portal/card"
import { DocumentItem } from "@/components/portal/document-item"

export const metadata: Metadata = { title: "Mes documents" }

export default function DocumentsPage() {
  return (
    <>
      <PageTitle title="Documents" description="Vos documents personnels et ceux du lotissement, à consulter ou télécharger." />
      <Suspense fallback={<Skeleton className="h-[480px] rounded-3xl" />}>
        <DocumentsContent />
      </Suspense>
    </>
  )
}

async function DocumentsContent() {
  const buyer = await requireBuyer()
  const { own, general } = await getOwnerDocuments(buyer.id)

  const groups = new Map<DocumentCategory, typeof general>()
  for (const doc of general) groups.set(doc.category, [...(groups.get(doc.category) ?? []), doc])

  return (
    <div className="space-y-6">
      <PortalCard title="Mes documents" icon={FolderLock} bodyClassName="pt-2">
        <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-status-available" />
          Visibles uniquement par vous
        </p>
        {own.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucun document personnel pour le moment.</p>
        ) : (
          <ul className="divide-y">
            {own.map((doc) => (
              <DocumentItem
                key={doc.id}
                doc={doc}
                subtitle={doc.sale ? `Terrain n° ${doc.sale.lot.number}` : undefined}
              />
            ))}
          </ul>
        )}
      </PortalCard>

      <PortalCard title="Documents du lotissement" icon={FileStack} bodyClassName="space-y-5 pt-3">
        {general.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucun document disponible pour le moment.</p>
        ) : (
          [...groups.entries()].map(([category, docs]) => (
            <div key={category}>
              <h3 className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">{DOCUMENT_CATEGORY[category]}</h3>
              <ul className="divide-y">
                {docs.map((doc) => (
                  <DocumentItem key={doc.id} doc={doc} />
                ))}
              </ul>
            </div>
          ))
        )}
      </PortalCard>
    </div>
  )
}
