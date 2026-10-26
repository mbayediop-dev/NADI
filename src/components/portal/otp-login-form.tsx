"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import { ArrowLeft, ArrowRight, Loader2, MessageCircle, MessageSquareText, Phone, Sparkles } from "lucide-react"
import { requestOtp, verifyOtp } from "@/app/espace-client/actions"
import { formatPhone, whatsappLink } from "@/lib/phone"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Label } from "@/components/ui/label"
import { PhoneInput } from "@/components/shared/phone-input"

type Step = "phone" | "code"

export function OtpLoginForm({
  next,
  contact,
}: {
  next?: string
  contact: { phone: string; whatsapp: string; company: string }
}) {
  const router = useRouter()
  const [step, setStep] = React.useState<Step>("phone")
  const [phone, setPhone] = React.useState("")
  const [normalized, setNormalized] = React.useState("")
  const [masked, setMasked] = React.useState("")
  const [devCode, setDevCode] = React.useState<string | undefined>()
  const [code, setCode] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [countdown, setCountdown] = React.useState(0)
  const [shake, setShake] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const [verifying, startVerify] = React.useTransition()

  React.useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  function sendCode(target: string) {
    setError(null)
    startTransition(async () => {
      const result = await requestOtp(target)
      if (!result.ok) {
        setError(result.error)
        const wait = result.error.match(/Patientez (\d+) s/)
        if (wait && step === "code") setCountdown(Number(wait[1]))
        return
      }
      setNormalized(result.data.phone)
      setMasked(result.data.maskedPhone)
      setDevCode(result.data.devCode)
      setCountdown(result.data.resendIn)
      setCode("")
      setStep("code")
    })
  }

  function submitCode(value: string) {
    if (value.length !== 6 || verifying) return
    setError(null)
    startVerify(async () => {
      const result = await verifyOtp(normalized || phone, value, next)
      if (!result.ok) {
        setError(result.error)
        setCode("")
        setShake(true)
        setTimeout(() => setShake(false), 450)
        return
      }
      router.replace(result.data.redirectTo)
      router.refresh()
    })
  }

  const help = contact.whatsapp || contact.phone

  return (
    <div>
      {step === "phone" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (phone) sendCode(phone)
          }}
          className="space-y-6"
        >
          <div>
            <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Phone className="size-5" />
            </span>
            <h2 className="text-2xl font-bold tracking-tight">Connexion</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Saisissez le numéro de téléphone communiqué lors de votre achat. Vous recevrez un code par SMS.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Numéro de téléphone</Label>
            <PhoneInput id="phone" size="lg" value={phone} onChange={setPhone} autoFocus disabled={pending} className="rounded-xl" />
          </div>

          {error && <ErrorMessage>{error}</ErrorMessage>}

          <Button type="submit" size="lg" className="h-12 w-full rounded-xl text-base" disabled={pending || phone.replace(/\D/g, "").length < 6}>
            {pending ? <Loader2 className="animate-spin" /> : <MessageSquareText />}
            Recevoir mon code
          </Button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submitCode(code)
          }}
          className="space-y-6"
        >
          <div>
            <button
              type="button"
              onClick={() => {
                setStep("phone")
                setError(null)
                setDevCode(undefined)
              }}
              className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Modifier le numéro
            </button>
            <h2 className="text-2xl font-bold tracking-tight">Saisissez votre code</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Un code à 6 chiffres a été envoyé par SMS au <span className="font-semibold whitespace-nowrap text-foreground tabular">{masked}</span>.
            </p>
          </div>

          <div className={cn("flex justify-center", shake && "animate-[otp-shake_0.4s_ease-in-out]")}>
            <InputOTP
              maxLength={6}
              value={code}
              onChange={(value) => {
                setCode(value)
                if (error) setError(null)
              }}
              onComplete={submitCode}
              pattern={REGEXP_ONLY_DIGITS}
              autoFocus
              autoComplete="one-time-code"
              inputMode="numeric"
              disabled={verifying}
              aria-label="Code de vérification"
              containerClassName="gap-2"
            >
              <InputOTPGroup className="gap-2 sm:gap-2.5">
                {Array.from({ length: 6 }, (_, i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    aria-invalid={!!error}
                    className="size-12 rounded-xl border text-xl font-semibold first:rounded-xl last:rounded-xl sm:size-14"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          {devCode && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-gold/60 bg-gold/10 px-3.5 py-2.5 text-sm">
              <span className="flex items-center gap-2 text-gold-strong">
                <Sparkles className="size-4 shrink-0" />
                <span>
                  Mode démo — code : <strong className="tracking-[0.2em] tabular">{devCode}</strong>
                </span>
              </span>
              <button
                type="button"
                className="shrink-0 font-semibold text-gold-strong underline underline-offset-4"
                onClick={() => {
                  setCode(devCode)
                  submitCode(devCode)
                }}
              >
                Utiliser
              </button>
            </div>
          )}

          {error && <ErrorMessage>{error}</ErrorMessage>}

          <Button type="submit" size="lg" className="h-12 w-full rounded-xl text-base" disabled={verifying || code.length !== 6}>
            {verifying ? <Loader2 className="animate-spin" /> : <ArrowRight />}
            {verifying ? "Vérification…" : "Accéder à mon espace"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Vous n&apos;avez rien reçu ?{" "}
            {countdown > 0 ? (
              <span className="whitespace-nowrap tabular">Nouvel envoi possible dans {countdown} s</span>
            ) : (
              <button type="button" disabled={pending} onClick={() => sendCode(normalized || phone)} className="font-semibold text-primary underline-offset-4 hover:underline disabled:opacity-50">
                {pending ? "Envoi…" : "Renvoyer le code"}
              </button>
            )}
          </p>
        </form>
      )}

      {help && (
        <div className="mt-10 rounded-2xl border bg-card p-4">
          <p className="text-sm font-semibold">Besoin d&apos;aide ?</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Vous n&apos;êtes pas encore propriétaire ou votre numéro a changé ? Contactez {contact.company}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {contact.whatsapp && (
              <Button variant="outline" size="sm" asChild>
                <a href={whatsappLink(contact.whatsapp, "Bonjour, j'ai besoin d'aide pour accéder à mon espace propriétaire.")} target="_blank" rel="noreferrer">
                  <MessageCircle />
                  WhatsApp
                </a>
              </Button>
            )}
            {contact.phone && (
              <Button variant="outline" size="sm" asChild>
                <a href={`tel:${contact.phone}`}>
                  <Phone />
                  {formatPhone(contact.phone)}
                </a>
              </Button>
            )}
          </div>
        </div>
      )}
      <style>{`@keyframes otp-shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>
    </div>
  )
}

function ErrorMessage({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm font-medium text-destructive">
      {children}
    </p>
  )
}
