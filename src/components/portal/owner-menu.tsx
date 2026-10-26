"use client"

import Link from "next/link"
import { ChevronDown, ExternalLink, LogOut, UserRound } from "lucide-react"
import { logoutClient } from "@/app/espace-client/actions"
import { initials } from "@/lib/format"
import { formatPhone } from "@/lib/phone"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function OwnerMenu({ name, phone }: { name: string; phone: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border bg-card py-1 pr-2 pl-1 text-sm font-medium shadow-xs outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
        <Avatar className="size-8">
          <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">{initials(name)}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-36 truncate sm:inline">{name}</span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-xl">
        <DropdownMenuLabel className="font-normal">
          <p className="font-semibold">{name}</p>
          <p className="text-xs text-muted-foreground tabular">{formatPhone(phone)}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/espace-client/profil">
            <UserRound />
            Mon profil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/" target="_blank">
            <ExternalLink />
            Site NADI Group
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => logoutClient()}>
          <LogOut />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
