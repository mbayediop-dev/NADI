// Données de démonstration — npm run db:seed
// ⚠️ Efface toutes les données existantes. Tout le contenu (noms, prix, acheteurs…) est fictif.
import "dotenv/config"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import bcrypt from "bcryptjs"
import { addDays, addMonths, subDays, subMonths } from "date-fns"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import type { PaymentFrequency, PaymentMethod } from "../src/generated/prisma/enums"
import { databaseSsl } from "../src/lib/db-ssl"
import { buildSchedule, resolvePlan, toDueDate } from "../src/lib/finance"
import { buildLayout, PLAN } from "./seed/layout"

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: databaseSsl() }) })

// Générateur pseudo-aléatoire déterministe
let seed = 20261023
const rand = () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}
const pick = <T,>(items: T[]) => items[Math.floor(rand() * items.length)]
const between = (min: number, max: number) => Math.round(min + rand() * (max - min))

const NOW = new Date()

const BUYERS: [string, string, string, string?][] = [
  ["Aminata", "Diop", "+221771234501", "Enseignante"],
  ["Moussa", "Ndiaye", "+33612345678", "Ingénieur (Paris)"],
  ["Fatou", "Sow", "+221781234502", "Commerçante"],
  ["Ibrahima", "Fall", "+221761234503", "Comptable"],
  ["Awa", "Ba", "+221701234504", "Infirmière"],
  ["Cheikh", "Sarr", "+221771234505", "Chef d'entreprise"],
  ["Mariama", "Diallo", "+221781234506", "Pharmacienne"],
  ["Ousmane", "Gueye", "+221751234507", "Transporteur"],
  ["Ndeye Fatou", "Mbaye", "+221771234508", "Juriste"],
  ["Abdoulaye", "Kane", "+221761234509", "Fonctionnaire"],
  ["Khady", "Faye", "+221781234510", "Couturière"],
  ["Mamadou", "Cissé", "+221771234511", "Médecin"],
  ["Aïssatou", "Seck", "+221701234512", "Banquière"],
  ["Pape", "Thiam", "+221771234513", "Architecte"],
  ["Rokhaya", "Ndour", "+221781234514", "Professeure"],
  ["Serigne", "Touré", "+221761234515", "Commerçant"],
  ["Coumba", "Niang", "+221771234516", "Sage-femme"],
  ["Babacar", "Diouf", "+221751234517", "Informaticien"],
  ["Astou", "Camara", "+221781234518", "Entrepreneure"],
  ["Lamine", "Sy", "+221771234519", "Policier"],
]

const METHODS: PaymentMethod[] = ["WAVE", "WAVE", "WAVE", "ORANGE_MONEY", "ORANGE_MONEY", "CASH", "BANK_TRANSFER", "FREE_MONEY"]

function makePdf(title: string, lines: string[]) {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
  const content = [
    "BT /F1 20 Tf 60 770 Td (" + esc(title) + ") Tj ET",
    "0.75 0.6 0.35 RG 2 w 60 755 m 535 755 l S",
    ...lines.map((l, i) => `BT /F1 11 Tf 60 ${720 - i * 18} Td (${esc(l)}) Tj ET`),
    "BT /F1 8 Tf 60 40 Td (Document de demonstration genere automatiquement - NADI Group) Tj ET",
  ].join("\n")
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ]
  let out = "%PDF-1.4\n"
  const offsets: number[] = []
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"))
    out += `${i + 1} 0 obj\n${obj}\nendobj\n`
  })
  const xref = Buffer.byteLength(out, "latin1")
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(out, "latin1")
}

async function storeFile(key: string, data: Buffer) {
  const file = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR ?? "./storage", key)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, data)
  return data.byteLength
}

async function main() {
  console.log("→ Nettoyage")
  await db.$transaction([
    db.activity.deleteMany(),
    db.smsLog.deleteMany(),
    db.otpCode.deleteMany(),
    db.document.deleteMany(),
    db.media.deleteMany(),
    db.siteUpdate.deleteMany(),
    db.milestone.deleteMany(),
    db.reservationRequest.deleteMany(),
    db.payment.deleteMany(),
    db.installment.deleteMany(),
    db.sale.deleteMany(),
    db.buyer.deleteMany(),
    db.lot.deleteMany(),
    db.lotField.deleteMany(),
    db.settings.deleteMany(),
    db.adminUser.deleteMany(),
  ])

  console.log("→ Administrateur")
  const admin = await db.adminUser.create({
    data: {
      email: (process.env.SEED_ADMIN_EMAIL ?? "admin@nadigroup.sn").toLowerCase(),
      name: "Responsable NADI",
      phone: "+221770000000",
      role: "OWNER",
      passwordHash: await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? "Nadi2026!", 10),
    },
  })

  console.log("→ Paramètres")
  const settings = await db.settings.create({
    data: {
      id: 1,
      companyName: "NADI Group",
      companyTagline: "Des terrains d'aujourd'hui pour les générations de demain.",
      companyAbout:
        "Nous nous engageons à offrir des terrains de qualité, un suivi rigoureux et une transparence totale tout au long du processus. NADI Group accompagne les familles, les investisseurs et la diaspora à chaque étape : choix du terrain, paiement échelonné, suivi des travaux et remise des documents.",
      companyPhone: "+221771234567",
      companyWhatsapp: "+221771234567",
      companyEmail: "contact@nadigroup.sn",
      companyAddress: "Dakar, Sénégal",
      businessHours: "Lun - Ven, 9h - 18h",
      socialFacebook: "https://www.facebook.com/",
      socialInstagram: "https://www.instagram.com/",
      socialLinkedin: "https://www.linkedin.com/",
      socialYoutube: "https://www.youtube.com/",
      siteName: "Domaine NADI",
      siteLocation: "Sénégal",
      siteDescription:
        "Un domaine pensé pour offrir un **cadre de vie moderne, accessible et durable**. Profitez de terrains viabilisés, dans un environnement en pleine croissance, à proximité des commodités essentielles.",
      siteAreaM2: 40040,
      amenities: [
        "Voiries aménagées",
        "Réseaux (eau, électricité, assainissement)",
        "Terrains bornés et numérotés",
        "Accès facile",
        "Espace vert arboré",
        "Éclairage public",
        "Mosquée",
        "Accès direct à la route nationale",
      ],
      highlights: [
        { title: "Accès facile", text: "Proche des grands axes" },
        { title: "Environnement agréable", text: "Quartier en plein développement" },
        { title: "Cadre sécurisé", text: "Bornage et aménagement de qualité" },
        { title: "Fort potentiel", text: "Pour habitation ou investissement" },
      ],
      faq: [
        { q: "Comment réserver un terrain ?", a: "Sélectionnez un terrain disponible sur le plan, puis cliquez sur « Réserver ce terrain » et laissez vos coordonnées. Un conseiller NADI Group vous rappelle pour finaliser la réservation." },
        { q: "Quel acompte dois-je verser ?", a: "Le montant de l'acompte est indiqué sur la fiche de chaque terrain. Il est versé à la signature, le solde est ensuite réparti en versements réguliers." },
        { q: "Quels moyens de paiement acceptez-vous ?", a: "Wave, Orange Money, Free Money, virement bancaire, chèque ou espèces contre reçu. Chaque versement est enregistré et visible dans votre espace propriétaire." },
        { q: "Puis-je acheter depuis l'étranger ?", a: "Oui. La réservation, le suivi des paiements et la consultation des documents se font entièrement en ligne." },
        { q: "Comment accéder à mon espace propriétaire ?", a: "Une fois votre achat enregistré, connectez-vous avec votre numéro de téléphone : vous recevez un code de vérification par SMS." },
        { q: "Que se passe-t-il en cas de retard de paiement ?", a: "Vous recevez un rappel par SMS. Contactez-nous rapidement : nous trouvons ensemble une solution adaptée." },
      ],
      heroEyebrow: "Un domaine, de grandes opportunités",
      heroTitle: "Construisez votre avenir | sur un domaine d'exception",
      heroSubtitle:
        "NADI Group développe un domaine de 4 hectares au Sénégal, avec des terrains viabilisés, dans un environnement agréable et propice à la réalisation de vos projets de vie ou d'investissement.",
      heroImageUrl: "/images/demo/hero.jpg",
      processImageUrl: "/images/demo/process.jpg",
      lotImages: ["/images/demo/lot-1.jpg", "/images/demo/lot-2.jpg", "/images/demo/lot-3.jpg"],
      planImageUrl: "/plan/site-plan.svg",
      planWidth: PLAN.width,
      planHeight: PLAN.height,
      defaultDepositRate: 20,
      defaultInstallments: 12,
      defaultFrequency: "MONTHLY",
      alertPhone: "+221770000000",
    },
  })

  console.log("→ Champs personnalisés")
  await db.lotField.createMany({
    data: [
      { key: "raccordements", label: "Raccordements", type: "SELECT", options: ["Eau + électricité", "Eau seule", "En cours"], sortOrder: 1 },
      { key: "bornage", label: "Bornes posées", type: "BOOLEAN", sortOrder: 2 },
      { key: "proximite", label: "À proximité", type: "TEXT", sortOrder: 3 },
    ],
  })

  console.log("→ Terrains")
  const layout = buildLayout()
  const soil: Record<string, string> = {
    A: "Sablo-argileux (deck-dior)", B: "Sablo-argileux (deck-dior)", C: "Sablo-argileux (deck-dior)",
    D: "Sableux (dior)", E: "Sableux (dior)", F: "Sableux (dior)",
    G: "Latéritique compact", H: "Latéritique compact", I: "Latéritique compact",
  }
  const orientation = (y0: number) => ([10, 64, 114].includes(y0) ? "Nord" : "Sud")
  const plans: Record<string, { count: number; frequency: PaymentFrequency }> = {
    road: { count: 12, frequency: "MONTHLY" },
    avenue: { count: 18, frequency: "MONTHLY" },
    highway: { count: 8, frequency: "QUARTERLY" },
  }

  const lots = []
  for (const l of layout) {
    let ppm2 = 37500
    if (l.frontage === "avenue") ppm2 *= 1.15
    if (l.frontage === "highway") ppm2 *= 1.25
    if (l.corner) ppm2 *= 1.08
    const price = Math.round((l.areaM2 * ppm2) / 50000) * 50000
    const plan = plans[l.frontage]
    const features = [
      l.corner ? "Angle" : null,
      l.frontage === "avenue" ? "Sur l'avenue" : null,
      l.frontage === "highway" ? "Vitrine commerciale" : null,
      l.areaM2 >= 400 ? "Grande surface" : null,
    ].filter(Boolean) as string[]
    const description = l.unavailable
      ? "Emprise réservée au château d'eau et au poste électrique du lotissement."
      : `${l.corner ? "Lot d'angle" : "Lot"} de ${l.areaM2} m² (${l.frontageM} m × ${l.depthM} m) avec façade sur ${l.facing}. ${
          l.frontage === "highway"
            ? "Emplacement idéal pour un commerce ou un immeuble de rapport."
            : l.frontage === "avenue"
              ? "Cadre arboré et circulation fluide : parfait pour une villa familiale."
              : "Rue calme, idéale pour une résidence principale."
        }`
    lots.push(
      await db.lot.create({
        data: {
          number: l.number,
          block: l.block,
          areaM2: l.areaM2,
          price: l.unavailable ? null : price,
          status: l.unavailable ? "UNAVAILABLE" : "AVAILABLE",
          depositAmount: l.unavailable ? null : Math.max(1_000_000, Math.round((price * 0.2) / 500000) * 500000),
          installmentsCount: l.unavailable ? null : plan.count,
          frequency: l.unavailable ? null : plan.frequency,
          soilType: soil[l.block],
          position: `Façade sur ${l.facing}${l.corner ? ", angle de rue" : ""} — îlot ${l.block}`,
          orientation: orientation(l.y0),
          frontageM: l.frontageM,
          depthM: l.depthM,
          description,
          features,
          isFeatured: l.corner && l.frontage === "avenue",
          attributes: {
            raccordements: l.block === "I" || l.block === "H" ? "En cours" : "Eau + électricité",
            bornage: true,
            proximite: l.frontage === "highway" ? "Route nationale, arrêt de bus" : l.block === "D" || l.block === "F" ? "Espace vert, mosquée" : "Avenue principale",
          },
          polygon: l.polygon,
        },
      }),
    )
  }

  console.log("→ Acheteurs")
  const buyers = []
  for (const [firstName, lastName, phone, profession] of BUYERS) {
    buyers.push(
      await db.buyer.create({
        data: {
          firstName,
          lastName,
          phone,
          profession,
          email: `${firstName.split(" ")[0].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}.${lastName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}@exemple.sn`,
          city: phone.startsWith("+33") ? "Paris" : pick(["Dakar", "Rufisque", "Thiès", "Pikine", "Guédiawaye"]),
          country: phone.startsWith("+33") ? "France" : "Sénégal",
          idType: "CNI",
          idNumber: `1${between(100000000, 999999999)}${between(1000, 9999)}`,
          createdAt: subMonths(NOW, between(2, 12)),
        },
      }),
    )
  }

  console.log("→ Ventes, échéanciers et versements")
  // terrains vendus (positions dans le plan) : répartis sur le site, avec une préférence pour l'avenue
  const soldNumbers = [2, 3, 7, 8, 9, 12, 14, 16, 17, 19, 22, 23, 26, 29, 30, 33, 35, 41, 43, 44, 47, 52, 55, 60, 63, 70]
  const reservedNumbers = [5, 21, 31, 46, 58]
  const owners = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 1, 5, 11, 13, 3, 8]
  const profiles = ["ok", "ok", "late", "ok", "settled", "ok", "ok", "ahead", "late", "ok", "ok", "partial", "ok", "settled", "ok", "late", "ok", "ok", "ok", "ok", "ok", "settled", "ok", "late", "ok", "ok"]

  let saleSeq = 0
  const receiptCounters: Record<number, number> = {}
  const paymentsToCreate: { saleId: string; amount: number; paidAt: Date; method: PaymentMethod; reference: string | null }[] = []
  const createdSales = []

  for (let i = 0; i < soldNumbers.length; i++) {
    const lot = lots[soldNumbers[i] - 1]
    const buyer = buyers[owners[i]]
    const profile = profiles[i]
    const monthsAgo = profile === "settled" ? between(9, 13) : between(1, 11)
    const signedAt = toDueDate(subDays(subMonths(NOW, monthsAgo), between(0, 20)))
    const plan = resolvePlan(lot, { defaultDepositRate: 20, defaultInstallments: 12, defaultFrequency: "MONTHLY" })!
    const frequency = plan.frequency
    const firstDueDate = toDueDate(addMonths(signedAt, frequency === "QUARTERLY" ? 3 : 1))
    const schedule = buildSchedule({
      price: plan.price,
      depositAmount: plan.deposit,
      depositDueDate: signedAt,
      installmentsCount: profile === "settled" ? Math.min(plan.count, 6) : plan.count,
      frequency,
      firstDueDate,
    })
    saleSeq++
    const sale = await db.sale.create({
      data: {
        reference: `VTE-${signedAt.getFullYear()}-${String(saleSeq).padStart(4, "0")}`,
        lotId: lot.id,
        buyerId: buyer.id,
        price: plan.price,
        depositAmount: plan.deposit,
        depositDueDate: signedAt,
        installmentsCount: schedule.filter((s) => s.index > 0).length,
        frequency,
        firstDueDate,
        signedAt,
        createdAt: signedAt,
        installments: { create: schedule },
      },
      include: { installments: true },
    })
    await db.lot.update({ where: { id: lot.id }, data: { status: "SOLD" } })
    createdSales.push({ sale, buyer, lot, profile })

    // Versements selon le profil
    const due = schedule.filter((s) => s.dueDate <= NOW)
    const method = pick(METHODS)
    let stopAfter = due.length
    if (profile === "late") stopAfter = Math.max(1, due.length - between(1, 3))
    for (let k = 0; k < due.length; k++) {
      const line = due[k]
      if (k >= stopAfter) break
      let amount = line.amount
      if (profile === "partial" && k === due.length - 1) amount = Math.round(line.amount / 2 / 1000) * 1000
      const paidAt = k === 0 ? signedAt : addDays(line.dueDate, between(-4, profile === "late" ? 12 : 5))
      if (paidAt > NOW) continue
      paymentsToCreate.push({
        saleId: sale.id,
        amount,
        paidAt,
        method: k === 0 && line.amount > 2_000_000 ? "BANK_TRANSFER" : method,
        reference: method === "WAVE" || method === "ORANGE_MONEY" ? `TX${between(10000000, 99999999)}` : null,
      })
    }
    if (profile === "settled") {
      const remaining = schedule.filter((s) => s.dueDate > NOW)
      for (const line of remaining) {
        paymentsToCreate.push({ saleId: sale.id, amount: line.amount, paidAt: subDays(NOW, between(5, 40)), method, reference: null })
      }
    }
    if (profile === "ahead") {
      const next = schedule.find((s) => s.dueDate > NOW)
      if (next) paymentsToCreate.push({ saleId: sale.id, amount: next.amount, paidAt: subDays(NOW, between(1, 6)), method, reference: null })
    }
  }

  paymentsToCreate.sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime())
  for (const p of paymentsToCreate) {
    const year = p.paidAt.getFullYear()
    receiptCounters[year] = (receiptCounters[year] ?? 0) + 1
    await db.payment.create({
      data: {
        ...p,
        receiptNumber: `REC-${year}-${String(receiptCounters[year]).padStart(5, "0")}`,
        recordedById: admin.id,
        createdAt: p.paidAt,
      },
    })
  }

  // Ventes soldées
  for (const { sale, profile } of createdSales) {
    if (profile === "settled") await db.sale.update({ where: { id: sale.id }, data: { status: "COMPLETED" } })
  }

  console.log("→ Options / réservations")
  for (const n of reservedNumbers) {
    const lot = lots[n - 1]
    await db.lot.update({
      where: { id: lot.id },
      data: { status: "RESERVED", reservedNote: `Option posée jusqu'au ${addDays(NOW, between(5, 20)).toLocaleDateString("fr-FR")} en attente de l'acompte.` },
    })
  }

  console.log("→ Demandes de réservation")
  const available = await db.lot.findMany({ where: { status: "AVAILABLE" } })
  const requestSeeds = [
    { fullName: "Mame Diarra Sène", phone: "+221771112233", status: "NEW", hoursAgo: 3, contact: "WHATSAPP", message: "Bonjour, je suis intéressée par ce terrain. Est-il possible de payer sur 24 mois ?" },
    { fullName: "Youssou Diagne", phone: "+221781112244", status: "NEW", hoursAgo: 9, contact: "CALL", message: "Je souhaite visiter le site ce week-end." },
    { fullName: "Ramatoulaye Bâ", phone: "+33698765432", status: "NEW", hoursAgo: 26, contact: "WHATSAPP", message: "Je vis en France, je voudrais réserver à distance." },
    { fullName: "El Hadji Ndao", phone: "+221761112255", status: "NEW", hoursAgo: 40, contact: "CALL", message: null },
    { fullName: "Sokhna Mbengue", phone: "+221701112266", status: "CONTACTED", hoursAgo: 80, contact: "CALL", message: "Intéressée par deux lots voisins." },
    { fullName: "Modou Lo", phone: "+221771112277", status: "CONTACTED", hoursAgo: 130, contact: "EMAIL", message: "Merci de m'envoyer le cahier des charges." },
    { fullName: "Adama Konaté", phone: "+221781112288", status: "ALTERNATIVE_PROPOSED", hoursAgo: 200, contact: "WHATSAPP", message: "Je voulais le lot d'angle sur l'avenue." },
    { fullName: "Bineta Gaye", phone: "+221761112299", status: "DECLINED", hoursAgo: 400, contact: "CALL", message: "Budget insuffisant pour le moment." },
  ] as const
  for (const r of requestSeeds) {
    const lot = pick(available)
    const createdAt = new Date(NOW.getTime() - r.hoursAgo * 3600 * 1000)
    await db.reservationRequest.create({
      data: {
        lotId: lot.id,
        fullName: r.fullName,
        phone: r.phone,
        email: r.contact === "EMAIL" ? "modou.lo@exemple.sn" : null,
        message: r.message,
        preferredContact: r.contact,
        status: r.status,
        proposedLotId: r.status === "ALTERNATIVE_PROPOSED" ? pick(available).id : null,
        adminNotes: r.status === "CONTACTED" ? "Rappelé, visite prévue samedi." : r.status === "ALTERNATIVE_PROPOSED" ? "Lot demandé déjà vendu, autre lot d'angle proposé." : null,
        handledAt: r.status === "NEW" ? null : addDays(createdAt, 1),
        createdAt,
      },
    })
  }
  // Deux demandes converties en ventes
  for (const { sale, buyer, lot } of createdSales.slice(-2)) {
    await db.reservationRequest.create({
      data: {
        lotId: lot.id,
        fullName: `${buyer.firstName} ${buyer.lastName}`,
        phone: buyer.phone,
        status: "CONVERTED",
        buyerId: buyer.id,
        saleId: sale.id,
        handledAt: sale.signedAt,
        createdAt: subDays(sale.signedAt, 3),
      },
    })
  }

  console.log("→ Avancement des travaux")
  const milestones = [
    { title: "Bornage et délimitation des lots", description: "Implantation des bornes par le géomètre et matérialisation de chaque lot.", progress: 100, status: "DONE", start: 13, end: 11 },
    { title: "Terrassement et ouverture des voies", description: "Décapage, nivellement et ouverture de l'avenue principale et des rues secondaires.", progress: 100, status: "DONE", start: 11, end: 8 },
    { title: "Voirie : chaussée et trottoirs", description: "Couche de base, revêtement et bordures de trottoirs.", progress: 70, status: "IN_PROGRESS", start: 7, end: -2 },
    { title: "Adduction d'eau potable", description: "Pose du réseau de distribution et des branchements en attente pour chaque lot.", progress: 55, status: "IN_PROGRESS", start: 5, end: -3 },
    { title: "Électrification et éclairage public", description: "Réseau basse tension, poste de transformation et candélabres solaires.", progress: 25, status: "IN_PROGRESS", start: 3, end: -5 },
    { title: "Assainissement et drainage", description: "Caniveaux, regards et évacuation des eaux pluviales.", progress: 10, status: "PLANNED", start: 1, end: -6 },
    { title: "Aménagement de l'espace vert", description: "Plantations, allées piétonnes et aire de jeux.", progress: 0, status: "PLANNED", start: -4, end: -8 },
  ] as const
  const createdMilestones = []
  for (const [i, m] of milestones.entries()) {
    createdMilestones.push(
      await db.milestone.create({
        data: {
          title: m.title,
          description: m.description,
          progress: m.progress,
          status: m.status,
          startDate: toDueDate(subMonths(NOW, m.start)),
          endDate: toDueDate(subMonths(NOW, m.end)),
          sortOrder: i,
        },
      }),
    )
  }

  const updates = [
    { title: "Lancement officiel des travaux de viabilisation", body: "Les engins sont sur site ! Après la validation du plan de lotissement, les travaux de terrassement ont démarré. Le géomètre a implanté l'ensemble des bornes : chaque lot est désormais matérialisé sur le terrain.", m: 0, days: 330, visibility: "PUBLIC", image: "/images/demo/chantier-3.jpg", caption: "Délimitation des lots" },
    { title: "Les voies sont ouvertes", body: "L'avenue principale de 14 m et les quatre rues secondaires sont ouvertes et nivelées. Vous pouvez dès à présent accéder à votre lot en véhicule. Prochaine étape : la chaussée et les trottoirs.", m: 1, days: 240, visibility: "PUBLIC", image: "/images/demo/chantier-1.jpg", caption: "Aménagement des voies" },
    { title: "Réseau d'eau : 55 % des canalisations posées", body: "Les équipes ont posé plus de la moitié du réseau de distribution d'eau potable. Les branchements en attente sont installés au fur et à mesure devant chaque lot.", m: 3, days: 45, visibility: "PUBLIC", image: "/images/demo/chantier-2.jpg", caption: "Travaux de viabilisation" },
    { title: "Vue d'ensemble du domaine", body: "Survol du site après l'ouverture des voies : un environnement naturel et accessible, à quelques minutes de la mer.", m: null, days: 20, visibility: "PUBLIC", image: "/images/demo/chantier-4.jpg", caption: "Vue d'ensemble du site" },
    { title: "Visite de chantier réservée aux propriétaires", body: "Chers propriétaires, une visite guidée du site est organisée le premier samedi du mois prochain à 10 h. Rendez-vous à l'entrée principale. Merci de confirmer votre présence par WhatsApp.", m: null, days: 12, visibility: "CLIENTS", image: null, caption: null },
    { title: "Chaussée de l'avenue principale : 70 % réalisés", body: "La couche de base est terminée sur l'avenue principale et le revêtement progresse. Les bordures de trottoirs et les candélabres sont en cours de pose.", m: 2, days: 4, visibility: "PUBLIC", image: "/images/demo/process.jpg", caption: "Voirie et éclairage" },
  ] as const
  for (const u of updates) {
    await db.siteUpdate.create({
      data: {
        title: u.title,
        body: u.body,
        visibility: u.visibility,
        milestoneId: u.m == null ? null : createdMilestones[u.m].id,
        publishedAt: subDays(NOW, u.days),
        pinned: false,
        ...(u.image ? { media: { create: [{ type: "IMAGE", url: u.image, mimeType: "image/jpeg", caption: u.caption }] } } : {}),
      },
    })
  }

  console.log("→ Documents")
  const docs = [
    { title: "Plan de lotissement", category: "PLAN", visibility: "PUBLIC", lines: ["Cite NADI - plan de lotissement", "Superficie totale : 4 ha", "Nombre de lots : 74", "Voirie : avenue de 14 m, rues de 10 m"] },
    { title: "Brochure commerciale", category: "OTHER", visibility: "PUBLIC", lines: ["Terrains viabilises de 300 a 400 m2", "Paiement echelonne", "Espace client en ligne"] },
    { title: "Cahier des charges du lotissement", category: "ADMINISTRATIVE", visibility: "CLIENTS", lines: ["Regles de construction", "Hauteur maximale : R+2", "Retrait de 3 m sur rue", "Cloture obligatoire"] },
    { title: "Rapport d'étude géotechnique", category: "TECHNICAL", visibility: "CLIENTS", lines: ["Nature des sols par ilot", "Recommandations de fondations"] },
  ] as const
  for (const d of docs) {
    const filename = `${d.title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}.pdf`
    const key = `private/documents/seed-${filename}`
    const size = await storeFile(key, makePdf(d.title.normalize("NFD").replace(/[̀-ͯ]/g, ""), [...d.lines]))
    await db.document.create({
      data: { title: d.title, category: d.category, visibility: d.visibility, storageKey: key, filename, mimeType: "application/pdf", size },
    })
  }
  // Contrat propre à chaque vente
  for (const { sale, buyer, lot } of createdSales) {
    const filename = `contrat-${sale.reference.toLowerCase()}.pdf`
    const key = `private/contracts/${filename}`
    const size = await storeFile(
      key,
      makePdf(`Contrat de reservation ${sale.reference}`, [
        `Acquereur : ${buyer.firstName} ${buyer.lastName}`.normalize("NFD").replace(/[̀-ͯ]/g, ""),
        `Terrain n. ${lot.number} - ilot ${lot.block} - ${lot.areaM2} m2`,
        `Prix : ${sale.price.toLocaleString("fr-FR").replace(/ /g, " ")} FCFA`,
        `Acompte : ${sale.depositAmount.toLocaleString("fr-FR").replace(/ /g, " ")} FCFA`,
      ]),
    )
    await db.document.create({
      data: { title: "Contrat de réservation", category: "CONTRACT", visibility: "CLIENTS", saleId: sale.id, storageKey: key, filename, mimeType: "application/pdf", size },
    })
  }

  console.log("→ Journal d'activité")
  await db.activity.createMany({
    data: [
      { type: "settings", message: "Paramètres du site initialisés", actorId: admin.id, createdAt: subDays(NOW, 30) },
      { type: "update", message: "Actualité publiée : « Chaussée de l'avenue principale : 70 % réalisés »", actorId: admin.id, createdAt: subDays(NOW, 4) },
    ],
  })

  const counts = {
    lots: await db.lot.count(),
    sales: await db.sale.count(),
    payments: await db.payment.count(),
    buyers: await db.buyer.count(),
    requests: await db.reservationRequest.count(),
  }
  console.log("✓ Terminé", counts)
  console.log(`  Admin : ${admin.email} / ${process.env.SEED_ADMIN_PASSWORD ?? "Nadi2026!"}`)
  console.log(`  Propriétaire de démo : ${buyers[0].firstName} ${buyers[0].lastName} — ${buyers[0].phone}`)
  void settings
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
