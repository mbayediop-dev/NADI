"use server"

import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { assertAdmin } from "@/lib/auth/admin"
import { fail, ok, run, UserError, type ActionResult } from "@/lib/action"
import { logActivity } from "@/lib/activity"
import { normalizePhone } from "@/lib/phone"
import { sendSms } from "@/lib/sms"
import { env } from "@/lib/env"

function refresh() {
  revalidatePath("/admin/parametres")
  revalidatePath("/", "layout")
}

const text = (max: number) => z.string().trim().max(max)
const optionalPhone = z
  .string()
  .trim()
  .max(30)
  .transform((v, ctx) => {
    if (!v) return ""
    const phone = normalizePhone(v, env.defaultCountry)
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "Numéro de téléphone invalide" })
      return z.NEVER
    }
    return phone
  })
const imageUrl = z
  .string()
  .max(500)
  .nullish()
  .transform((v) => v || null)
  .refine((v) => !v || v.startsWith("/api/files/public/") || v.startsWith("/"), "Image invalide")
const videoUrl = z
  .string()
  .trim()
  .max(500)
  .nullish()
  .transform((v) => v || null)
  .refine((v) => !v || /^https?:\/\//.test(v) || v.startsWith("/api/files/public/"), "Lien invalide (YouTube, Vimeo ou fichier téléversé)")

async function saveSettings(data: Prisma.SettingsUpdateInput) {
  await db.settings.upsert({ where: { id: 1 }, create: { id: 1, ...(data as Prisma.SettingsCreateInput) }, update: data })
}

// ─────────────────────────────────────────────────────────────
// Entreprise
// ─────────────────────────────────────────────────────────────

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .transform((v) => v || null)
  .refine((v) => !v || /^https?:\/\//.test(v), "Lien invalide (doit commencer par https://)")

const companySchema = z.object({
  companyName: text(80).min(2, "Nom requis"),
  companyTagline: text(160),
  companyPhone: optionalPhone,
  companyWhatsapp: optionalPhone,
  companyEmail: z.union([z.literal(""), z.string().trim().toLowerCase().email("Adresse e-mail invalide")]),
  companyAddress: text(200),
  businessHours: text(80),
  logoUrl: imageUrl,
  socialFacebook: optionalUrl,
  socialInstagram: optionalUrl,
  socialLinkedin: optionalUrl,
  socialYoutube: optionalUrl,
  legalNotice: text(8000),
  privacyPolicy: text(8000),
})

export async function saveCompanySettings(input: z.input<typeof companySchema>): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    await saveSettings(companySchema.parse(input))
    await logActivity({ type: "settings", message: "Informations de l'entreprise mises à jour", actorId: admin.id })
    refresh()
    return ok(null, "Informations enregistrées")
  })
}

// ─────────────────────────────────────────────────────────────
// Site et page d'accueil
// ─────────────────────────────────────────────────────────────

const siteSchema = z.object({
  siteName: text(80).min(2, "Nom du site requis"),
  siteLocation: text(160),
  siteDescription: text(3000),
  siteAreaM2: z.number({ error: "Superficie requise" }).positive("Superficie invalide").max(10_000_000),
  siteLatitude: z.number().min(-90).max(90).nullable(),
  siteLongitude: z.number().min(-180).max(180).nullable(),
  heroEyebrow: text(80),
  heroTitle: text(160),
  heroSubtitle: text(400),
  heroImageUrl: imageUrl,
  processImageUrl: imageUrl,
  aboutVideoUrl: videoUrl,
  amenities: z.array(text(80).min(1, "Équipement requis")).max(8, "8 équipements maximum"),
  lotImages: z.array(z.string().max(500).refine((v) => v.startsWith("/"), "Image invalide")).max(8),
  highlights: z.array(z.object({ title: text(80).min(1, "Titre requis"), text: text(300) })).max(4, "4 atouts maximum"),
  faq: z.array(z.object({ q: text(200).min(1, "Question requise"), a: text(2000).min(1, "Réponse requise") })).max(40),
})

export async function saveSiteSettings(input: z.input<typeof siteSchema>): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const data = siteSchema.parse(input)
    if ((data.siteLatitude == null) !== (data.siteLongitude == null)) return fail("Renseignez à la fois la latitude et la longitude.")
    await saveSettings(data)
    await logActivity({ type: "settings", message: "Présentation du site et page d'accueil mises à jour", actorId: admin.id })
    refresh()
    return ok(null, "Page d'accueil mise à jour")
  })
}

// ─────────────────────────────────────────────────────────────
// Commercial
// ─────────────────────────────────────────────────────────────

const commercialSchema = z.object({
  currencyLabel: text(12).min(1, "Devise requise"),
  showPricesPublicly: z.boolean(),
  reservationsOpen: z.boolean(),
  defaultDepositRate: z.number().min(0).max(100),
  defaultInstallments: z.number().int().min(0).max(600),
  defaultFrequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "BIMONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "CUSTOM"]),
})

export async function saveCommercialSettings(input: z.input<typeof commercialSchema>): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const data = commercialSchema.parse(input)
    if (data.defaultFrequency === "CUSTOM") return fail("Choisissez une périodicité standard pour les modalités par défaut.")
    await saveSettings(data)
    await logActivity({ type: "settings", message: "Paramètres commerciaux mis à jour", actorId: admin.id })
    refresh()
    revalidatePath("/admin/terrains")
    return ok(null, "Paramètres commerciaux enregistrés")
  })
}

// ─────────────────────────────────────────────────────────────
// Notifications SMS
// ─────────────────────────────────────────────────────────────

const smsSchema = z.object({
  alertPhone: optionalPhone,
  smsOnPayment: z.boolean(),
  smsReminderDaysBefore: z.number().int().min(0).max(60),
  smsOverdueReminders: z.boolean(),
})

export async function saveSmsSettings(input: z.input<typeof smsSchema>): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const data = smsSchema.parse(input)
    await saveSettings({ ...data, alertPhone: data.alertPhone || null })
    await logActivity({ type: "settings", message: "Notifications SMS mises à jour", actorId: admin.id })
    refresh()
    return ok(null, "Notifications enregistrées")
  })
}

export async function sendTestSms(phone: string): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const to = normalizePhone(phone, env.defaultCountry)
    if (!to) return fail("Numéro de téléphone invalide")
    const settings = await db.settings.findUnique({ where: { id: 1 }, select: { companyName: true } })
    const result = await sendSms(to, `${settings?.companyName ?? "NADI Group"} : ceci est un SMS de test. La configuration de l'envoi fonctionne.`, "MANUAL")
    if (!result.ok) return fail(`Échec de l'envoi : ${result.error}`)
    await logActivity({ type: "settings", message: `SMS de test envoyé au ${to}`, actorId: admin.id })
    refresh()
    return ok(null, env.smsProvider === "console" ? "SMS simulé : visible dans le journal et la console du serveur" : "SMS de test envoyé")
  })
}

// ─────────────────────────────────────────────────────────────
// Champs personnalisés des terrains
// ─────────────────────────────────────────────────────────────

const fieldSchema = z
  .object({
    label: text(60).min(2, "Libellé requis"),
    type: z.enum(["TEXT", "NUMBER", "BOOLEAN", "SELECT"]),
    unit: text(12)
      .nullish()
      .transform((v) => v || null),
    options: z.array(text(60).min(1)).max(40).default([]),
    showPublic: z.boolean(),
  })
  .refine((v) => v.type !== "SELECT" || v.options.length >= 2, { message: "Ajoutez au moins deux choix", path: ["options"] })

function slugify(label: string) {
  return (
    label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "champ"
  )
}

export async function saveLotField(id: string | null, input: z.input<typeof fieldSchema>): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const data = fieldSchema.parse(input)
    const payload = { ...data, unit: data.type === "NUMBER" ? data.unit : null, options: data.type === "SELECT" ? data.options : [] }
    let field
    if (id) {
      field = await db.lotField.update({ where: { id }, data: payload })
    } else {
      const base = slugify(data.label)
      let key = base
      for (let i = 2; await db.lotField.findUnique({ where: { key } }); i++) key = `${base}_${i}`
      const last = await db.lotField.aggregate({ _max: { sortOrder: true } })
      field = await db.lotField.create({ data: { ...payload, key, sortOrder: (last._max.sortOrder ?? 0) + 1 } })
    }
    await logActivity({ type: "settings", message: `Champ personnalisé « ${field.label} » ${id ? "modifié" : "créé"}`, actorId: admin.id })
    refresh()
    revalidatePath("/admin/terrains")
    return ok({ id: field.id }, id ? "Champ modifié" : "Champ ajouté")
  })
}

export async function deleteLotField(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("ADMIN")
    const field = await db.lotField.delete({ where: { id } })
    await logActivity({ type: "settings", message: `Champ personnalisé « ${field.label} » supprimé`, actorId: admin.id })
    refresh()
    return ok(null, "Champ supprimé (les valeurs déjà saisies sont conservées mais masquées)")
  })
}

export async function moveLotField(id: string, direction: -1 | 1): Promise<ActionResult<null>> {
  return run(async () => {
    await assertAdmin("ADMIN")
    const all = await db.lotField.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } })
    const order = all.map((f) => f.id)
    const index = order.indexOf(id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= order.length) return ok(null)
    ;[order[index], order[target]] = [order[target], order[index]]
    await db.$transaction(order.map((fid, i) => db.lotField.update({ where: { id: fid }, data: { sortOrder: i } })))
    refresh()
    return ok(null)
  })
}

// ─────────────────────────────────────────────────────────────
// Utilisateurs (responsable uniquement)
// ─────────────────────────────────────────────────────────────

const passwordSchema = z.string().min(8, "8 caractères minimum").max(100)

const createUserSchema = z.object({
  name: text(80).min(2, "Nom requis"),
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide"),
  phone: optionalPhone,
  role: z.enum(["OWNER", "ADMIN", "VIEWER"]),
  password: passwordSchema,
})

export async function createAdminUser(input: z.input<typeof createUserSchema>): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const admin = await assertAdmin("OWNER")
    const data = createUserSchema.parse(input)
    const user = await db.adminUser
      .create({
        data: { name: data.name, email: data.email, phone: data.phone || null, role: data.role, passwordHash: await bcrypt.hash(data.password, 10) },
      })
      .catch((error) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new UserError("Un compte existe déjà avec cette adresse e-mail.")
        throw error
      })
    await logActivity({ type: "user", message: `Compte créé pour ${user.name} (${user.email})`, actorId: admin.id })
    refresh()
    return ok({ id: user.id }, `Compte créé pour ${user.name}`)
  })
}

async function assertOwnerRemains(excludeId: string) {
  const owners = await db.adminUser.count({ where: { role: "OWNER", active: true, id: { not: excludeId } } })
  if (owners === 0) throw new UserError("Il doit rester au moins un responsable actif.")
}

const updateUserSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "VIEWER"]).optional(),
  active: z.boolean().optional(),
})

export async function updateAdminUser(id: string, input: z.input<typeof updateUserSchema>): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("OWNER")
    const data = updateUserSchema.parse(input)
    const user = await db.adminUser.findUnique({ where: { id } })
    if (!user) return fail("Utilisateur introuvable")
    if (id === admin.id && (data.active === false || (data.role && data.role !== "OWNER"))) {
      return fail("Vous ne pouvez pas désactiver votre propre compte ni retirer votre rôle de responsable.")
    }
    if (user.role === "OWNER" && (data.active === false || (data.role && data.role !== "OWNER"))) await assertOwnerRemains(id)
    await db.adminUser.update({ where: { id }, data })
    await logActivity({
      type: "user",
      message: data.active === false ? `Compte de ${user.name} désactivé` : data.active === true ? `Compte de ${user.name} réactivé` : `Rôle de ${user.name} modifié`,
      actorId: admin.id,
    })
    refresh()
    return ok(null, data.active === false ? "Compte désactivé" : data.active === true ? "Compte réactivé" : "Rôle mis à jour")
  })
}

export async function resetAdminPassword(id: string, password: string): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("OWNER")
    const value = passwordSchema.parse(password)
    const user = await db.adminUser.update({ where: { id }, data: { passwordHash: await bcrypt.hash(value, 10) } })
    await logActivity({ type: "user", message: `Mot de passe de ${user.name} réinitialisé`, actorId: admin.id })
    return ok(null, `Nouveau mot de passe défini pour ${user.name}`)
  })
}

// ─────────────────────────────────────────────────────────────
// Mon compte
// ─────────────────────────────────────────────────────────────

const profileSchema = z.object({ name: text(80).min(2, "Nom requis"), phone: optionalPhone })

export async function updateMyProfile(input: z.input<typeof profileSchema>): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("VIEWER")
    const data = profileSchema.parse(input)
    await db.adminUser.update({ where: { id: admin.id }, data: { name: data.name, phone: data.phone || null } })
    revalidatePath("/admin", "layout")
    return ok(null, "Profil mis à jour")
  })
}

const changePasswordSchema = z
  .object({ current: z.string().min(1, "Mot de passe actuel requis"), next: passwordSchema, confirm: z.string() })
  .refine((v) => v.next === v.confirm, { message: "Les deux mots de passe ne correspondent pas", path: ["confirm"] })

export async function changeMyPassword(input: z.input<typeof changePasswordSchema>): Promise<ActionResult<null>> {
  return run(async () => {
    const admin = await assertAdmin("VIEWER")
    const data = changePasswordSchema.parse(input)
    const user = await db.adminUser.findUnique({ where: { id: admin.id } })
    if (!user || !(await bcrypt.compare(data.current, user.passwordHash))) return fail("Mot de passe actuel incorrect", { current: "Incorrect" })
    await db.adminUser.update({ where: { id: admin.id }, data: { passwordHash: await bcrypt.hash(data.next, 10) } })
    await logActivity({ type: "user", message: `${user.name} a changé son mot de passe`, actorId: admin.id })
    return ok(null, "Mot de passe modifié")
  })
}
