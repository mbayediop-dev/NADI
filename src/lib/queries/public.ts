import "server-only"
import { cache } from "react"
import { connection } from "next/server"
import { db } from "@/lib/db"
import { resolvePlan } from "@/lib/finance"
import { getSettings, planDefaults, type AppSettings } from "@/lib/settings"
import { getPlanLots } from "@/lib/queries/plan"
import type { PublicField, PublicLot } from "@/components/site/lot-utils"

export type { PublicField, PublicLot } from "@/components/site/lot-utils"
export { computeLotStats, monthlyEquivalent, similarLots, type LotStats } from "@/components/site/lot-utils"

export type PublicSettings = Pick<
  AppSettings,
  | "companyName"
  | "companyTagline"
  | "companyAbout"
  | "companyPhone"
  | "companyWhatsapp"
  | "companyEmail"
  | "companyAddress"
  | "siteName"
  | "siteLocation"
  | "siteDescription"
  | "siteAreaM2"
  | "siteLatitude"
  | "siteLongitude"
  | "amenities"
  | "highlights"
  | "faq"
  | "heroEyebrow"
  | "heroTitle"
  | "heroSubtitle"
  | "heroImageUrl"
  | "processImageUrl"
  | "aboutVideoUrl"
  | "lotImages"
  | "businessHours"
  | "socialFacebook"
  | "socialInstagram"
  | "socialLinkedin"
  | "socialYoutube"
  | "planImageUrl"
  | "planWidth"
  | "planHeight"
  | "currencyLabel"
  | "showPricesPublicly"
  | "reservationsOpen"
  | "defaultDepositRate"
  | "defaultInstallments"
  | "defaultFrequency"
>

function formatFieldValue(type: string, raw: unknown, unit: string | null): string | null {
  if (raw === null || raw === undefined || raw === "") return null
  if (type === "BOOLEAN") return raw === true || raw === "true" || raw === "oui" ? "Oui" : "Non"
  const value = String(raw)
  return unit ? `${value} ${unit}` : value
}

function toPublicSettings(s: AppSettings): PublicSettings {
  return {
    companyName: s.companyName,
    companyTagline: s.companyTagline,
    companyAbout: s.companyAbout,
    companyPhone: s.companyPhone,
    companyWhatsapp: s.companyWhatsapp,
    companyEmail: s.companyEmail,
    companyAddress: s.companyAddress,
    siteName: s.siteName,
    siteLocation: s.siteLocation,
    siteDescription: s.siteDescription,
    siteAreaM2: s.siteAreaM2,
    siteLatitude: s.siteLatitude,
    siteLongitude: s.siteLongitude,
    amenities: s.amenities,
    highlights: s.highlights,
    faq: s.faq,
    heroEyebrow: s.heroEyebrow,
    heroTitle: s.heroTitle,
    heroSubtitle: s.heroSubtitle,
    heroImageUrl: s.heroImageUrl,
    processImageUrl: s.processImageUrl,
    aboutVideoUrl: s.aboutVideoUrl,
    lotImages: s.lotImages,
    businessHours: s.businessHours,
    socialFacebook: s.socialFacebook,
    socialInstagram: s.socialInstagram,
    socialLinkedin: s.socialLinkedin,
    socialYoutube: s.socialYoutube,
    planImageUrl: s.planImageUrl,
    planWidth: s.planWidth,
    planHeight: s.planHeight,
    currencyLabel: s.currencyLabel,
    showPricesPublicly: s.showPricesPublicly,
    reservationsOpen: s.reservationsOpen,
    defaultDepositRate: s.defaultDepositRate,
    defaultInstallments: s.defaultInstallments,
    defaultFrequency: s.defaultFrequency,
  }
}

/** Terrains publics (prix et modalités masqués selon le statut et les paramètres) */
export const getPublicLots = cache(async (): Promise<{ settings: PublicSettings; lots: PublicLot[] }> => {
  const settings = await getSettings()
  const [planLots, details, fields] = await Promise.all([
    getPlanLots({ settings, audience: "public" }),
    db.lot.findMany({
      select: {
        id: true,
        depositAmount: true,
        installmentsCount: true,
        frequency: true,
        customIntervalDays: true,
        installmentAmount: true,
        soilType: true,
        position: true,
        orientation: true,
        frontageM: true,
        depthM: true,
        description: true,
        features: true,
        attributes: true,
        isFeatured: true,
      },
    }),
    db.lotField.findMany({ where: { showPublic: true }, orderBy: { sortOrder: "asc" } }),
  ])
  const byId = new Map(details.map((d) => [d.id, d]))
  const defaults = planDefaults(settings)
  const lots = planLots.map((lot): PublicLot => {
    const d = byId.get(lot.id)!
    const attributes = (d.attributes && typeof d.attributes === "object" ? d.attributes : {}) as Record<string, unknown>
    const visiblePrice = lot.price
    const plan =
      visiblePrice != null && lot.status === "AVAILABLE"
        ? resolvePlan(
            {
              price: visiblePrice,
              depositAmount: d.depositAmount,
              installmentsCount: d.installmentsCount,
              frequency: d.frequency,
              customIntervalDays: d.customIntervalDays,
              installmentAmount: d.installmentAmount,
            },
            defaults,
          )
        : null
    return {
      ...lot,
      depositAmount: plan ? d.depositAmount : null,
      installmentsCount: d.installmentsCount,
      frequency: d.frequency,
      customIntervalDays: d.customIntervalDays,
      installmentAmount: plan ? d.installmentAmount : null,
      soilType: d.soilType,
      position: d.position,
      orientation: d.orientation,
      frontageM: d.frontageM,
      depthM: d.depthM,
      description: d.description,
      features: d.features,
      isFeatured: d.isFeatured,
      fields: fields
        .map((f) => {
          const value = formatFieldValue(f.type, attributes[f.key], f.unit)
          return value ? { key: f.key, label: f.label, value } : null
        })
        .filter((f): f is PublicField => f !== null),
      plan,
    }
  })
  return { settings: toPublicSettings(settings), lots }
})

export type PublicMedia = { id: string; type: "IMAGE" | "VIDEO" | "EMBED"; url: string; caption: string | null }
export type PublicUpdate = {
  id: string
  title: string
  body: string
  publishedAt: Date
  pinned: boolean
  milestone: string | null
  media: PublicMedia[]
}
export type PublicMilestone = {
  id: string
  title: string
  description: string | null
  progress: number
  status: "PLANNED" | "IN_PROGRESS" | "DONE"
  startDate: Date | null
  endDate: Date | null
}

/** Avancement public : jalons et actualités publiques */
export const getPublicProgress = cache(async (opts: { limit?: number } = {}) => {
  await connection() // lecture à la requête (Prisma utilise des valeurs aléatoires)
  const [milestones, updates] = await Promise.all([
    db.milestone.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.siteUpdate.findMany({
      where: { visibility: "PUBLIC" },
      orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
      take: opts.limit,
      include: { media: { orderBy: { sortOrder: "asc" } }, milestone: { select: { title: true } } },
    }),
  ])
  const overall = milestones.length ? Math.round(milestones.reduce((s, m) => s + m.progress, 0) / milestones.length) : 0
  return {
    overall,
    milestones: milestones.map(
      (m): PublicMilestone => ({
        id: m.id,
        title: m.title,
        description: m.description,
        progress: m.progress,
        status: m.status,
        startDate: m.startDate,
        endDate: m.endDate,
      }),
    ),
    updates: updates.map(
      (u): PublicUpdate => ({
        id: u.id,
        title: u.title,
        body: u.body,
        publishedAt: u.publishedAt,
        pinned: u.pinned,
        milestone: u.milestone?.title ?? null,
        media: u.media.map((m) => ({ id: m.id, type: m.type, url: m.url, caption: m.caption })),
      }),
    ),
  }
})

export type PublicDocument = { id: string; title: string; description: string | null; category: string; size: number; mimeType: string }

export const getPublicDocuments = cache(async (): Promise<PublicDocument[]> => {
  await connection()
  const docs = await db.document.findMany({
    where: { visibility: "PUBLIC", saleId: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, description: true, category: true, size: true, mimeType: true },
  })
  return docs
})

