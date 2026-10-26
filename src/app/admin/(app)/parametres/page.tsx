import { Suspense } from "react"
import type { Metadata } from "next"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { hasRole, requireAdmin } from "@/lib/auth/admin"
import { getSettings } from "@/lib/settings"
import { PageHeader } from "@/components/admin/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { SettingsTabs } from "@/components/admin/settings/settings-tabs"
import { CommercialForm, CompanyForm, SiteForm } from "@/components/admin/settings/general-forms"
import { AccountPanel, FieldsManager, SmsPanel, UsersManager } from "@/components/admin/settings/advanced-panels"

export const metadata: Metadata = { title: "Paramètres" }

export default function SettingsPage({ searchParams }: PageProps<"/admin/parametres">) {
  return (
    <>
      <PageHeader title="Paramètres" description="Configurez votre entreprise, la page d'accueil, les modalités de vente, les notifications et les accès." />
      <Suspense
        fallback={
          <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
            <Skeleton className="h-72 rounded-2xl" />
            <div className="space-y-4">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-80 rounded-2xl" />
            </div>
          </div>
        }
      >
        <SettingsContent searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function SettingsContent({ searchParams }: { searchParams: PageProps<"/admin/parametres">["searchParams"] }) {
  const admin = await requireAdmin()
  const isOwner = hasRole(admin, "OWNER")
  const canEdit = hasRole(admin, "ADMIN")
  const [sp, settings, fields, logs, users, lotsWithoutPlan] = await Promise.all([
    searchParams,
    getSettings(),
    db.lotField.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.smsLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    isOwner ? db.adminUser.findMany({ orderBy: [{ active: "desc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    db.lot.count({ where: { status: { in: ["AVAILABLE", "RESERVED"] }, price: { not: null }, depositAmount: null, installmentsCount: null, frequency: null } }),
  ])

  const panels: Record<string, React.ReactNode> = {
    entreprise: (
      <CompanyForm
        canEdit={canEdit}
        initial={{
          companyName: settings.companyName,
          companyTagline: settings.companyTagline,
          companyPhone: settings.companyPhone,
          companyWhatsapp: settings.companyWhatsapp,
          companyEmail: settings.companyEmail,
          companyAddress: settings.companyAddress,
          businessHours: settings.businessHours,
          logoUrl: settings.logoUrl,
          socialFacebook: settings.socialFacebook ?? "",
          socialInstagram: settings.socialInstagram ?? "",
          socialLinkedin: settings.socialLinkedin ?? "",
          socialYoutube: settings.socialYoutube ?? "",
          legalNotice: settings.legalNotice,
          privacyPolicy: settings.privacyPolicy,
        }}
      />
    ),
    site: (
      <SiteForm
        canEdit={canEdit}
        initial={{
          siteName: settings.siteName,
          siteLocation: settings.siteLocation,
          siteDescription: settings.siteDescription,
          siteAreaM2: settings.siteAreaM2,
          siteLatitude: settings.siteLatitude,
          siteLongitude: settings.siteLongitude,
          heroEyebrow: settings.heroEyebrow,
          heroTitle: settings.heroTitle,
          heroSubtitle: settings.heroSubtitle,
          heroImageUrl: settings.heroImageUrl,
          processImageUrl: settings.processImageUrl,
          aboutVideoUrl: settings.aboutVideoUrl ?? "",
          amenities: settings.amenities,
          lotImages: settings.lotImages,
          highlights: settings.highlights,
          faq: settings.faq,
        }}
      />
    ),
    commercial: (
      <CommercialForm
        canEdit={canEdit}
        lotsWithoutPlan={lotsWithoutPlan}
        initial={{
          currencyLabel: settings.currencyLabel,
          showPricesPublicly: settings.showPricesPublicly,
          reservationsOpen: settings.reservationsOpen,
          defaultDepositRate: settings.defaultDepositRate,
          defaultInstallments: settings.defaultInstallments,
          defaultFrequency: settings.defaultFrequency,
        }}
      />
    ),
    champs: <FieldsManager canEdit={canEdit} fields={fields} />,
    sms: (
      <SmsPanel
        canEdit={canEdit}
        provider={env.smsProvider}
        adminPhone={admin.phone}
        logs={logs}
        initial={{
          alertPhone: settings.alertPhone ?? "",
          smsOnPayment: settings.smsOnPayment,
          smsReminderDaysBefore: settings.smsReminderDaysBefore,
          smsOverdueReminders: settings.smsOverdueReminders,
        }}
      />
    ),
    ...(isOwner
      ? {
          utilisateurs: (
            <UsersManager
              currentId={admin.id}
              users={users.map((u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, active: u.active, lastLoginAt: u.lastLoginAt }))}
            />
          ),
        }
      : {}),
    compte: <AccountPanel name={admin.name} email={admin.email} phone={admin.phone} role={admin.role} />,
  }

  return <SettingsTabs panels={panels} isOwner={isOwner} initialTab={typeof sp.tab === "string" ? sp.tab : undefined} />
}
