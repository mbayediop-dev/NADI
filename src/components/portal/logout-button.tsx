"use client"

import * as React from "react"
import { Loader2, LogOut } from "lucide-react"
import { logoutClient } from "@/app/espace-client/actions"
import { Button } from "@/components/ui/button"

export function LogoutButton() {
  const [pending, startTransition] = React.useTransition()
  return (
    <Button
      variant="outline"
      size="lg"
      className="h-11 w-full rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
      disabled={pending}
      onClick={() => startTransition(() => logoutClient())}
    >
      {pending ? <Loader2 className="animate-spin" /> : <LogOut />}
      Se déconnecter
    </Button>
  )
}
