import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { connection } from "next/server"
import { FileCheck2, HardHat, ReceiptText, ShieldCheck } from "lucide-react"
import { getBuyer } from "@/lib/auth/client"
import { getSettings } from "@/lib/settings"
import { Logo } from "@/components/brand/logo"
import { Skeleton } from "@/components/ui/skeleton"
import { OtpLoginForm } from "@/components/portal/otp-login-form"

export const metadata: Metadata = {
  title: "Espace propriétaire",
  description: "Connectez-vous à votre espace propriétaire NADI Group avec votre numéro de téléphone.",
  robots: { index: false },
}

const BENEFITS = [
  { icon: ReceiptText, title: "Vos paiements", text: "Échéancier, versements et reste à payer, à jour en temps réel." },
  { icon: FileCheck2, title: "Vos documents", text: "Contrat, reçus et documents du lotissement, toujours à portée de main." },
  { icon: HardHat, title: "L'avancement du chantier", text: "Photos, vidéos et étapes de la viabilisation de votre site." },
]

export default function ClientLoginPage({ searchParams }: PageProps<"/espace-client/connexion">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative overflow-hidden bg-pine-deep text-white">
        <div
          aria-hidden
          className="absolute inset-0 scale-110 opacity-25 mix-blend-luminosity"
          style={{ backgroundImage: "url(/plan/site-plan.svg)", backgroundSize: "cover", backgroundPosition: "center" }}
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-pine-deep/70 via-pine-deep/90 to-pine-deep lg:bg-gradient-to-br lg:from-pine-deep lg:via-pine-deep/92 lg:to-pine/75" />
        <div aria-hidden className="absolute -top-24 -right-24 size-72 rounded-full bg-gold/20 blur-3xl" />

        <div className="relative flex h-full flex-col px-5 pt-6 pb-10 sm:px-10 lg:p-12">
          <Link href="/" className="inline-flex w-fit">
            <Logo tone="light" />
          </Link>

          <div className="mt-10 max-w-md lg:mt-auto">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold tracking-wide text-gold backdrop-blur">
              <ShieldCheck className="size-3.5" />
              Espace propriétaire sécurisé
            </p>
            <h1 className="mt-4 font-display text-[2.1rem] leading-[1.1] sm:text-5xl">Votre terrain, suivi de près.</h1>
            <p className="mt-3 text-sm text-white/70 sm:text-base">
              Retrouvez à tout moment la situation de votre terrain, vos paiements et l&apos;avancement des travaux.
            </p>
          </div>

          <ul className="mt-10 hidden max-w-md space-y-5 lg:block">
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-gold ring-1 ring-white/10">
                  <Icon className="size-5" />
                </span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-sm text-white/65">{text}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-12 hidden text-xs text-white/45 lg:block">NADI Group · Aménageur foncier</p>
        </div>
      </aside>

      <main className="relative -mt-6 flex justify-center rounded-t-3xl bg-background px-5 pt-8 pb-12 sm:px-10 lg:mt-0 lg:items-center lg:rounded-none lg:py-12">
        <div className="w-full max-w-[400px]">
          <Suspense fallback={<FormSkeleton />}>
            <LoginContent searchParams={searchParams} />
          </Suspense>
        </div>
      </main>
    </div>
  )
}

async function LoginContent({ searchParams }: { searchParams: PageProps<"/espace-client/connexion">["searchParams"] }) {
  // Rendu à la requête uniquement : aucun accès BD pendant le prérendu
  await connection()
  const [{ next }, buyer] = await Promise.all([searchParams, getBuyer()])
  if (buyer) redirect("/espace-client")
  const settings = await getSettings()
  return (
    <OtpLoginForm
      next={typeof next === "string" ? next : undefined}
      contact={{ phone: settings.companyPhone, whatsapp: settings.companyWhatsapp, company: settings.companyName }}
    />
  )
}

function FormSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="mt-8 h-12 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  )
}
