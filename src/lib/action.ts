// Format de retour commun des actions serveur
import { z } from "zod"

export type ActionFailure = { ok: false; error: string; fieldErrors?: Record<string, string> }
export type ActionResult<T = undefined> = { ok: true; data: T; message?: string } | ActionFailure

/** Erreur « métier » dont le message peut être affiché tel quel à l'utilisateur. */
export class UserError extends Error {}

export function ok<T>(data: T, message?: string): { ok: true; data: T; message?: string } {
  return { ok: true, data, message }
}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionFailure {
  return { ok: false, error, fieldErrors }
}

export function zodFail(error: z.ZodError): ActionFailure {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join(".")
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
  }
  return fail(error.issues[0]?.message ?? "Données invalides", fieldErrors)
}

function isNextControlFlow(error: unknown) {
  return (
    !!error &&
    typeof error === "object" &&
    "digest" in error &&
    /^NEXT_|^DYNAMIC_SERVER_USAGE/.test(String((error as { digest: unknown }).digest))
  )
}

/** Exécute une action et convertit toute exception en résultat d'erreur lisible. */
export async function run<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn()
  } catch (error) {
    if (isNextControlFlow(error)) throw error
    if (error instanceof z.ZodError) return zodFail(error)
    if (error instanceof UserError) return fail(error.message)
    console.error("[action]", error)
    return fail("Une erreur inattendue est survenue. Veuillez réessayer.")
  }
}
