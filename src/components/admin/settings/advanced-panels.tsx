"use client"

import * as React from "react"
import {
  ArrowDown,
  ArrowUp,
  BellRing,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  MessageSquare,
  Pencil,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserRound,
  X,
} from "lucide-react"
import type { AdminRole, FieldType } from "@/generated/prisma/enums"
import { formatDateTime, formatRelative, initials } from "@/lib/format"
import { ADMIN_ROLE } from "@/lib/labels"
import { formatPhone } from "@/lib/phone"
import { cn } from "@/lib/utils"
import { useServerAction } from "@/hooks/use-server-action"
import {
  changeMyPassword,
  createAdminUser,
  deleteLotField,
  moveLotField,
  resetAdminPassword,
  saveLotField,
  saveSmsSettings,
  sendTestSms,
  updateAdminUser,
  updateMyProfile,
} from "@/app/admin/(app)/parametres/actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Spinner } from "@/components/ui/spinner"
import { PhoneInput } from "@/components/shared/phone-input"
import { ToneBadge } from "@/components/shared/badges"
import { FormField, FormSection } from "@/components/admin/settings/form-bits"
import { SaveBar, useFormState } from "@/components/admin/settings/settings-shell"

// ─────────────────────────────────────────────────────────────
// Champs personnalisés
// ─────────────────────────────────────────────────────────────

export type FieldRow = { id: string; key: string; label: string; type: FieldType; unit: string | null; options: string[]; showPublic: boolean }

const FIELD_TYPES: Record<FieldType, { label: string; hint: string }> = {
  TEXT: { label: "Texte", hint: "Ex. « À proximité : école, marché »" },
  NUMBER: { label: "Nombre", hint: "Ex. « Pente : 2 % »" },
  BOOLEAN: { label: "Oui / Non", hint: "Ex. « Bornes posées »" },
  SELECT: { label: "Liste de choix", hint: "Ex. « Raccordements : eau + électricité / eau seule »" },
}

function FieldDialog({ field, open, onOpenChange }: { field: FieldRow | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <FieldForm field={field} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  )
}

function FieldForm({ field, onOpenChange }: { field: FieldRow | null; onOpenChange: (o: boolean) => void }) {
  const { run, pending } = useServerAction()
  const [v, setV] = React.useState({
    label: field?.label ?? "",
    type: (field?.type ?? "TEXT") as FieldType,
    unit: field?.unit ?? "",
    options: field?.options ?? [],
    showPublic: field?.showPublic ?? true,
  })
  const [option, setOption] = React.useState("")
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const addOption = () => {
    if (option.trim() && !v.options.includes(option.trim())) setV({ ...v, options: [...v.options, option.trim()] })
    setOption("")
  }
  return (
    <>
      <DialogHeader>
        <DialogTitle>{field ? "Modifier le champ" : "Nouveau champ"}</DialogTitle>
        <DialogDescription>Une information supplémentaire à renseigner sur chaque terrain.</DialogDescription>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          run(() => saveLotField(field?.id ?? null, v), { onSuccess: () => onOpenChange(false), onError: (_, fe) => setErrors(fe ?? {}) })
        }}
      >
        <FormField label="Libellé" htmlFor="f-label" required error={errors.label}>
          <Input
            id="f-label"
            className="h-9"
            value={v.label}
            onChange={(e) => setV({ ...v, label: e.target.value })}
            placeholder="Ex. Raccordements"
            autoFocus
          />
        </FormField>
        <FormField label="Type de valeur" htmlFor="f-type">
          <div id="f-type" className="grid grid-cols-2 gap-2">
            {(Object.keys(FIELD_TYPES) as FieldType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setV({ ...v, type: t })}
                className={cn("rounded-xl border p-3 text-left", v.type === t ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50")}
              >
                <span className="block text-sm font-semibold">{FIELD_TYPES[t].label}</span>
                <span className="text-xs text-muted-foreground">{FIELD_TYPES[t].hint}</span>
              </button>
            ))}
          </div>
        </FormField>
        {v.type === "NUMBER" && (
          <FormField label="Unité (optionnelle)" htmlFor="f-unit" className="max-w-40">
            <Input id="f-unit" className="h-9" value={v.unit} onChange={(e) => setV({ ...v, unit: e.target.value })} placeholder="%, m, km…" />
          </FormField>
        )}
        {v.type === "SELECT" && (
          <FormField label="Choix possibles" htmlFor="f-opt" error={errors.options}>
            <div className="flex flex-wrap gap-1.5">
              {v.options.map((o) => (
                <span key={o} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
                  {o}
                  <button type="button" onClick={() => setV({ ...v, options: v.options.filter((x) => x !== o) })} aria-label={`Retirer ${o}`}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                id="f-opt"
                className="h-9"
                value={option}
                onChange={(e) => setOption(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addOption()
                  }
                }}
                placeholder="Nouveau choix puis Entrée"
              />
              <Button type="button" variant="outline" onClick={addOption}>
                <Plus />
              </Button>
            </div>
          </FormField>
        )}
        <label className="flex items-center justify-between gap-4 rounded-xl border p-3">
          <span>
            <span className="block text-sm font-semibold">Visible sur le site public</span>
            <span className="text-xs text-muted-foreground">Sinon, l&apos;information reste interne.</span>
          </span>
          <Switch checked={v.showPublic} onCheckedChange={(showPublic) => setV({ ...v, showPublic })} />
        </label>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Spinner />}
            Enregistrer
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function FieldsManager({ fields, canEdit }: { fields: FieldRow[]; canEdit: boolean }) {
  const { run, pending } = useServerAction()
  const [editing, setEditing] = React.useState<FieldRow | null>(null)
  const [open, setOpen] = React.useState(false)
  return (
    <FormSection
      title="Informations des terrains"
      description="Ajoutez les informations utiles à vos acheteurs, en plus de la surface, du prix et du type de sol."
      icon={ShieldCheck}
      actions={
        canEdit && (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null)
              setOpen(true)
            }}
          >
            <Plus /> Nouveau champ
          </Button>
        )
      }
    >
      {fields.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Aucun champ personnalisé.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {fields.map((f, i) => (
            <li key={f.id} className="flex items-center gap-3 px-3 py-3">
              {canEdit && (
                <div className="flex flex-col">
                  <Button variant="ghost" size="icon-xs" disabled={pending || i === 0} onClick={() => run(() => moveLotField(f.id, -1))} aria-label="Monter">
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={pending || i === fields.length - 1}
                    onClick={() => run(() => moveLotField(f.id, 1))}
                    aria-label="Descendre"
                  >
                    <ArrowDown />
                  </Button>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {f.label}
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[0.68rem] font-medium text-muted-foreground">{FIELD_TYPES[f.type].label}</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {f.type === "SELECT" ? f.options.join(" · ") : f.type === "NUMBER" && f.unit ? `Unité : ${f.unit}` : `Clé : ${f.key}`}
                </p>
              </div>
              <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
                {f.showPublic ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                {f.showPublic ? "Public" : "Interne"}
              </span>
              {canEdit && (
                <>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setEditing(f)
                      setOpen(true)
                    }}
                    aria-label="Modifier"
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:text-destructive"
                    disabled={pending}
                    onClick={() => window.confirm(`Supprimer le champ « ${f.label} » ?`) && run(() => deleteLotField(f.id))}
                    aria-label="Supprimer"
                  >
                    <Trash2 />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <FieldDialog field={editing} open={open} onOpenChange={setOpen} />
    </FormSection>
  )
}

// ─────────────────────────────────────────────────────────────
// Notifications SMS
// ─────────────────────────────────────────────────────────────

export type SmsValues = { alertPhone: string; smsOnPayment: boolean; smsReminderDaysBefore: number; smsOverdueReminders: boolean }
export type SmsLogRow = { id: string; to: string; body: string; kind: string; provider: string; status: string; error: string | null; createdAt: Date }

const SMS_KIND: Record<string, string> = {
  OTP: "Code de connexion",
  PAYMENT: "Confirmation de versement",
  REMINDER: "Rappel d'échéance",
  ALERT: "Alerte demande",
  MANUAL: "Message",
}

export function SmsPanel({
  initial,
  logs,
  provider,
  canEdit,
  adminPhone,
}: {
  initial: SmsValues
  logs: SmsLogRow[]
  provider: string
  canEdit: boolean
  adminPhone: string | null
}) {
  const form = useFormState(initial)
  const { run, pending } = useServerAction()
  const [testPhone, setTestPhone] = React.useState(adminPhone ?? initial.alertPhone ?? "")
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const v = form.value
  const simulated = provider === "console"
  return (
    <div className="space-y-6">
      <div
        className={cn(
          "flex items-start gap-3 rounded-2xl border p-4 text-sm",
          simulated ? "border-status-reserved/40 bg-status-reserved/10" : "border-status-available/30 bg-status-available/10",
        )}
      >
        {simulated ? (
          <MessageSquare className="mt-0.5 size-4 shrink-0 text-status-reserved-strong" />
        ) : (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-status-available-strong" />
        )}
        <div>
          <p className="font-semibold">
            {simulated
              ? "Mode démonstration : les SMS sont simulés"
              : `Fournisseur SMS actif : ${provider === "orange" ? "Orange SMS API" : provider === "twilio" ? "Twilio" : provider}`}
          </p>
          <p className="text-muted-foreground">
            {simulated
              ? "Les messages apparaissent dans le journal ci-dessous sans être envoyés. Pour envoyer de vrais SMS, renseignez SMS_PROVIDER (orange ou twilio) et les identifiants du fournisseur dans la configuration du serveur."
              : "Les codes de connexion, confirmations et rappels sont envoyés réellement."}
          </p>
        </div>
      </div>

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          run(() => saveSmsSettings(v), { onSuccess: form.commit, onError: (_, fe) => setErrors(fe ?? {}) })
        }}
      >
        <fieldset disabled={!canEdit}>
          <FormSection title="Envois automatiques" description="Restez proche de vos acheteurs sans effort." icon={BellRing}>
            <div className="space-y-3">
              <FormField
                label="Alerte « nouvelle demande »"
                htmlFor="sms-alert"
                error={errors.alertPhone}
                hint="Ce numéro reçoit un SMS à chaque demande de réservation. Laissez vide pour désactiver."
              >
                <div className="max-w-sm">
                  <PhoneInput id="sms-alert" value={v.alertPhone} onChange={(p) => form.set("alertPhone", p)} />
                </div>
              </FormField>
              <label className="flex items-center justify-between gap-4 rounded-xl border p-4">
                <span>
                  <span className="block text-sm font-semibold">Confirmer chaque versement par SMS</span>
                  <span className="text-xs text-muted-foreground">L&apos;acheteur reçoit le montant reçu et le reste à payer.</span>
                </span>
                <Switch checked={v.smsOnPayment} onCheckedChange={(c) => form.set("smsOnPayment", c)} />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
                <span>
                  <span className="block text-sm font-semibold">Rappel avant échéance</span>
                  <span className="text-xs text-muted-foreground">Nombre de jours avant la date (0 = pas de rappel).</span>
                </span>
                <div className="relative w-28">
                  <Input
                    inputMode="numeric"
                    className="h-9 pr-12 text-right tabular"
                    value={v.smsReminderDaysBefore}
                    onChange={(e) => form.set("smsReminderDaysBefore", Math.min(60, Number(e.target.value.replace(/\D/g, "")) || 0))}
                    aria-label="Jours avant l'échéance"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">jours</span>
                </div>
              </div>
              <label className="flex items-center justify-between gap-4 rounded-xl border p-4">
                <span>
                  <span className="block text-sm font-semibold">Relances en cas de retard</span>
                  <span className="text-xs text-muted-foreground">Un SMS de relance hebdomadaire tant qu&apos;une échéance reste impayée.</span>
                </span>
                <Switch checked={v.smsOverdueReminders} onCheckedChange={(c) => form.set("smsOverdueReminders", c)} />
              </label>
            </div>
          </FormSection>
        </fieldset>
        {canEdit && <SaveBar dirty={form.dirty} pending={pending} onReset={form.reset} />}
      </form>

      {canEdit && (
        <FormSection title="SMS de test" description="Vérifiez que l'envoi fonctionne." icon={Send}>
          <div className="flex max-w-lg flex-col gap-2 sm:flex-row">
            <div className="flex-1">
              <PhoneInput value={testPhone} onChange={setTestPhone} />
            </div>
            <Button type="button" variant="outline" className="h-10" disabled={pending || !testPhone} onClick={() => run(() => sendTestSms(testPhone))}>
              <Send /> Envoyer
            </Button>
          </div>
        </FormSection>
      )}

      <FormSection title="Journal des SMS" description="Les 100 derniers messages (les codes de connexion sont masqués)." icon={MessageSquare}>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun SMS envoyé pour le moment.</p>
        ) : (
          <ul className="max-h-[480px] divide-y overflow-y-auto rounded-xl border">
            {logs.map((log) => (
              <li key={log.id} className="space-y-1 px-3 py-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold tabular">{formatPhone(log.to)}</span>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[0.68rem] font-medium text-muted-foreground">{SMS_KIND[log.kind] ?? log.kind}</span>
                  <ToneBadge
                    tone={
                      log.status === "SENT"
                        ? "bg-status-available/12 text-status-available-strong ring-status-available/30"
                        : "bg-status-sold/12 text-status-sold-strong ring-status-sold/30"
                    }
                    className="h-5 px-2 text-[0.68rem]"
                  >
                    {log.status === "SENT" ? (log.provider === "console" ? "Simulé" : "Envoyé") : "Échec"}
                  </ToneBadge>
                  <span className="ml-auto text-xs text-muted-foreground" title={formatDateTime(log.createdAt)} suppressHydrationWarning>
                    {formatRelative(log.createdAt)}
                  </span>
                </div>
                <p className="text-muted-foreground">{log.body}</p>
                {log.error && <p className="text-xs text-destructive">{log.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </FormSection>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Utilisateurs
// ─────────────────────────────────────────────────────────────

export type AdminRow = { id: string; name: string; email: string; phone: string | null; role: AdminRole; active: boolean; lastLoginAt: Date | null }

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
  const values = crypto.getRandomValues(new Uint32Array(10))
  return Array.from(values, (n) => chars[n % chars.length]).join("")
}

function PasswordField({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <div className="flex gap-2">
      <Input id={id} className="h-9 font-mono" value={value} onChange={(e) => onChange(e.target.value)} />
      <Button type="button" variant="outline" onClick={() => onChange(generatePassword())}>
        Générer
      </Button>
    </div>
  )
}

function RoleSelect({ value, onChange, disabled }: { value: AdminRole; onChange: (r: AdminRole) => void; disabled?: boolean }) {
  return (
    <Select value={value} onValueChange={(r) => onChange(r as AdminRole)} disabled={disabled}>
      <SelectTrigger className="h-9 w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(ADMIN_ROLE) as AdminRole[]).map((r) => (
          <SelectItem key={r} value={r}>
            {ADMIN_ROLE[r].label} — {ADMIN_ROLE[r].hint}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function UsersManager({ users, currentId }: { users: AdminRow[]; currentId: string }) {
  const { run, pending } = useServerAction()
  const [createOpen, setCreateOpen] = React.useState(false)
  const [resetting, setResetting] = React.useState<AdminRow | null>(null)
  const [draft, setDraft] = React.useState({ name: "", email: "", phone: "", role: "ADMIN" as AdminRole, password: "" })
  const [newPassword, setNewPassword] = React.useState("")
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  return (
    <FormSection
      title="Comptes d'administration"
      description="Donnez accès à un associé, un comptable ou un assistant, avec le niveau de droits adapté."
      icon={UserRound}
      actions={
        <Button
          size="sm"
          onClick={() => {
            setDraft({ name: "", email: "", phone: "", role: "ADMIN", password: generatePassword() })
            setErrors({})
            setCreateOpen(true)
          }}
        >
          <UserPlus /> Ajouter
        </Button>
      }
    >
      <ul className="divide-y rounded-xl border">
        {users.map((u) => (
          <li key={u.id} className={cn("flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center", !u.active && "opacity-60")}>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">{initials(u.name)}</span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {u.name}
                  {u.id === currentId && <span className="rounded-md bg-gold/20 px-1.5 py-0.5 text-[0.65rem] font-bold text-gold-strong">Vous</span>}
                  {!u.active && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[0.65rem] font-semibold text-muted-foreground">Désactivé</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {u.email}
                  {u.phone ? ` · ${formatPhone(u.phone)}` : ""}
                </p>
                <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                  {u.lastLoginAt ? `Dernière connexion ${formatRelative(u.lastLoginAt)}` : "Jamais connecté"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-44">
                <RoleSelect value={u.role} disabled={pending || u.id === currentId} onChange={(role) => run(() => updateAdminUser(u.id, { role }))} />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => (setResetting(u), setNewPassword(generatePassword()))}
                aria-label="Réinitialiser le mot de passe"
                title="Réinitialiser le mot de passe"
              >
                <KeyRound />
              </Button>
              {u.id !== currentId && (
                <Switch
                  checked={u.active}
                  disabled={pending}
                  onCheckedChange={(active) => run(() => updateAdminUser(u.id, { active }))}
                  aria-label={u.active ? "Désactiver le compte" : "Réactiver le compte"}
                />
              )}
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouveau compte</DialogTitle>
            <DialogDescription>Communiquez le mot de passe provisoire à la personne : elle pourra le changer dans « Mon compte ».</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              run(() => createAdminUser(draft), { onSuccess: () => setCreateOpen(false), onError: (_, fe) => setErrors(fe ?? {}) })
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Nom" htmlFor="u-name" required error={errors.name}>
                <Input id="u-name" className="h-9" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </FormField>
              <FormField label="E-mail" htmlFor="u-email" required error={errors.email}>
                <Input id="u-email" type="email" className="h-9" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
              </FormField>
              <FormField label="Téléphone" htmlFor="u-phone" error={errors.phone}>
                <PhoneInput id="u-phone" value={draft.phone} onChange={(phone) => setDraft({ ...draft, phone })} />
              </FormField>
              <FormField label="Rôle" htmlFor="u-role">
                <RoleSelect value={draft.role} onChange={(role) => setDraft({ ...draft, role })} />
              </FormField>
              <FormField label="Mot de passe provisoire" htmlFor="u-pass" required error={errors.password} className="sm:col-span-2">
                <PasswordField id="u-pass" value={draft.password} onChange={(password) => setDraft({ ...draft, password })} />
              </FormField>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Spinner />}
                Créer le compte
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetting} onOpenChange={(o) => !o && setResetting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau mot de passe</DialogTitle>
            <DialogDescription>Pour {resetting?.name}. Communiquez-le de façon sûre.</DialogDescription>
          </DialogHeader>
          <PasswordField id="u-reset" value={newPassword} onChange={setNewPassword} />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResetting(null)}>
              Annuler
            </Button>
            <Button
              disabled={pending || newPassword.length < 8}
              onClick={() => resetting && run(() => resetAdminPassword(resetting.id, newPassword), { onSuccess: () => setResetting(null) })}
            >
              {pending && <Spinner />}
              Définir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FormSection>
  )
}

// ─────────────────────────────────────────────────────────────
// Mon compte
// ─────────────────────────────────────────────────────────────

export function AccountPanel({ name, email, phone, role }: { name: string; email: string; phone: string | null; role: AdminRole }) {
  const profile = useFormState({ name, phone: phone ?? "" })
  const { run, pending } = useServerAction()
  const [pwd, setPwd] = React.useState({ current: "", next: "", confirm: "" })
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          run(() => updateMyProfile(profile.value), { onSuccess: profile.commit })
        }}
        className="space-y-6"
      >
        <FormSection title="Profil" description={`${email} · ${ADMIN_ROLE[role].label}`} icon={UserRound}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nom affiché" htmlFor="me-name">
              <Input id="me-name" className="h-9" value={profile.value.name} onChange={(e) => profile.set("name", e.target.value)} />
            </FormField>
            <FormField label="Téléphone" htmlFor="me-phone">
              <PhoneInput id="me-phone" value={profile.value.phone} onChange={(p) => profile.set("phone", p)} />
            </FormField>
          </div>
        </FormSection>
        <SaveBar dirty={profile.dirty} pending={pending} onReset={profile.reset} />
      </form>

      <FormSection title="Mot de passe" description="8 caractères minimum." icon={KeyRound}>
        <form
          className="grid max-w-lg gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            setErrors({})
            run(() => changeMyPassword(pwd), {
              onSuccess: () => setPwd({ current: "", next: "", confirm: "" }),
              onError: (_, fe) => setErrors(fe ?? {}),
            })
          }}
        >
          <FormField label="Mot de passe actuel" htmlFor="pw-cur" error={errors.current}>
            <Input
              id="pw-cur"
              type="password"
              autoComplete="current-password"
              className="h-9"
              value={pwd.current}
              onChange={(e) => setPwd({ ...pwd, current: e.target.value })}
            />
          </FormField>
          <FormField label="Nouveau mot de passe" htmlFor="pw-new" error={errors.next}>
            <Input
              id="pw-new"
              type="password"
              autoComplete="new-password"
              className="h-9"
              value={pwd.next}
              onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
            />
          </FormField>
          <FormField label="Confirmation" htmlFor="pw-conf" error={errors.confirm}>
            <Input
              id="pw-conf"
              type="password"
              autoComplete="new-password"
              className="h-9"
              value={pwd.confirm}
              onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
            />
          </FormField>
          <div>
            <Button type="submit" disabled={pending || !pwd.current || pwd.next.length < 8}>
              {pending && <Spinner />}
              Changer le mot de passe
            </Button>
          </div>
        </form>
      </FormSection>
    </div>
  )
}
