// Libellés et couleurs partagés (utilisables côté serveur et client)
import type {
  AdminRole,
  ConstructionStatus,
  DocumentCategory,
  ExpenseCategory,
  ExpenseScope,
  LandOrigin,
  LotStatus,
  MilestoneStatus,
  PaymentFrequency,
  PaymentMethod,
  QuoteStatus,
  RequestStatus,
  SaleStatus,
  Visibility,
} from "@/generated/prisma/enums"

export const LOT_STATUS: Record<LotStatus, { label: string; short: string; color: string; tone: string }> = {
  AVAILABLE: {
    label: "Disponible",
    short: "Libre",
    color: "var(--status-available)",
    tone: "bg-status-available/12 text-status-available-strong ring-status-available/30",
  },
  RESERVED: {
    label: "Réservé",
    short: "Réservé",
    color: "var(--status-reserved)",
    tone: "bg-status-reserved/15 text-status-reserved-strong ring-status-reserved/35",
  },
  SOLD: {
    label: "Vendu",
    short: "Vendu",
    color: "var(--status-sold)",
    tone: "bg-status-sold/12 text-status-sold-strong ring-status-sold/30",
  },
  UNAVAILABLE: {
    label: "Non commercialisé",
    short: "Hors vente",
    color: "var(--status-unavailable)",
    tone: "bg-status-unavailable/15 text-muted-foreground ring-status-unavailable/40",
  },
}

export const LOT_STATUS_ORDER: LotStatus[] = ["AVAILABLE", "RESERVED", "SOLD", "UNAVAILABLE"]

export const FREQUENCY: Record<PaymentFrequency, { label: string; per: string; unit: string }> = {
  WEEKLY: { label: "Hebdomadaire", per: "par semaine", unit: "semaine" },
  BIWEEKLY: { label: "Toutes les 2 semaines", per: "toutes les 2 semaines", unit: "quinzaine" },
  MONTHLY: { label: "Mensuel", per: "par mois", unit: "mois" },
  BIMONTHLY: { label: "Bimestriel", per: "tous les 2 mois", unit: "bimestre" },
  QUARTERLY: { label: "Trimestriel", per: "par trimestre", unit: "trimestre" },
  SEMIANNUAL: { label: "Semestriel", per: "par semestre", unit: "semestre" },
  ANNUAL: { label: "Annuel", per: "par an", unit: "an" },
  CUSTOM: { label: "Personnalisé", per: "par période", unit: "période" },
}

export const FREQUENCY_ORDER: PaymentFrequency[] = [
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
  "BIMONTHLY",
  "QUARTERLY",
  "SEMIANNUAL",
  "ANNUAL",
  "CUSTOM",
]

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  CASH: "Espèces",
  WAVE: "Wave",
  ORANGE_MONEY: "Orange Money",
  FREE_MONEY: "Free Money",
  BANK_TRANSFER: "Virement bancaire",
  CHECK: "Chèque",
  OTHER: "Autre",
}

export const SALE_STATUS: Record<SaleStatus, { label: string; tone: string }> = {
  ACTIVE: { label: "En cours", tone: "bg-primary/10 text-primary ring-primary/25" },
  COMPLETED: {
    label: "Soldé",
    tone: "bg-status-available/12 text-status-available-strong ring-status-available/30",
  },
  CANCELLED: { label: "Annulé", tone: "bg-muted text-muted-foreground ring-border" },
}

export const REQUEST_STATUS: Record<RequestStatus, { label: string; tone: string }> = {
  NEW: { label: "Nouvelle", tone: "bg-gold/20 text-gold-strong ring-gold/40" },
  CONTACTED: { label: "Contacté", tone: "bg-primary/10 text-primary ring-primary/25" },
  ALTERNATIVE_PROPOSED: {
    label: "Autre terrain proposé",
    tone: "bg-status-reserved/15 text-status-reserved-strong ring-status-reserved/35",
  },
  CONVERTED: {
    label: "Convertie en vente",
    tone: "bg-status-available/12 text-status-available-strong ring-status-available/30",
  },
  DECLINED: { label: "Sans suite", tone: "bg-muted text-muted-foreground ring-border" },
}

export const MILESTONE_STATUS: Record<MilestoneStatus, { label: string; tone: string }> = {
  PLANNED: { label: "Planifié", tone: "bg-muted text-muted-foreground ring-border" },
  IN_PROGRESS: { label: "En cours", tone: "bg-gold/20 text-gold-strong ring-gold/40" },
  DONE: {
    label: "Terminé",
    tone: "bg-status-available/12 text-status-available-strong ring-status-available/30",
  },
}

export const VISIBILITY: Record<Visibility, { label: string; hint: string }> = {
  PUBLIC: { label: "Public", hint: "Visible par tous sur le site" },
  CLIENTS: { label: "Propriétaires", hint: "Visible uniquement dans l'espace client" },
  PRIVATE: { label: "Interne", hint: "Visible uniquement par l'administration" },
}

export const DOCUMENT_CATEGORY: Record<DocumentCategory, string> = {
  PLAN: "Plans",
  ADMINISTRATIVE: "Administratif",
  CONTRACT: "Contrat",
  RECEIPT: "Reçu",
  TECHNICAL: "Technique",
  OTHER: "Autre",
  PERMIT: "Permis et autorisations",
  QUOTE: "Offre / devis",
  INVOICE: "Facture",
}

export const ADMIN_ROLE: Record<AdminRole, { label: string; hint: string }> = {
  OWNER: { label: "Responsable", hint: "Accès complet, gestion des utilisateurs" },
  ADMIN: { label: "Gestionnaire", hint: "Gestion complète du site" },
  VIEWER: { label: "Lecture seule", hint: "Consultation uniquement" },
}

export const CONTACT_PREFERENCE: Record<string, string> = {
  CALL: "Appel téléphonique",
  WHATSAPP: "WhatsApp",
  EMAIL: "E-mail",
}

export const INSTALLMENT_STATUS = {
  PAID: { label: "Payé", tone: "bg-status-available/12 text-status-available-strong ring-status-available/30" },
  PARTIAL: { label: "Partiel", tone: "bg-status-reserved/15 text-status-reserved-strong ring-status-reserved/35" },
  LATE: { label: "En retard", tone: "bg-status-sold/12 text-status-sold-strong ring-status-sold/30" },
  DUE_SOON: { label: "Bientôt dû", tone: "bg-gold/20 text-gold-strong ring-gold/40" },
  UPCOMING: { label: "À venir", tone: "bg-muted text-muted-foreground ring-border" },
} as const

// ─────────────────────────────────────────────────────────────
// Construction
// ─────────────────────────────────────────────────────────────

export const CONSTRUCTION_STATUS: Record<ConstructionStatus, { label: string; step: string; tone: string; hint: string }> = {
  REQUESTED: { label: "Demande reçue", step: "Demande", tone: "bg-gold/20 text-gold-strong ring-gold/40", hint: "Demande à étudier" },
  STUDY: { label: "Étude en cours", step: "Étude", tone: "bg-primary/10 text-primary ring-primary/25", hint: "Plans et offre en préparation" },
  OFFER_SENT: {
    label: "Offre envoyée",
    step: "Offre",
    tone: "bg-status-reserved/15 text-status-reserved-strong ring-status-reserved/35",
    hint: "En attente de la réponse du client",
  },
  SIGNED: { label: "Offre acceptée", step: "Accord", tone: "bg-primary/10 text-primary ring-primary/25", hint: "Chantier à démarrer" },
  IN_PROGRESS: { label: "Chantier en cours", step: "Chantier", tone: "bg-gold/20 text-gold-strong ring-gold/40", hint: "Travaux en cours" },
  SUSPENDED: { label: "Chantier suspendu", step: "Suspendu", tone: "bg-status-sold/12 text-status-sold-strong ring-status-sold/30", hint: "Travaux à l'arrêt" },
  DELIVERED: {
    label: "Maison livrée",
    step: "Livraison",
    tone: "bg-status-available/12 text-status-available-strong ring-status-available/30",
    hint: "Chantier terminé",
  },
  CANCELLED: { label: "Sans suite", step: "Sans suite", tone: "bg-muted text-muted-foreground ring-border", hint: "Projet abandonné" },
}

/** Déroulé normal d'un projet (hors suspension et abandon). */
export const CONSTRUCTION_FLOW: ConstructionStatus[] = ["REQUESTED", "STUDY", "OFFER_SENT", "SIGNED", "IN_PROGRESS", "DELIVERED"]

export const LAND_ORIGIN: Record<LandOrigin, { label: string; short: string; hint: string }> = {
  COMPANY_LOT: { label: "Terrain du lotissement", short: "Lotissement", hint: "Le client construit sur un terrain acheté chez nous" },
  OWN_LAND: { label: "Terrain du client", short: "Terrain du client", hint: "Le client possède déjà un terrain ailleurs" },
  NO_LAND: { label: "Sans terrain pour l'instant", short: "Sans terrain", hint: "Maison souhaitée, terrain à trouver" },
}

export const QUOTE_STATUS: Record<QuoteStatus, { label: string; tone: string }> = {
  DRAFT: { label: "Brouillon", tone: "bg-muted text-muted-foreground ring-border" },
  SENT: { label: "Envoyée au client", tone: "bg-status-reserved/15 text-status-reserved-strong ring-status-reserved/35" },
  ACCEPTED: { label: "Acceptée", tone: "bg-status-available/12 text-status-available-strong ring-status-available/30" },
  DECLINED: { label: "Refusée", tone: "bg-status-sold/12 text-status-sold-strong ring-status-sold/30" },
}

export const EXPENSE_SCOPE: Record<ExpenseScope, { label: string; hint: string }> = {
  SITE: { label: "Lotissement", hint: "Viabilisation, voirie, frais du site" },
  PROJECT: { label: "Chantier d'un client", hint: "Dépense rattachée à un projet de construction" },
}

export const EXPENSE_CATEGORY: Record<ExpenseCategory, { label: string; color: string }> = {
  MATERIALS: { label: "Matériaux", color: "var(--chart-1)" },
  LABOR: { label: "Main-d'œuvre", color: "var(--chart-2)" },
  EQUIPMENT: { label: "Matériel et engins", color: "var(--chart-4)" },
  TRANSPORT: { label: "Transport", color: "var(--chart-3)" },
  SUBCONTRACTING: { label: "Sous-traitance", color: "var(--chart-5)" },
  STUDIES: { label: "Études et plans", color: "var(--status-reserved)" },
  PERMITS: { label: "Permis et taxes", color: "var(--status-sold)" },
  UTILITIES: { label: "Eau, électricité, raccordements", color: "var(--status-available)" },
  OTHER: { label: "Autre", color: "var(--status-unavailable)" },
}

export const EXPENSE_CATEGORY_ORDER: ExpenseCategory[] = [
  "MATERIALS",
  "LABOR",
  "EQUIPMENT",
  "TRANSPORT",
  "SUBCONTRACTING",
  "STUDIES",
  "PERMITS",
  "UTILITIES",
  "OTHER",
]
