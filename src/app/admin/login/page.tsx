import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { getAdmin } from "@/lib/auth/admin"
import { Logo } from "@/components/brand/logo"
import { Skeleton } from "@/components/ui/skeleton"
import { CurrentYear } from "@/components/shared/current-year"
import { LoginForm } from "./login-form"

export const metadata: Metadata = { title: "Administration", robots: { index: false } }

export default function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-pine-deep text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.22] mix-blend-luminosity"
          style={{ backgroundImage: "url(/plan/site-plan.svg)", backgroundSize: "cover", backgroundPosition: "center" }}
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-pine-deep via-pine-deep/90 to-pine/70" />
        <Logo tone="light" className="relative" />
        <div className="relative max-w-md">
          <p className="font-display text-4xl leading-tight">Pilotez votre lotissement en toute sérénité.</p>
          <p className="mt-4 text-white/70">
            Terrains, acheteurs, échéanciers, versements et avancement des travaux : tout est réuni dans un seul outil.
          </p>
        </div>
        <p className="relative text-xs text-white/50">© <CurrentYear /> NADI Group · Espace d&apos;administration</p>
      </aside>
      <main className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-10 inline-flex lg:hidden">
            <Logo />
          </Link>
          <Suspense fallback={<FormSkeleton />}>
            <LoginContent searchParams={searchParams} />
          </Suspense>
        </div>
      </main>
    </div>
  )
}

async function LoginContent({ searchParams }: { searchParams: PageProps<"/admin/login">["searchParams"] }) {
  const [{ next }, admin, count] = await Promise.all([searchParams, getAdmin(), db.adminUser.count()])
  if (admin) redirect("/admin")
  return <LoginForm setup={count === 0} next={typeof next === "string" ? next : undefined} />
}

function FormSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="mt-6 h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  )
}
