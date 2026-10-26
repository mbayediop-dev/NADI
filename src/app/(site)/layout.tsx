import { Suspense } from "react"
import { getSettings } from "@/lib/settings"
import { SiteHeader, SiteHeaderBar } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Suspense fallback={<SiteHeaderBar active={null} phone={null} />}>
        <Header />
      </Suspense>
      <main className="flex-1">{children}</main>
      <Suspense fallback={<footer className="h-72 border-t bg-background" />}>
        <SiteFooter />
      </Suspense>
    </div>
  )
}

/** Le numéro de téléphone de l'en-tête vient des paramètres (lecture dynamique). */
async function Header() {
  const s = await getSettings()
  return <SiteHeader phone={s.companyPhone || null} />
}
