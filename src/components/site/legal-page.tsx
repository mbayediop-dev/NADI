import { getSettings, type AppSettings } from "@/lib/settings"
import { formatPhone } from "@/lib/phone"
import { Container, Eyebrow } from "@/components/site/section-heading"
import { PageBand } from "@/components/site/skeletons"
import { RichText } from "@/components/site/rich-text"

type Kind = "legal" | "privacy"

function defaultText(kind: Kind, s: AppSettings) {
  const contact = [s.companyAddress, s.companyPhone && `Tél. ${formatPhone(s.companyPhone)}`, s.companyEmail].filter(Boolean).join(" · ")
  if (kind === "legal") {
    return `**Éditeur du site**\n\n${s.companyName}${contact ? ` — ${contact}` : ""}.\n\n**Responsable de la publication**\n\nLe responsable de ${s.companyName}.\n\n**Contenus**\n\nLes informations relatives aux terrains (surfaces, prix, modalités de paiement, disponibilités) sont fournies à titre indicatif et peuvent évoluer. Seuls les documents contractuels signés font foi.\n\n**Propriété intellectuelle**\n\nL'ensemble des contenus de ce site (textes, plans, photographies, logos) est la propriété de ${s.companyName}. Toute reproduction sans autorisation est interdite.`
  }
  return `**Données collectées**\n\nLorsque vous demandez à être recontacté ou réservez un terrain, nous collectons votre nom, votre numéro de téléphone et, le cas échéant, votre adresse e-mail et votre message.\n\n**Utilisation**\n\nCes informations sont utilisées uniquement par ${s.companyName} pour vous recontacter, traiter votre demande et, si vous devenez propriétaire, gérer votre dossier (échéancier, reçus, documents). Elles ne sont ni vendues ni cédées à des tiers.\n\n**Espace propriétaire**\n\nLa connexion à l'espace propriétaire se fait par un code envoyé par SMS. Un cookie de session est déposé pour vous garder connecté ; il ne sert à aucune autre fin.\n\n**Vos droits**\n\nVous pouvez demander l'accès, la rectification ou la suppression de vos données en nous écrivant${s.companyEmail ? ` à ${s.companyEmail}` : ""}.`
}

export async function LegalPage({ kind }: { kind: Kind }) {
  const s = await getSettings()
  const custom = kind === "legal" ? s.legalNotice : s.privacyPolicy
  return (
    <>
      <PageBand>
        <Eyebrow tone="light">{s.companyName}</Eyebrow>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{kind === "legal" ? "Mentions légales" : "Politique de confidentialité"}</h1>
      </PageBand>
      <Container className="py-14 sm:py-20">
        <div className="max-w-3xl space-y-4 text-[1.02rem] leading-relaxed text-muted-foreground">
          <RichText text={custom.trim() || defaultText(kind, s)} />
        </div>
      </Container>
    </>
  )
}
