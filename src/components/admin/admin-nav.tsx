"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { ADMIN_NAV, type NavCounts } from "@/components/admin/nav-config"

/** Liste de navigation (présentation pure, sans lecture de l'URL) */
export function NavList({ active, counts }: { active: string | null; counts?: NavCounts }) {
  const { setOpenMobile } = useSidebar()
  return (
    <>
      {ADMIN_NAV.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase tracking-[0.14em] text-[0.65rem]">{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const isActive =
                  active != null && (item.exact ? active === item.href : active === item.href || active.startsWith(`${item.href}/`))
                const count = item.badge && counts ? counts[item.badge] : 0
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                      className="h-9 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:[&_svg]:text-sidebar-primary"
                    >
                      <Link href={item.href} onClick={() => setOpenMobile(false)}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {count > 0 && (
                      <SidebarMenuBadge
                        className={
                          item.badge === "lateSales"
                            ? "bg-status-sold/90 text-white peer-hover/menu-button:text-white"
                            : "bg-sidebar-primary text-sidebar-primary-foreground peer-hover/menu-button:text-sidebar-primary-foreground"
                        }
                      >
                        {count}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}

/** Navigation avec l'élément actif (lit l'URL : à placer sous <Suspense>) */
export function ActiveNav({ counts }: { counts: NavCounts }) {
  const pathname = usePathname()
  return <NavList active={pathname} counts={counts} />
}
