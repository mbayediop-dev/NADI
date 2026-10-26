"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react"
import { loginAdmin, setupFirstAdmin } from "@/app/admin/auth-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginForm({ setup, next }: { setup: boolean; next?: string }) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const [showPassword, setShowPassword] = React.useState(false)

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = setup
        ? await setupFirstAdmin({
            name: String(form.get("name") ?? ""),
            email: String(form.get("email") ?? ""),
            password: String(form.get("password") ?? ""),
          })
        : await loginAdmin({ email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") }, next)
      if (!result.ok) return setError(result.error)
      router.replace(result.data.redirectTo)
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <span className="mb-4 grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
          <LockKeyhole className="size-5" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">{setup ? "Créer le compte responsable" : "Connexion"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {setup
            ? "Première utilisation : créez le compte qui administrera le site."
            : "Accédez à l'espace de gestion NADI Group."}
        </p>
      </div>

      {setup && (
        <div className="space-y-2">
          <Label htmlFor="name">Nom complet</Label>
          <Input id="name" name="name" required autoComplete="name" className="h-11" />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" placeholder="vous@nadigroup.sn" className="h-11" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Mot de passe</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            minLength={setup ? 8 : undefined}
            autoComplete={setup ? "new-password" : "current-password"}
            className="h-11 pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {setup ? "Créer le compte" : "Se connecter"}
      </Button>
    </form>
  )
}
