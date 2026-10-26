import { Suspense } from "react"
import type { Metadata } from "next"
import { Globe, Lock, Users } from "lucide-react"
import { db } from "@/lib/db"
import { hasRole, requireAdmin } from "@/lib/auth/admin"
import { fullName } from "@/lib/format"
import { PageHeader } from "@/components/admin/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { DocumentsManager } from "@/components/admin/documents/documents-manager"

export const metadata: Metadata = { title: "Documents" }

export default function DocumentsPage() {
  return (
    <>
      <PageHeader title="Documents" description="Partagez les documents utiles : publics sur le site, réservés aux propriétaires, ou internes." />
      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-96 rounded-xl" />
          </div>
        }
      >
        <DocumentsContent />
      </Suspense>
    </>
  )
}

async function DocumentsContent() {
  const admin = await requireAdmin()
  const documents = await db.document.findMany({
    orderBy: { createdAt: "desc" },
    include: { sale: { select: { id: true, reference: true, buyer: { select: { firstName: true, lastName: true } } } } },
  })
  const general = documents.filter((d) => !d.saleId)
  const count = (v: string) => general.filter((d) => d.visibility === v).length
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            { label: "Publics", hint: "Sur le site", value: count("PUBLIC"), icon: Globe, tone: "bg-status-available/12 text-status-available-strong" },
            { label: "Propriétaires", hint: "Espace client", value: count("CLIENTS"), icon: Users, tone: "bg-primary/10 text-primary" },
            { label: "Internes", hint: "Administration", value: count("PRIVATE"), icon: Lock, tone: "bg-muted text-muted-foreground" },
          ] as const
        ).map(({ label, hint, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-2xl border bg-card p-3 shadow-xs md:p-5">
            <span className={`hidden size-8 place-items-center rounded-lg sm:grid ${tone}`}>
              <Icon className="size-4" />
            </span>
            <p className="text-2xl font-bold tabular sm:mt-3">{value}</p>
            <p className="truncate text-xs font-medium text-muted-foreground md:text-sm">
              {label}
              <span className="hidden md:inline"> · {hint}</span>
            </p>
          </div>
        ))}
      </div>
      <DocumentsManager
        canEdit={hasRole(admin, "ADMIN")}
        documents={documents.map((d) => ({
          id: d.id,
          title: d.title,
          description: d.description,
          category: d.category,
          visibility: d.visibility,
          filename: d.filename,
          mimeType: d.mimeType,
          size: d.size,
          createdAt: d.createdAt,
          sale: d.sale ? { id: d.sale.id, reference: d.sale.reference, buyerName: fullName(d.sale.buyer) } : null,
        }))}
      />
    </div>
  )
}
