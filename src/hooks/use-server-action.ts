"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { ActionResult } from "@/lib/action"

/**
 * Exécute une action serveur avec état de chargement, notifications et rafraîchissement.
 * const { run, pending } = useServerAction()
 * run(() => updateLot(id, values), { success: "Terrain enregistré", onSuccess: () => setOpen(false) })
 */
export function useServerAction() {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()

  const run = React.useCallback(
    <T,>(
      fn: () => Promise<ActionResult<T>>,
      opts: { success?: string | ((data: T) => string); onSuccess?: (data: T) => void; onError?: (error: string, fieldErrors?: Record<string, string>) => void; refresh?: boolean } = {},
    ) =>
      new Promise<ActionResult<T>>((resolve) => {
        startTransition(async () => {
          try {
            const result = await fn()
            if (result.ok) {
              const message = typeof opts.success === "function" ? opts.success(result.data) : (opts.success ?? result.message)
              if (message) toast.success(message)
              opts.onSuccess?.(result.data)
              if (opts.refresh !== false) router.refresh()
            } else {
              toast.error(result.error)
              opts.onError?.(result.error, result.fieldErrors)
            }
            resolve(result)
          } catch (error) {
            console.error(error)
            toast.error("Impossible de joindre le serveur. Vérifiez votre connexion.")
            resolve({ ok: false, error: "Erreur réseau" })
          }
        })
      }),
    [router],
  )

  return { run, pending }
}
