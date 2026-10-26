"use client"

import { BellRing, Building2, Coins, LayoutTemplate, SlidersHorizontal, UserRound, Users } from "lucide-react"
import { SettingsShell, type SettingsTab } from "@/components/admin/settings/settings-shell"

const TABS: (SettingsTab & { ownerOnly?: boolean })[] = [
  { key: "entreprise", label: "Entreprise", description: "Identité, coordonnées, réseaux sociaux et pages légales.", icon: Building2 },
  { key: "site", label: "Site et page d'accueil", description: "Présentation du domaine, en-tête, photos, atouts et FAQ.", icon: LayoutTemplate },
  { key: "commercial", label: "Commercial", description: "Affichage des prix, réservations et modalités de paiement par défaut.", icon: Coins },
  { key: "champs", label: "Champs personnalisés", description: "Informations supplémentaires décrivant chaque terrain.", icon: SlidersHorizontal },
  { key: "sms", label: "Notifications SMS", description: "Alertes, confirmations de versement et rappels d'échéance.", icon: BellRing },
  { key: "utilisateurs", label: "Utilisateurs", description: "Comptes ayant accès à l'administration.", icon: Users, ownerOnly: true },
  { key: "compte", label: "Mon compte", description: "Vos informations et votre mot de passe.", icon: UserRound },
]

export function SettingsTabs({ panels, isOwner, initialTab }: { panels: Record<string, React.ReactNode>; isOwner: boolean; initialTab?: string }) {
  return <SettingsShell tabs={TABS.filter((t) => isOwner || !t.ownerOnly)} panels={panels} initialTab={initialTab} />
}
