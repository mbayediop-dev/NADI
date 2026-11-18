// Données de démonstration de la rubrique « Construction » (appelé par prisma/seed.ts). Tout est fictif.
import { readFile } from "node:fs/promises"
import path from "node:path"
import { addMonths, subDays, subMonths } from "date-fns"
import type { PrismaClient } from "../../src/generated/prisma/client"
import type { ExpenseCategory, PaymentMethod } from "../../src/generated/prisma/enums"
import { DEFAULT_PHASES, quoteTotal, type QuoteItem } from "../../src/lib/construction"
import { toDueDate } from "../../src/lib/finance"

type Person = { id: string; firstName: string; lastName: string; phone: string; email: string | null }
type Ctx = {
  db: PrismaClient
  now: Date
  adminId: string
  buyers: Person[]
  /** Ventes créées par le seed : sert à construire sur le terrain d'un propriétaire */
  sales: { buyer: Person; lot: { id: string; number: string } }[]
  storeFile: (key: string, data: Buffer) => Promise<number>
  makePdf: (title: string, lines: string[]) => Buffer
}

const ascii = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "")
const IMAGES = "/images/construction"

const VILLA_QUOTE: QuoteItem[] = [
  { section: "Études et plans", label: "Plans d'architecte, étude de structure et dossier de permis", quantity: 1, unit: "forfait", unitPrice: 1_800_000 },
  { section: "Gros œuvre", label: "Terrassement, fondations et soubassement", quantity: 1, unit: "forfait", unitPrice: 6_500_000 },
  { section: "Gros œuvre", label: "Élévation des murs du rez-de-chaussée et de l'étage", quantity: 320, unit: "m²", unitPrice: 28_000 },
  { section: "Gros œuvre", label: "Dalles, poteaux, poutres et escalier en béton armé", quantity: 1, unit: "forfait", unitPrice: 8_200_000 },
  { section: "Toiture et étanchéité", label: "Étanchéité de la toiture-terrasse", quantity: 110, unit: "m²", unitPrice: 18_000 },
  { section: "Menuiseries", label: "Portes et fenêtres en aluminium vitré", quantity: 1, unit: "forfait", unitPrice: 4_600_000 },
  { section: "Électricité", label: "Installation électrique complète", quantity: 1, unit: "forfait", unitPrice: 2_400_000 },
  { section: "Plomberie et sanitaires", label: "Plomberie, sanitaires et raccordements", quantity: 1, unit: "forfait", unitPrice: 2_700_000 },
  { section: "Revêtements et peinture", label: "Enduits, carrelage et peinture", quantity: 1, unit: "forfait", unitPrice: 5_860_000 },
]

/** Crée les lignes d'un versement et son numéro de reçu (série RCC). */
function receiptSeq(year: number) {
  let n = 0
  return () => `RCC-${year}-${String(++n).padStart(5, "0")}`
}

export async function seedConstruction({ db, now, adminId, buyers, sales, storeFile, makePdf }: Ctx) {
  const year = now.getFullYear()
  const nextReceipt = receiptSeq(year)

  // ── Catalogue : le plan fourni (immeuble R+4), présenté sous plusieurs angles
  const model = await db.houseModel.create({
    data: {
      name: "Immeuble R+4",
      tagline: "Un immeuble contemporain sur cinq niveaux, à habiter ou à mettre en location",
      description:
        "Immeuble de quatre étages sur rez-de-chaussée : garage et entrée indépendante au rez-de-chaussée, logements avec balcons vitrés aux étages et toit-terrasse aménagé sous pergola. Le plan s'adapte à la taille de votre terrain et au nombre de logements souhaité.",
      levels: "R+4",
      images: [`${IMAGES}/immeuble-perspective.jpg`, `${IMAGES}/immeuble-face.jpg`, `${IMAGES}/immeuble-angle.jpg`, `${IMAGES}/immeuble-balcons.jpg`, `${IMAGES}/immeuble-entree.jpg`, `${IMAGES}/immeuble-rdc.jpg`],
      features: ["Garage au rez-de-chaussée", "Balcons vitrés à chaque étage", "Toit-terrasse avec pergola", "Entrée indépendante"],
      sortOrder: 0,
    },
  })

  // ── 1. Chantier en cours sur le terrain d'un propriétaire (le compte de démonstration de l'espace client)
  const owner = sales.find((s) => s.buyer.id === buyers[0].id) ?? sales[0]
  const contract = quoteTotal(VILLA_QUOTE)
  const start = toDueDate(subMonths(now, 4))
  const villa = await db.constructionProject.create({
    data: {
      reference: `CST-${year}-0001`,
      title: "Villa R+1 de 4 chambres",
      status: "IN_PROGRESS",
      source: "PORTAL",
      buyerId: owner.buyer.id,
      contactName: `${owner.buyer.firstName} ${owner.buyer.lastName}`,
      contactPhone: owner.buyer.phone,
      contactEmail: owner.buyer.email,
      landOrigin: "COMPANY_LOT",
      lotId: owner.lot.id,
      customPlan: true,
      requirements: "Villa familiale sur deux niveaux : séjour ouvert, 4 chambres dont une suite parentale, terrasse couverte, garage pour un véhicule.",
      budget: 45_000_000,
      contractAmount: contract,
      startDate: start,
      plannedEndDate: toDueDate(addMonths(start, 10)),
      notes: "Cliente très impliquée : la tenir informée à chaque étape. Carrelage à valider avec elle avant commande.",
      createdAt: subMonths(now, 6),
    },
  })
  await db.constructionQuote.create({
    data: {
      projectId: villa.id,
      number: `OFF-${year}-0001`,
      title: "Offre de construction — Villa R+1 de 4 chambres",
      status: "ACCEPTED",
      items: VILLA_QUOTE,
      amount: contract,
      notes: "Délai d'exécution : 10 mois à compter du démarrage. Prix ferme, hors mobilier et aménagements extérieurs.",
      sentAt: subMonths(now, 5),
      respondedAt: subDays(subMonths(now, 5), -6),
      createdAt: subDays(subMonths(now, 5), 4),
    },
  })
  const progress = [100, 100, 60, 0, 0, 0, 0, 0, 0]
  await db.constructionPhase.createMany({
    data: DEFAULT_PHASES.map((p, i) => ({
      projectId: villa.id,
      title: p.title,
      weight: p.weight,
      sortOrder: i,
      progress: progress[i],
      status: progress[i] >= 100 ? "DONE" : progress[i] > 0 ? "IN_PROGRESS" : "PLANNED",
      startDate: i < 3 ? toDueDate(addMonths(start, i)) : null,
      endDate: i < 2 ? toDueDate(addMonths(start, i + 1)) : null,
    })),
  })
  const phases = await db.constructionPhase.findMany({ where: { projectId: villa.id }, orderBy: { sortOrder: "asc" }, select: { id: true } })

  const shares = [
    { label: "À la signature (30 %)", share: 0.3, offset: 0 },
    { label: "Fin des fondations (20 %)", share: 0.2, offset: 2 },
    { label: "Fin de l'élévation des murs (20 %)", share: 0.2, offset: 4 },
    { label: "Dalle et toiture terminées (20 %)", share: 0.2, offset: 7 },
    { label: "Remise des clés (10 %)", share: 0.1, offset: 10 },
  ]
  let rest = contract
  await db.constructionInstallment.createMany({
    data: shares.map((s, index) => {
      const amount = index === shares.length - 1 ? rest : Math.round((contract * s.share) / 1000) * 1000
      rest -= amount
      return { projectId: villa.id, index, label: s.label, dueDate: toDueDate(addMonths(start, s.offset)), amount }
    }),
  })
  const firstCall = Math.round((contract * 0.3) / 1000) * 1000
  const secondCall = Math.round((contract * 0.2) / 1000) * 1000
  const payments: { amount: number; paidAt: Date; method: PaymentMethod; reference: string }[] = [
    { amount: firstCall, paidAt: toDueDate(subDays(start, 3)), method: "BANK_TRANSFER", reference: "VIR-88214" },
    { amount: secondCall, paidAt: toDueDate(addMonths(start, 2)), method: "BANK_TRANSFER", reference: "VIR-90377" },
    { amount: 4_000_000, paidAt: toDueDate(subDays(now, 12)), method: "WAVE", reference: `TX${Math.round(now.getTime() / 100000)}` },
  ]
  await db.constructionPayment.createMany({
    data: payments.map((p) => ({ ...p, projectId: villa.id, receiptNumber: nextReceipt(), recordedById: adminId })),
  })

  const expenses: [number, ExpenseCategory, string, string | null, number | null, string | null, number | null, number, number, boolean][] = [
    // [jours, catégorie, désignation, fournisseur, quantité, unité, prix unitaire, montant, étape, visible du client]
    [118, "STUDIES", "Plans d'architecte et étude de structure", "Cabinet Archi-Sahel", null, null, null, 1_450_000, 0, true],
    [110, "PERMITS", "Frais de dépôt du permis de construire", "Mairie", null, null, null, 185_000, 0, true],
    [96, "EQUIPMENT", "Location d'une pelle mécanique (terrassement)", "SOTRAMAT", 3, "jour", 180_000, 540_000, 1, true],
    [92, "MATERIALS", "Ciment CEM II 32,5", "Quincaillerie Touba", 220, "sac", 4_300, 946_000, 1, true],
    [90, "MATERIALS", "Fer à béton HA 10 et HA 12", "Fer & Acier du Cap-Vert", 3.2, "tonne", 620_000, 1_984_000, 1, true],
    [88, "MATERIALS", "Sable et gravier (fondations)", "Carrière de Diack", 6, "camion", 95_000, 570_000, 1, true],
    [70, "LABOR", "Équipe de maçons — fondations et soubassement", null, null, null, null, 1_650_000, 1, true],
    [48, "MATERIALS", "Agglos de 15 et de 20", "Briqueterie de Rufisque", 4_200, "unité", 420, 1_764_000, 2, true],
    [45, "TRANSPORT", "Livraison des agglos sur le chantier", "Transports Gueye", 3, "voyage", 45_000, 135_000, 2, true],
    [30, "LABOR", "Équipe de maçons — élévation du rez-de-chaussée", null, null, null, null, 1_280_000, 2, true],
    [21, "UTILITIES", "Branchement provisoire d'eau de chantier", "SEN'EAU", null, null, null, 96_000, 2, true],
    [9, "OTHER", "Gardiennage du chantier (3 mois)", null, 3, "mois", 60_000, 180_000, 2, false],
  ]
  await db.expense.createMany({
    data: expenses.map(([days, category, label, supplier, quantity, unit, unitPrice, amount, phase, visible]) => ({
      scope: "PROJECT" as const,
      projectId: villa.id,
      phaseId: phases[phase]?.id ?? null,
      category,
      label,
      supplier,
      quantity,
      unit,
      unitPrice,
      amount,
      spentAt: toDueDate(subDays(now, days)),
      method: (amount > 900_000 ? "BANK_TRANSFER" : "CASH") as PaymentMethod,
      reference: supplier ? `FAC-${String(1000 + days)}` : null,
      visibleToClient: visible,
      recordedById: adminId,
    })),
  })

  // Journal de chantier : les photos sont copiées dans le stockage privé (visibles du seul client du projet)
  const journal: { days: number; title: string; body: string; phase: number; photos: string[] }[] = [
    {
      days: 85,
      title: "Les fondations sont lancées",
      body: "Le terrassement est terminé et les fouilles sont ouvertes. Les équipes montent le soubassement et mettent en place les attentes des poteaux.",
      phase: 1,
      photos: ["chantier-01.jpg", "chantier-02.jpg", "chantier-03.jpg"],
    },
    {
      days: 40,
      title: "Soubassement terminé, les murs montent",
      body: "Le soubassement a reçu sa protection contre l'humidité. L'élévation des murs du rez-de-chaussée a commencé.",
      phase: 2,
      photos: ["chantier-06.jpg", "chantier-04.jpg", "chantier-05.jpg"],
    },
    {
      days: 6,
      title: "Rez-de-chaussée : les murs sont à hauteur",
      body: "Les murs du rez-de-chaussée sont montés et les poteaux sont ferraillés. Prochaine étape : le coffrage et le coulage de la dalle.",
      phase: 2,
      photos: ["chantier-10.jpg", "chantier-11.jpg", "chantier-07.jpg"],
    },
  ]
  for (const entry of journal) {
    const update = await db.constructionUpdate.create({
      data: { projectId: villa.id, phaseId: phases[entry.phase]?.id ?? null, title: entry.title, body: entry.body, publishedAt: toDueDate(subDays(now, entry.days)) },
    })
    const media = []
    for (const [i, file] of entry.photos.entries()) {
      const key = `private/construction/seed-${update.id.slice(-6)}-${file}`
      const size = await storeFile(key, await readFile(path.join(process.cwd(), "public/images/construction", file)))
      media.push({ updateId: update.id, type: "IMAGE" as const, storageKey: key, mimeType: "image/jpeg", size, sortOrder: i })
    }
    await db.constructionMedia.createMany({ data: media })
  }

  const docs = [
    { title: "Plans de la villa (permis de construire)", category: "PLAN", visibility: "CLIENTS", fromClient: false, lines: ["Plan de masse", "Plans des niveaux", "Facades et coupes"] },
    { title: "Permis de construire", category: "PERMIT", visibility: "CLIENTS", fromClient: false, lines: ["Autorisation de construire", "Villa R+1 - lotissement"] },
    { title: "Contrat de construction signé", category: "CONTRACT", visibility: "CLIENTS", fromClient: false, lines: ["Contrat de construction", `Montant : ${contract} FCFA`, "Delai : 10 mois"] },
    { title: "Étude de prix détaillée", category: "TECHNICAL", visibility: "PRIVATE", fromClient: false, lines: ["Debourses secs", "Marge previsionnelle"] },
    { title: "Croquis de la façade souhaitée", category: "OTHER", visibility: "CLIENTS", fromClient: true, lines: ["Croquis transmis par la cliente"] },
  ] as const
  for (const d of docs) {
    const filename = `${ascii(d.title).replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}.pdf`
    const key = `private/construction-docs/seed-${filename}`
    const size = await storeFile(key, makePdf(ascii(d.title), [...d.lines]))
    await db.document.create({
      data: { title: d.title, category: d.category, visibility: d.visibility, fromClient: d.fromClient, constructionProjectId: villa.id, storageKey: key, filename, mimeType: "application/pdf", size },
    })
  }

  // ── 2. Client de la diaspora avec son propre terrain : offre envoyée, en attente de réponse
  const diaspora = buyers[1]
  const immeubleQuote: QuoteItem[] = [
    { section: "Études et plans", label: "Adaptation du plan R+4 au terrain, étude de sol et de structure", quantity: 1, unit: "forfait", unitPrice: 4_500_000 },
    { section: "Gros œuvre", label: "Fondations, structure en béton armé et maçonnerie des 5 niveaux", quantity: 1, unit: "forfait", unitPrice: 78_000_000 },
    { section: "Toiture et étanchéité", label: "Étanchéité et toit-terrasse avec pergola", quantity: 1, unit: "forfait", unitPrice: 9_500_000 },
    { section: "Menuiseries", label: "Menuiseries aluminium, garde-corps vitrés, porte de garage", quantity: 1, unit: "forfait", unitPrice: 21_000_000 },
    { section: "Électricité", label: "Électricité des parties communes et des logements", quantity: 1, unit: "forfait", unitPrice: 12_500_000 },
    { section: "Plomberie et sanitaires", label: "Plomberie, sanitaires et réseaux", quantity: 1, unit: "forfait", unitPrice: 13_000_000 },
    { section: "Revêtements et peinture", label: "Enduits, carrelage, peinture intérieure et façades", quantity: 1, unit: "forfait", unitPrice: 26_500_000 },
  ]
  const immeuble = await db.constructionProject.create({
    data: {
      reference: `CST-${year}-0002`,
      title: "Immeuble R+4 à Keur Massar",
      status: "OFFER_SENT",
      source: "ADMIN",
      buyerId: diaspora.id,
      contactName: `${diaspora.firstName} ${diaspora.lastName}`,
      contactPhone: diaspora.phone,
      contactEmail: diaspora.email,
      landOrigin: "OWN_LAND",
      landAddress: "Keur Massar, Dakar",
      landAreaM2: 300,
      landReference: "TF 12 458/DK",
      houseModelId: model.id,
      requirements: "Immeuble de rapport sur mon terrain de Keur Massar : garage au rez-de-chaussée et deux appartements par étage. Je vis à Paris : je veux suivre le chantier à distance.",
      budget: 170_000_000,
      createdAt: subDays(now, 35),
    },
  })
  await db.constructionQuote.create({
    data: {
      projectId: immeuble.id,
      number: `OFF-${year}-0002`,
      title: "Offre de construction — Immeuble R+4 à Keur Massar",
      status: "SENT",
      items: immeubleQuote,
      amount: quoteTotal(immeubleQuote),
      notes: "Délai d'exécution : 16 mois. Paiement en cinq appels de fonds liés à l'avancement. Offre valable 60 jours.",
      validUntil: toDueDate(addMonths(now, 2)),
      sentAt: subDays(now, 5),
      createdAt: subDays(now, 9),
    },
  })
  await db.constructionPhase.createMany({ data: DEFAULT_PHASES.map((p, i) => ({ projectId: immeuble.id, title: p.title, weight: p.weight, sortOrder: i })) })

  // ── 3. Maison livrée (terrain du lotissement), contrat soldé
  const delivered = sales.find((s) => s.buyer.id === buyers[5].id) ?? sales[1]
  const deliveredStart = toDueDate(subMonths(now, 13))
  const maison = await db.constructionProject.create({
    data: {
      reference: `CST-${year}-0003`,
      title: "Maison de plain-pied de 3 chambres",
      status: "DELIVERED",
      source: "ADMIN",
      buyerId: delivered.buyer.id,
      contactName: `${delivered.buyer.firstName} ${delivered.buyer.lastName}`,
      contactPhone: delivered.buyer.phone,
      contactEmail: delivered.buyer.email,
      landOrigin: "COMPANY_LOT",
      lotId: delivered.lot.id,
      customPlan: true,
      contractAmount: 24_500_000,
      startDate: deliveredStart,
      plannedEndDate: toDueDate(addMonths(deliveredStart, 8)),
      deliveredAt: subMonths(now, 4),
      createdAt: subMonths(now, 14),
    },
  })
  await db.constructionPhase.createMany({
    data: DEFAULT_PHASES.map((p, i) => ({ projectId: maison.id, title: p.title, weight: p.weight, sortOrder: i, progress: 100, status: "DONE" as const })),
  })
  await db.constructionInstallment.createMany({
    data: [
      { projectId: maison.id, index: 0, label: "À la signature (40 %)", dueDate: deliveredStart, amount: 9_800_000 },
      { projectId: maison.id, index: 1, label: "Hors d'eau (40 %)", dueDate: toDueDate(addMonths(deliveredStart, 5)), amount: 9_800_000 },
      { projectId: maison.id, index: 2, label: "Remise des clés (20 %)", dueDate: toDueDate(addMonths(deliveredStart, 9)), amount: 4_900_000 },
    ],
  })
  await db.constructionPayment.createMany({
    data: [
      { amount: 9_800_000, paidAt: deliveredStart, method: "BANK_TRANSFER" as PaymentMethod },
      { amount: 9_800_000, paidAt: toDueDate(addMonths(deliveredStart, 5)), method: "BANK_TRANSFER" as PaymentMethod },
      { amount: 4_900_000, paidAt: toDueDate(addMonths(deliveredStart, 9)), method: "CHECK" as PaymentMethod },
    ].map((p) => ({ ...p, projectId: maison.id, receiptNumber: nextReceipt(), recordedById: adminId })),
  })
  await db.expense.createMany({
    data: [
      { category: "MATERIALS" as ExpenseCategory, label: "Matériaux de gros œuvre (ciment, fer, agglos)", amount: 8_900_000, months: 11 },
      { category: "LABOR" as ExpenseCategory, label: "Main-d'œuvre (maçonnerie, ferraillage, coffrage)", amount: 5_200_000, months: 9 },
      { category: "SUBCONTRACTING" as ExpenseCategory, label: "Lots techniques : électricité et plomberie", amount: 3_100_000, months: 7 },
      { category: "MATERIALS" as ExpenseCategory, label: "Menuiseries, carrelage et peinture", amount: 3_650_000, months: 5 },
    ].map(({ months, ...e }) => ({ ...e, scope: "PROJECT" as const, projectId: maison.id, spentAt: toDueDate(subMonths(now, months)), method: "BANK_TRANSFER" as PaymentMethod, recordedById: adminId })),
  })

  // ── 4. Demande reçue depuis le site : pas encore de fiche client ni de terrain
  await db.constructionProject.create({
    data: {
      reference: `CST-${year}-0004`,
      title: "Maison sur mesure",
      status: "REQUESTED",
      source: "SITE",
      contactName: "Sokhna Diagne",
      contactPhone: "+221775550142",
      contactEmail: "sokhna.diagne@exemple.sn",
      landOrigin: "NO_LAND",
      customPlan: true,
      requirements: "Je souhaite une maison de 3 chambres avec une cour, mais je n'ai pas encore de terrain. Pouvez-vous me proposer un terrain dans votre lotissement et un plan adapté ?",
      budget: 30_000_000,
      createdAt: subDays(now, 2),
    },
  })

  // ── Dépenses du lotissement lui-même (viabilisation, voirie, frais du site)
  const site: [number, ExpenseCategory, string, string | null, number][] = [
    [300, "STUDIES", "Levé topographique et bornage des 74 lots", "Cabinet de géomètre Diouf", 3_800_000],
    [290, "PERMITS", "Frais d'autorisation de lotir", "Services de l'urbanisme", 1_250_000],
    [240, "EQUIPMENT", "Location d'une niveleuse et d'un compacteur — ouverture des voies", "SOTRAMAT", 6_400_000],
    [232, "MATERIALS", "Latérite pour la couche de base de la voirie", "Carrière de Diack", 9_800_000],
    [120, "SUBCONTRACTING", "Pose du réseau d'eau potable (1re tranche)", "Hydro-Services", 14_500_000],
    [118, "MATERIALS", "Canalisations PVC et regards", "Quincaillerie Touba", 5_300_000],
    [40, "LABOR", "Équipe de manœuvres — bordures et trottoirs", null, 2_150_000],
    [14, "UTILITIES", "Raccordement électrique du site (acompte)", "Senelec", 4_000_000],
  ]
  await db.expense.createMany({
    data: site.map(([days, category, label, supplier, amount]) => ({
      scope: "SITE" as const,
      category,
      label,
      supplier,
      amount,
      spentAt: toDueDate(subDays(now, days)),
      method: "BANK_TRANSFER" as PaymentMethod,
      visibleToClient: false,
      recordedById: adminId,
    })),
  })

  return { projects: await db.constructionProject.count(), expenses: await db.expense.count() }
}
