import type { Metadata } from "next"
import { PageHeader } from "@/components/admin/page-header"
import { ImportWizard } from "@/components/admin/lots/import-wizard"

export const metadata: Metadata = { title: "Importer des terrains" }

export default function ImportLotsPage() {
  return (
    <>
      <PageHeader
        title="Importer depuis Excel"
        description="Créez ou mettez à jour des dizaines de terrains d'un coup : numéro, superficie, prix, acompte, versements, périodicité…"
        back={{ href: "/admin/terrains", label: "Terrains" }}
      />
      <ImportWizard />
    </>
  )
}
