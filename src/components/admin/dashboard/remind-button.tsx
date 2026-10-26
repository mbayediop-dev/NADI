"use client"

import { BellRing, Check, Loader2 } from "lucide-react"
import * as React from "react"
import { remindSale } from "@/app/admin/(app)/ventes/actions"
import { useServerAction } from "@/hooks/use-server-action"
import { Button } from "@/components/ui/button"

/** Relance SMS d'une vente en retard (depuis le tableau de bord) */
export function RemindButton({ saleId, disabled }: { saleId: string; disabled?: boolean }) {
  const { run, pending } = useServerAction()
  const [done, setDone] = React.useState(false)
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={disabled || pending || done}
      onClick={() => run(() => remindSale(saleId), { onSuccess: () => setDone(true), refresh: false })}
      aria-label="Relancer par SMS"
    >
      {pending ? <Loader2 className="animate-spin" /> : done ? <Check /> : <BellRing />}
      <span className="hidden sm:inline">{done ? "Relancé" : "Relancer"}</span>
    </Button>
  )
}
