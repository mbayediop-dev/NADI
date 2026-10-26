// Libellés et couleurs partagés (utilisables côté serveur et client)
import type {
  AdminRole,
  DocumentCategory,
  LotStatus,
  MilestoneStatus,
  PaymentFrequency,
  PaymentMethod,
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
