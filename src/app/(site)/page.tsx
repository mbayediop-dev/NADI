import { Suspense } from "react"
import type { Metadata } from "next"
import { formatArea, formatMoney } from "@/lib/format"
import { computeLotStats, getPublicLots, getPublicProgress } from "@/lib/queries/public"
import { Hero } from "@/components/site/hero"
import { DomainSection } from "@/components/site/domain-section"
import { TerrainsSection } from "@/components/site/terrains-section"
import { ProgressShowcase } from "@/components/site/progress-showcase"
import { FinancingSection } from "@/components/site/financing-section"
import { AboutSection } from "@/components/site/about-section"
import { ContactSection } from "@/components/site/contact-section"
import { LandingSkeleton } from "@/components/site/skeletons"

export async function generateMetadata(): Promise<Metadata> {
  const { settings, lots } = await getPublicLots()
  const stats = computeLotStats(lots)
  const title = `${settings.companyName} — terrains viabilisés au Sénégal`
  const description = `${settings.siteName}${settings.siteLocation ? ` (${settings.siteLocation})` : ""} : ${stats.forSale} terrains viabilisés et numérotés dont ${stats.byStatus.AVAILABLE} disponibles. Prix clairs, paiement échelonné et réservation en ligne.`
  return {
    title: { absolute: title },
    description,
    openGraph: { title, description, type: "website" },
    alternates: { canonical: "/" },
  }
}

export default function HomePage() {
  return (
    <Suspense fallback={<LandingSkeleton />}>
      <Landing />
    </Suspense>
  )
}

async function Landing() {
  const [{ settings: s, lots }, progress] = await Promise.all([getPublicLots(), getPublicProgress({ limit: 8 })])
  const stats = computeLotStats(lots)
  const plan = { imageUrl: s.planImageUrl, width: s.planWidth, height: s.planHeight }
  const available = lots.filter((l) => l.status === "AVAILABLE")
  const lotOptions = available.map((l) => ({
    id: l.id,
    number: l.number,
    label: `Lot ${l.number} · ${formatArea(l.areaM2)}${l.price != null ? ` · ${formatMoney(l.price, s.currencyLabel)}` : ""}`,
  }))
  // Modalités les plus accessibles parmi les terrains disponibles
  const plans = available.flatMap((l) => (l.plan ? [l.plan] : []))
  const deposits = plans.map((p) => p.deposit).filter((d) => d > 0)
  const minDeposit = deposits.length ? Math.min(...deposits) : null
  const maxInstallments = plans.length ? Math.max(...plans.map((p) => p.count)) : s.defaultInstallments || null

  return (
    <>
      <Hero
        eyebrow={s.heroEyebrow}
        title={s.heroTitle || `Votre terrain à ${s.siteName}`}
        subtitle={s.heroSubtitle || s.siteDescription}
        imageUrl={s.heroImageUrl}
        thumbnails={s.lotImages.slice(0, 2)}
        amenities={s.amenities.slice(0, 4)}
        areaM2={s.siteAreaM2}
        lotCount={stats.forSale}
        plan={plan}
        lots={lots}
      />
      <DomainSection description={s.siteDescription} areaM2={s.siteAreaM2} lotCount={stats.forSale} highlights={s.highlights} plan={plan} lots={lots} currency={s.currencyLabel} />
      <TerrainsSection lots={lots} photos={s.lotImages} plan={plan} currency={s.currencyLabel} showPrices={s.showPricesPublicly} />
      <ProgressShowcase updates={progress.updates} />
      <FinancingSection companyName={s.companyName} currency={s.currencyLabel} minDeposit={s.showPricesPublicly ? minDeposit : null} maxInstallments={maxInstallments} />
      <AboutSection companyName={s.companyName} about={s.companyAbout} imageUrl={s.processImageUrl} videoUrl={s.aboutVideoUrl} plan={plan} lots={lots} />
      <ContactSection
        companyName={s.companyName}
        companyPhone={s.companyPhone}
        companyWhatsapp={s.companyWhatsapp}
        companyEmail={s.companyEmail}
        companyAddress={s.companyAddress}
        businessHours={s.businessHours}
        lotOptions={s.reservationsOpen ? lotOptions : []}
      />
    </>
  )
}
