import { Suspense } from "react"
import Link from "next/link"
import { requireBuyer } from "@/lib/auth/client"
import { fullName } from "@/lib/format"
import { Logo } from "@/components/brand/logo"
import { Skeleton } from "@/components/ui/skeleton"
import { DesktopNav, DesktopNavList, MobileTabBar, MobileTabBarList } from "@/components/portal/portal-nav"
import { OwnerMenu } from "@/components/portal/owner-menu"

export default function PortalLayout({ children }: LayoutProps<"/espace-client">) {
  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,var(--sand)_0,var(--background)_340px)]">
      <header className="no-print sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/espace-client" className="flex items-center gap-3">
            <Logo />
            <span className="hidden h-6 w-px bg-border lg:block" />
            <span className="hidden text-xs font-semibold tracking-wide text-muted-foreground uppercase lg:block">Espace propriétaire</span>
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <Suspense fallback={<DesktopNavList pathname={null} />}>
              <DesktopNav />
            </Suspense>
            <Suspense fallback={<Skeleton className="h-10 w-10 rounded-full sm:w-44" />}>
              <CurrentOwner />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pt-5 pb-28 sm:px-6 md:pt-8 md:pb-16">{children}</main>
      <Suspense fallback={<MobileTabBarList pathname={null} />}>
        <MobileTabBar />
      </Suspense>
    </div>
  )
}

async function CurrentOwner() {
  const buyer = await requireBuyer()
  return <OwnerMenu name={fullName(buyer)} phone={buyer.phone} />
}
