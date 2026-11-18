import { Suspense } from "react"
import type { Metadata } from "next"
import { requireAdmin } from "@/lib/auth/admin"
import { getSettings } from "@/lib/settings"
import { getProjectFormOptions } from "@/lib/queries/construction"
import { PageHeader } from "@/components/admin/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { NewProjectForm } from "@/components/admin/construction/new-project-form"

export const metadata: Metadata = { title: "Nouveau projet de construction" }

export default function NewProjectPage({ searchParams }: PageProps<"/admin/construction/nouveau">) {
  return (
    <>
      <PageHeader
        title="Nouveau projet de construction"
        description="Ouvrez un projet pour un client : sur son terrain du lotissement, sur un terrain qu'il possède ailleurs, ou avant même qu'il ait un terrain."
        back={{ href: "/admin/construction", label: "Construction" }}
      />
      <Suspense fallback={<Skeleton className="mx-auto h-[720px] max-w-3xl rounded-2xl" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Content({ searchParams }: { searchParams: PageProps<"/admin/construction/nouveau">["searchParams"] }) {
  await requireAdmin("ADMIN")
  const [sp, settings, options] = await Promise.all([searchParams, getSettings(), getProjectFormOptions()])
  const buyerId = typeof sp.client === "string" && options.buyers.some((b) => b.id === sp.client) ? sp.client : undefined
  return <NewProjectForm {...options} currency={settings.currencyLabel} initialBuyerId={buyerId} />
}
