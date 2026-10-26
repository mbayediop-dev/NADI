import {
  BadgeDollarSign,
  FileText,
  HardHat,
  Inbox,
  LayoutDashboard,
  Map,
  Settings,
  SquareStack,
  Users,
  Wallet,
} from "lucide-react"

import type { LucideIcon } from "lucide-react"

export type NavCounts = { newRequests: number; lateSales: number }

type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean; badge?: keyof NavCounts }

export const ADMIN_NAV: { label: string; items: NavItem[] }[] = [
  {
    label: "Pilotage",
    items: [
      { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
      { href: "/admin/plan", label: "Plan du site", icon: Map },
    ],
  },
  {
    label: "Commercial",
    items: [
      { href: "/admin/terrains", label: "Terrains", icon: SquareStack },
      { href: "/admin/demandes", label: "Demandes", icon: Inbox, badge: "newRequests" },
      { href: "/admin/acheteurs", label: "Acheteurs", icon: Users },
      { href: "/admin/ventes", label: "Ventes", icon: BadgeDollarSign, badge: "lateSales" },
      { href: "/admin/versements", label: "Versements", icon: Wallet },
    ],
  },
  {
    label: "Chantier & documents",
    items: [
      { href: "/admin/avancement", label: "Avancement", icon: HardHat },
      { href: "/admin/documents", label: "Documents", icon: FileText },
    ],
  },
  {
    label: "Configuration",
    items: [{ href: "/admin/parametres", label: "Paramètres", icon: Settings }],
  },
]

/** Titres des pages pour le fil d'Ariane */
export const ADMIN_TITLES: Record<string, string> = {
  admin: "Tableau de bord",
  plan: "Plan du site",
  terrains: "Terrains",
  demandes: "Demandes",
  acheteurs: "Acheteurs",
  ventes: "Ventes",
  versements: "Versements",
  avancement: "Avancement",
  documents: "Documents",
  parametres: "Paramètres",
  nouveau: "Nouveau",
  nouvelle: "Nouvelle",
  import: "Import",
  modifier: "Modifier",
}
