import { Suspense } from "react"
import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { requireAdmin } from "@/lib/auth/admin"
import { getNavCounts } from "@/lib/queries/nav"
import { Logo } from "@/components/brand/logo"
import { ActiveNav, NavList } from "@/components/admin/admin-nav"
import { AdminBreadcrumb } from "@/components/admin/breadcrumb"
import { AdminThemeProvider, ThemeToggle } from "@/components/admin/theme"
import { UserMenu } from "@/components/admin/user-menu"
import { CommandSearch } from "@/components/admin/command-search"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AdminThemeProvider>
      <SidebarProvider>
        <Sidebar collapsible="icon" className="border-sidebar-border">
          <SidebarHeader className="px-3 pt-4 pb-2">
            <Link href="/admin" className="flex items-center rounded-lg p-1 group-data-[collapsible=icon]:p-0">
              <Logo tone="light" mark className="group-data-[collapsible=icon]:[&>span:last-child]:hidden" />
            </Link>
          </SidebarHeader>
          <SidebarContent className="scrollbar-none">
            <Suspense fallback={<NavList active={null} />}>
              <NavWithCounts />
            </Suspense>
          </SidebarContent>
          <SidebarFooter className="pb-3">
            <Suspense fallback={<Skeleton className="h-12 w-full rounded-lg bg-sidebar-accent" />}>
              <CurrentUser />
            </Suspense>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>
        <SidebarInset className="min-w-0 bg-background">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur-md md:px-5">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mx-1 h-5" />
            <Suspense fallback={<span className="h-4 w-32 rounded bg-muted" />}>
              <AdminBreadcrumb />
            </Suspense>
            <div className="ml-auto flex items-center gap-1">
              <CommandSearch />
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
                <Link href="/" target="_blank">
                  <ExternalLink />
                  Site public
                </Link>
              </Button>
              <ThemeToggle />
            </div>
          </header>
          <div className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 md:px-6 lg:px-8 lg:py-8">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </AdminThemeProvider>
  )
}

async function NavWithCounts() {
  await requireAdmin()
  const counts = await getNavCounts()
  return <ActiveNav counts={counts} />
}

async function CurrentUser() {
  const admin = await requireAdmin()
  return <UserMenu name={admin.name} email={admin.email} role={admin.role} />
}
