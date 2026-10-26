"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, Building2, Coins, Globe2, Images, LayoutTemplate, MapPin, Plus, Scale, Share2, Sparkles, Trash2 } from "lucide-react"
import type { PaymentFrequency } from "@/generated/prisma/enums"
import { resolvePlan } from "@/lib/finance"
import { formatMoney } from "@/lib/format"
import { useServerAction } from "@/hooks/use-server-action"
import { saveCommercialSettings, saveCompanySettings, saveSiteSettings } from "@/app/admin/(app)/parametres/actions"
import { applyDefaultPlanToLots } from "@/app/admin/(app)/terrains/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { PhoneInput } from "@/components/shared/phone-input"
import { FormField, FormSection, parseOptionalNumber, TagInput } from "@/components/admin/settings/form-bits"
import { ImageField } from "@/components/admin/settings/image-field"
import { SaveBar, useFormState } from "@/components/admin/settings/settings-shell"
import { FrequencySelect } from "@/components/admin/lots/plan-fields"

// ─────────────────────────────────────────────────────────────
// Entreprise
// ─────────────────────────────────────────────────────────────

export type CompanyValues = {
  companyName: string
  companyTagline: string
  companyPhone: string
  companyWhatsapp: string
  companyEmail: string
  companyAddress: string
  businessHours: string
  logoUrl: string | null
  socialFacebook: string
  socialInstagram: string
  socialLinkedin: string
  socialYoutube: string
  legalNotice: string
  privacyPolicy: string
}

const SOCIALS = [
  { key: "socialFacebook", label: "Facebook", placeholder: "https://www.facebook.com/nadigroup" },
  { key: "socialInstagram", label: "Instagram", placeholder: "https://www.instagram.com/nadigroup" },
  { key: "socialLinkedin", label: "LinkedIn", placeholder: "https://www.linkedin.com/company/nadigroup" },
  { key: "socialYoutube", label: "YouTube", placeholder: "https://www.youtube.com/@nadigroup" },
] as const

export function CompanyForm({ initial, canEdit }: { initial: CompanyValues; canEdit: boolean }) {
  const form = useFormState(initial)
  const { run, pending } = useServerAction()
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const v = form.value
  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        setErrors({})
        run(() => saveCompanySettings(v), { onSuccess: form.commit, onError: (_, fe) => setErrors(fe ?? {}) })
      }}
    >
      <fieldset disabled={!canEdit} className="space-y-6">
        <FormSection title="Identité" description="Affichée sur le site, les reçus et les SMS." icon={Building2}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nom de l'entreprise" htmlFor="c-name" required error={errors.companyName}>
              <Input id="c-name" className="h-9" value={v.companyName} onChange={(e) => form.set("companyName", e.target.value)} />
            </FormField>
            <FormField label="Signature / slogan" htmlFor="c-tagline" hint="Affiché dans le pied de page du site.">
              <Input id="c-tagline" className="h-9" value={v.companyTagline} onChange={(e) => form.set("companyTagline", e.target.value)} />
            </FormField>
            <FormField label="Logo (optionnel)" htmlFor="c-logo" className="sm:col-span-2" hint="Format carré conseillé. Par défaut, le monogramme NADI est utilisé.">
              <div className="max-w-40">
                <ImageField value={v.logoUrl} onChange={(url) => form.set("logoUrl", url)} folder="branding" aspect="aspect-square" />
              </div>
            </FormField>
          </div>
        </FormSection>
        <FormSection title="Coordonnées" description="Les acheteurs vous joignent avec ces informations." icon={MapPin}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Téléphone" htmlFor="c-phone" error={errors.companyPhone}>
              <PhoneInput id="c-phone" value={v.companyPhone} onChange={(p) => form.set("companyPhone", p)} />
            </FormField>
            <FormField label="WhatsApp" htmlFor="c-wa" error={errors.companyWhatsapp} hint="Bouton WhatsApp du site.">
              <PhoneInput id="c-wa" value={v.companyWhatsapp} onChange={(p) => form.set("companyWhatsapp", p)} />
            </FormField>
            <FormField label="E-mail" htmlFor="c-email" error={errors.companyEmail}>
              <Input id="c-email" type="email" className="h-9" value={v.companyEmail} onChange={(e) => form.set("companyEmail", e.target.value)} />
            </FormField>
            <FormField label="Adresse" htmlFor="c-address">
              <Input id="c-address" className="h-9" value={v.companyAddress} onChange={(e) => form.set("companyAddress", e.target.value)} />
            </FormField>
            <FormField label="Horaires d'ouverture" htmlFor="c-hours" hint="Affichés sous le téléphone dans la section Contact.">
              <Input id="c-hours" className="h-9" placeholder="Lun - Ven, 9h - 18h" value={v.businessHours} onChange={(e) => form.set("businessHours", e.target.value)} />
            </FormField>
          </div>
        </FormSection>
        <FormSection title="Réseaux sociaux" description="Les icônes apparaissent dans le pied de page ; laissez vide pour masquer un réseau." icon={Share2}>
          <div className="grid gap-4 sm:grid-cols-2">
            {SOCIALS.map((social) => (
              <FormField key={social.key} label={social.label} htmlFor={`c-${social.key}`} error={errors[social.key]}>
                <Input
                  id={`c-${social.key}`}
                  type="url"
                  className="h-9"
                  placeholder={social.placeholder}
                  value={v[social.key]}
                  onChange={(e) => form.set(social.key, e.target.value)}
                />
              </FormField>
            ))}
          </div>
        </FormSection>
        <FormSection title="Pages légales" description="Laissez vide pour utiliser un texte type généré avec vos coordonnées. Mettez un titre en **gras**, séparez les paragraphes par une ligne vide." icon={Scale}>
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField label="Mentions légales" htmlFor="c-legal">
              <Textarea id="c-legal" rows={8} value={v.legalNotice} onChange={(e) => form.set("legalNotice", e.target.value)} />
            </FormField>
            <FormField label="Politique de confidentialité" htmlFor="c-privacy">
              <Textarea id="c-privacy" rows={8} value={v.privacyPolicy} onChange={(e) => form.set("privacyPolicy", e.target.value)} />
            </FormField>
          </div>
        </FormSection>
      </fieldset>
      {canEdit && <SaveBar dirty={form.dirty} pending={pending} onReset={form.reset} />}
    </form>
  )
}

// ─────────────────────────────────────────────────────────────
// Site et page d'accueil
// ─────────────────────────────────────────────────────────────

export type SiteValues = {
  siteName: string
  siteLocation: string
  siteDescription: string
  siteAreaM2: number | null
  siteLatitude: number | null
  siteLongitude: number | null
  heroEyebrow: string
  heroTitle: string
  heroSubtitle: string
  heroImageUrl: string | null
  processImageUrl: string | null
  aboutVideoUrl: string
  amenities: string[]
  lotImages: string[]
  highlights: { title: string; text: string }[]
  faq: { q: string; a: string }[]
}

function MoveButtons({ index, length, onMove }: { index: number; length: number; onMove: (from: number, to: number) => void }) {
  return (
    <div className="flex flex-col">
      <Button type="button" variant="ghost" size="icon-xs" disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label="Monter">
        <ArrowUp />
      </Button>
      <Button type="button" variant="ghost" size="icon-xs" disabled={index === length - 1} onClick={() => onMove(index, index + 1)} aria-label="Descendre">
        <ArrowDown />
      </Button>
    </div>
  )
}

function move<T>(list: T[], from: number, to: number) {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function SiteForm({ initial, canEdit }: { initial: SiteValues; canEdit: boolean }) {
  const form = useFormState(initial)
  const { run, pending } = useServerAction()
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const v = form.value

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        run(
          () =>
            saveSiteSettings({
              ...v,
              siteAreaM2: v.siteAreaM2 ?? Number.NaN,
              highlights: v.highlights.filter((h) => h.title.trim()),
              lotImages: v.lotImages.filter(Boolean),
              faq: v.faq.filter((f) => f.q.trim() || f.a.trim()),
            }),
          { onSuccess: form.commit, onError: (_, fe) => setErrors(fe ?? {}) },
        )
      }}
    >
      <fieldset disabled={!canEdit} className="space-y-6">
        <FormSection title="Le lotissement" description="Nom, localisation et présentation du site." icon={Globe2}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nom du site" htmlFor="s-name" required error={errors.siteName}>
              <Input id="s-name" className="h-9" value={v.siteName} onChange={(e) => form.set("siteName", e.target.value)} />
            </FormField>
            <FormField label="Localisation" htmlFor="s-loc" hint="Ex. Diamniadio, Dakar">
              <Input id="s-loc" className="h-9" value={v.siteLocation} onChange={(e) => form.set("siteLocation", e.target.value)} />
            </FormField>
            <FormField label="Superficie totale" htmlFor="s-area" error={errors.siteAreaM2} hint={v.siteAreaM2 ? `Soit ${(v.siteAreaM2 / 10000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ha` : undefined}>
              <div className="relative">
                <Input id="s-area" inputMode="decimal" className="h-9 pr-10 tabular" value={v.siteAreaM2 ?? ""} onChange={(e) => form.set("siteAreaM2", parseOptionalNumber(e.target.value))} />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">m²</span>
              </div>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Latitude" htmlFor="s-lat" error={errors.siteLatitude}>
                <Input id="s-lat" inputMode="decimal" className="h-9 tabular" placeholder="14.7167" value={v.siteLatitude ?? ""} onChange={(e) => form.set("siteLatitude", parseOptionalNumber(e.target.value))} />
              </FormField>
              <FormField label="Longitude" htmlFor="s-lng" error={errors.siteLongitude}>
                <Input id="s-lng" inputMode="decimal" className="h-9 tabular" placeholder="-17.1833" value={v.siteLongitude ?? ""} onChange={(e) => form.set("siteLongitude", parseOptionalNumber(e.target.value))} />
              </FormField>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground sm:col-span-2">
              Coordonnées GPS : dans Google Maps, faites un clic droit sur le site puis cliquez sur les chiffres pour les copier. Une carte s&apos;affichera sur la page d&apos;accueil.
            </p>
            <FormField label="Description du site" htmlFor="s-desc" className="sm:col-span-2" hint="Section « Le domaine » de l'accueil. Entourez un mot de **deux astérisques** pour le mettre en gras.">
              <Textarea id="s-desc" rows={4} value={v.siteDescription} onChange={(e) => form.set("siteDescription", e.target.value)} />
            </FormField>
            <FormField label="Équipements du domaine" htmlFor="s-amenities" className="sm:col-span-2" error={errors.amenities} hint="Les quatre premiers s'affichent dans l'encart « Un cadre de vie idéal » de l'en-tête. Validez chaque équipement avec Entrée.">
              <TagInput id="s-amenities" value={v.amenities} onChange={(list) => form.set("amenities", list.slice(0, 8))} placeholder="Ex. Voiries aménagées" />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="En-tête de la page d'accueil" description="La première impression des visiteurs." icon={LayoutTemplate}>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-4">
              <FormField label="Accroche (au-dessus du titre)" htmlFor="s-eyebrow" hint="Ex. Un domaine à bâtir, un avenir à transmettre">
                <Input id="s-eyebrow" className="h-9" value={v.heroEyebrow} onChange={(e) => form.set("heroEyebrow", e.target.value)} />
              </FormField>
              <FormField label="Titre principal" htmlFor="s-hero" hint="Séparez le titre et sa seconde ligne, plus petite, par « | » (ex. Construisez votre avenir | sur un domaine d'exception).">
                <Input id="s-hero" className="h-9" value={v.heroTitle} onChange={(e) => form.set("heroTitle", e.target.value)} />
              </FormField>
              <FormField label="Sous-titre" htmlFor="s-sub">
                <Textarea id="s-sub" rows={3} value={v.heroSubtitle} onChange={(e) => form.set("heroSubtitle", e.target.value)} />
              </FormField>
            </div>
            <FormField label="Photo d'en-tête" htmlFor="s-img" hint="Vue aérienne du domaine, affichée en pleine largeur derrière le texte.">
              <ImageField value={v.heroImageUrl} onChange={(url) => form.set("heroImageUrl", url)} folder="branding" />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Photos du site" description="Remplacez les visuels de démonstration par de vraies photos du domaine." icon={Images}>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Section « Pourquoi choisir … »" htmlFor="s-process" hint="Voirie, entrée du domaine… (format paysage). Sert aussi de vignette à la vidéo.">
              <ImageField value={v.processImageUrl} onChange={(url) => form.set("processImageUrl", url)} folder="site" />
            </FormField>
            <FormField label="Vidéo de présentation" htmlFor="s-video" error={errors.aboutVideoUrl} hint="Lien YouTube ou Vimeo. Un bouton « lecture » apparaît sur la photo ci-contre.">
              <Input id="s-video" className="h-9" placeholder="https://www.youtube.com/watch?v=…" value={v.aboutVideoUrl} onChange={(e) => form.set("aboutVideoUrl", e.target.value)} />
            </FormField>
          </div>
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Photos des cartes de terrains</p>
                <p className="text-xs text-muted-foreground">Utilisées à tour de rôle sur les cartes « Nos terrains ». Sans photo, un extrait du plan centré sur le lot est affiché. Les deux premières illustrent aussi l&apos;en-tête.</p>
              </div>
              <Button type="button" variant="outline" size="sm" disabled={v.lotImages.length >= 8} onClick={() => form.set("lotImages", [...v.lotImages, ""])}>
                <Plus /> Photo
              </Button>
            </div>
            {v.lotImages.length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Aucune photo : les cartes affichent le plan.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {v.lotImages.map((url, i) => (
                  <li key={i} className="relative">
                    <ImageField
                      value={url || null}
                      folder="site"
                      aspect="aspect-[16/10]"
                      onChange={(next) => form.set("lotImages", next ? v.lotImages.map((x, j) => (j === i ? next : x)) : v.lotImages.filter((_, j) => j !== i))}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </FormSection>

        <FormSection
          title="Points forts du domaine"
          description="Les 4 points forts de la section « Le domaine » (titre et texte court)."
          icon={Sparkles}
          actions={
            <Button type="button" variant="outline" size="sm" disabled={v.highlights.length >= 4} onClick={() => form.set("highlights", [...v.highlights, { title: "", text: "" }])}>
              <Plus /> Atout
            </Button>
          }
        >
          {errors.highlights && <p className="mb-2 text-sm text-destructive">{errors.highlights}</p>}
          <ul className="space-y-2">
            {v.highlights.map((h, i) => (
              <li key={i} className="flex gap-2 rounded-md border p-3">
                <MoveButtons index={i} length={v.highlights.length} onMove={(a, b) => form.set("highlights", move(v.highlights, a, b))} />
                <div className="grid flex-1 gap-2 sm:grid-cols-[0.8fr_1.2fr]">
                  <Input className="h-9 font-semibold" placeholder="Titre (ex. Accès facile)" value={h.title} onChange={(e) => form.set("highlights", v.highlights.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                  <Input className="h-9" placeholder="Texte court (ex. Proche des grands axes)" value={h.text} onChange={(e) => form.set("highlights", v.highlights.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
                </div>
                <Button type="button" variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => form.set("highlights", v.highlights.filter((_, j) => j !== i))} aria-label="Supprimer">
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </FormSection>

        <FormSection
          title="Questions fréquentes"
          description="Affichées sur la page « Nos terrains » : rassurez les acheteurs avant même qu'ils appellent."
          icon={LayoutTemplate}
          actions={
            <Button type="button" variant="outline" size="sm" onClick={() => form.set("faq", [...v.faq, { q: "", a: "" }])}>
              <Plus /> Question
            </Button>
          }
        >
          {v.faq.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune question pour le moment.</p>
          ) : (
            <ol className="space-y-2">
              {v.faq.map((f, i) => (
                <li key={i} className="flex gap-2 rounded-xl border p-3">
                  <MoveButtons index={i} length={v.faq.length} onMove={(a, b) => form.set("faq", move(v.faq, a, b))} />
                  <div className="grid flex-1 gap-2">
                    <Input className="h-9 font-semibold" placeholder="Question" value={f.q} onChange={(e) => form.set("faq", v.faq.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
                    <Textarea rows={3} placeholder="Réponse" value={f.a} onChange={(e) => form.set("faq", v.faq.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
                  </div>
                  <Button type="button" variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => form.set("faq", v.faq.filter((_, j) => j !== i))} aria-label="Supprimer">
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ol>
          )}
        </FormSection>
      </fieldset>
      {canEdit && <SaveBar dirty={form.dirty} pending={pending} onReset={form.reset} />}
    </form>
  )
}

// ─────────────────────────────────────────────────────────────
// Commercial
// ─────────────────────────────────────────────────────────────

export type CommercialValues = {
  currencyLabel: string
  showPricesPublicly: boolean
  reservationsOpen: boolean
  defaultDepositRate: number
  defaultInstallments: number
  defaultFrequency: PaymentFrequency
}

export function CommercialForm({ initial, canEdit, lotsWithoutPlan }: { initial: CommercialValues; canEdit: boolean; lotsWithoutPlan: number }) {
  const form = useFormState(initial)
  const { run, pending } = useServerAction()
  const v = form.value
  const example = resolvePlan(
    { price: 10_000_000, depositAmount: null, installmentsCount: null, frequency: null },
    { defaultDepositRate: v.defaultDepositRate, defaultInstallments: v.defaultInstallments, defaultFrequency: v.defaultFrequency },
  )

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => saveCommercialSettings(v), { onSuccess: form.commit })
      }}
    >
      <fieldset disabled={!canEdit} className="space-y-6">
        <FormSection title="Vente en ligne" description="Ce que voient les visiteurs du site." icon={Globe2}>
          <div className="space-y-3">
            <label className="flex items-center justify-between gap-4 rounded-xl border p-4">
              <span>
                <span className="block text-sm font-semibold">Afficher les prix sur le site</span>
                <span className="text-xs text-muted-foreground">Désactivé : « Prix sur demande » s&apos;affiche à la place.</span>
              </span>
              <Switch checked={v.showPricesPublicly} onCheckedChange={(c) => form.set("showPricesPublicly", c)} />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-xl border p-4">
              <span>
                <span className="block text-sm font-semibold">Accepter les demandes de réservation</span>
                <span className="text-xs text-muted-foreground">Désactivé : le bouton « Réserver » est masqué (site en consultation seule).</span>
              </span>
              <Switch checked={v.reservationsOpen} onCheckedChange={(c) => form.set("reservationsOpen", c)} />
            </label>
            <FormField label="Devise affichée" htmlFor="m-cur" className="max-w-40">
              <Input id="m-cur" className="h-9" value={v.currencyLabel} onChange={(e) => form.set("currencyLabel", e.target.value)} />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Modalités de paiement par défaut" description="Appliquées aux terrains qui n'ont pas de modalités propres." icon={Coins}>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Acompte" htmlFor="m-dep">
              <div className="relative">
                <Input
                  id="m-dep"
                  inputMode="decimal"
                  className="h-9 pr-8 tabular"
                  value={v.defaultDepositRate}
                  onChange={(e) => form.set("defaultDepositRate", Math.min(100, parseOptionalNumber(e.target.value) ?? 0))}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">%</span>
              </div>
            </FormField>
            <FormField label="Nombre de versements" htmlFor="m-count">
              <Input id="m-count" inputMode="numeric" className="h-9 tabular" value={v.defaultInstallments} onChange={(e) => form.set("defaultInstallments", Number(e.target.value.replace(/\D/g, "")) || 0)} />
            </FormField>
            <FormField label="Périodicité" htmlFor="m-freq">
              <FrequencySelect id="m-freq" value={v.defaultFrequency} onChange={(f) => f && f !== "CUSTOM" && form.set("defaultFrequency", f)} />
            </FormField>
          </div>
          {example && (
            <p className="mt-4 rounded-xl bg-secondary/50 p-3 text-sm">
              Exemple pour un terrain à {formatMoney(10_000_000, v.currencyLabel)} : acompte de <strong>{formatMoney(example.deposit, v.currencyLabel)}</strong>
              {example.count > 0 && (
                <>
                  , puis <strong>{example.count} × {formatMoney(example.perInstallment, v.currencyLabel)}</strong> {example.per} ({example.duration}).
                </>
              )}
            </p>
          )}
          {canEdit && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed p-3">
              <p className="text-sm text-muted-foreground">
                {lotsWithoutPlan > 0
                  ? `${lotsWithoutPlan} terrain${lotsWithoutPlan > 1 ? "s" : ""} suit${lotsWithoutPlan > 1 ? "vent" : ""} ces valeurs par défaut. Vous pouvez les figer sur chaque terrain.`
                  : "Tous les terrains ont leurs propres modalités."}
              </p>
              <Button type="button" variant="outline" size="sm" disabled={pending || lotsWithoutPlan === 0 || form.dirty} onClick={() => run(() => applyDefaultPlanToLots())}>
                Appliquer aux terrains sans modalités
              </Button>
            </div>
          )}
        </FormSection>
      </fieldset>
      {canEdit && <SaveBar dirty={form.dirty} pending={pending} onReset={form.reset} />}
    </form>
  )
}
