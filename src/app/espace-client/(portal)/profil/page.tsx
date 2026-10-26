import { Suspense } from "react"
import type { Metadata } from "next"
import { BadgeCheck, Briefcase, CalendarDays, Headset, IdCard, Mail, MapPin, MapPinned, Phone, UserRound } from "lucide-react"
import { requireBuyer } from "@/lib/auth/client"
import { getSettings } from "@/lib/settings"
import { getOwnerSales } from "@/lib/queries/portal"
import { formatArea, formatDateLong, formatDateTime, fullName, initials } from "@/lib/format"
import { formatPhone } from "@/lib/phone"
import { SALE_STATUS } from "@/lib/labels"
import { Skeleton } from "@/components/ui/skeleton"
import { ToneBadge } from "@/components/shared/badges"
import { PageTitle, PortalCard } from "@/components/portal/card"
import { ContactButtons } from "@/components/portal/contact-buttons"
import { LogoutButton } from "@/components/portal/logout-button"

export const metadata: Metadata = { title: "Mon profil" }

export default function ProfilePage() {
  return (
    <>
      <PageTitle title="Mon profil" description="Vos informations personnelles enregistrées par NADI Group." />
      <Suspense fallback={<Skeleton className="h-[480px] rounded-3xl" />}>
        <ProfileContent />
      </Suspense>
    </>
  )
}

function maskId(value: string) {
  return value.length <= 4 ? value : `${"•".repeat(Math.min(8, value.length - 4))}${value.slice(-4)}`
}

async function ProfileContent() {
  const buyer = await requireBuyer()
  const [settings, sales] = await Promise.all([getSettings(), getOwnerSales(buyer.id)])
  const name = fullName(buyer)
  const since = sales.length ? sales.reduce((min, s) => (s.signedAt < min ? s.signedAt : min), sales[0].signedAt) : null
  const contact = { company: settings.companyName, phone: settings.companyPhone, whatsapp: settings.companyWhatsapp, email: settings.companyEmail }

  const fields = [
    { icon: Phone, label: "Téléphone", value: formatPhone(buyer.phone) },
    { icon: Phone, label: "Téléphone secondaire", value: buyer.phoneAlt ? formatPhone(buyer.phoneAlt) : null },
    { icon: Mail, label: "E-mail", value: buyer.email },
    { icon: MapPin, label: "Adresse", value: [buyer.address, buyer.city, buyer.country].filter(Boolean).join(", ") || null },
    { icon: Briefcase, label: "Profession", value: buyer.profession },
    { icon: IdCard, label: buyer.idType ? `Pièce d'identité (${buyer.idType})` : "Pièce d'identité", value: buyer.idNumber ? maskId(buyer.idNumber) : null },
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-3">
        <PortalCard bodyClassName="p-0">
          <div className="flex items-center gap-4 bg-gradient-to-br from-sand to-card p-5 sm:p-6">
            <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground shadow-sm">
              {initials(name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xl font-bold">{name}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <BadgeCheck className="size-4 text-status-available" />
                Propriétaire{since ? ` depuis le ${formatDateLong(since)}` : ""}
              </p>
            </div>
          </div>
          <dl className="divide-y border-t">
            {fields
              .filter((f) => f.value)
              .map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <dt className="w-40 shrink-0 text-sm text-muted-foreground max-sm:hidden">{label}</dt>
                  <dd className="min-w-0 flex-1">
                    <span className="block text-xs text-muted-foreground sm:hidden">{label}</span>
                    <span className="block truncate font-medium tabular">{value}</span>
                  </dd>
                </div>
              ))}
          </dl>
          {buyer.lastLoginAt && (
            <p className="border-t px-5 py-3 text-xs text-muted-foreground sm:px-6">Dernière connexion : {formatDateTime(buyer.lastLoginAt)}</p>
          )}
        </PortalCard>

        <PortalCard title="Mes terrains" icon={MapPinned} bodyClassName="pt-3">
          <ul className="divide-y">
            {sales.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold">Terrain n° {s.lot.number}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.lot.block && `Îlot ${s.lot.block} · `}
                    {formatArea(s.lot.areaM2)} · {s.reference}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <ToneBadge tone={SALE_STATUS[s.status].tone}>{SALE_STATUS[s.status].label}</ToneBadge>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="size-3" />
                    {formatDateLong(s.signedAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </PortalCard>
      </div>

      <div className="space-y-6 lg:col-span-2">
        <PortalCard title="Une information à modifier ?" icon={Headset}>
          <p className="text-sm text-muted-foreground">
            Pour toute modification de vos coordonnées ou pour toute question sur votre dossier, contactez {settings.companyName}.
          </p>
          <ContactButtons contact={contact} className="mt-4 flex-col [&>a]:w-full sm:[&>a]:w-auto" showEmail />
          {settings.companyAddress && (
            <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0" />
              {settings.companyAddress}
            </p>
          )}
        </PortalCard>
        <PortalCard title="Sécurité" icon={UserRound}>
          <p className="text-sm text-muted-foreground">
            Vous vous connectez avec votre numéro de téléphone et un code reçu par SMS. Ne communiquez jamais ce code, même à un
            membre de {settings.companyName}.
          </p>
          <div className="mt-4">
            <LogoutButton />
          </div>
        </PortalCard>
      </div>
    </div>
  )
}
