import { NextResponse, type NextRequest } from "next/server"
import { ADMIN_COOKIE, CLIENT_COOKIE, verifySession } from "@/lib/auth/token"

/**
 * Première barrière d'accès (vérification de la signature du jeton).
 * Les pages et actions revérifient systématiquement la session côté serveur.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const session = await verifySession(request.cookies.get(ADMIN_COOKIE)?.value, "admin")
    if (!session) return redirectTo(request, "/admin/login", pathname + search)
  }

  if (pathname.startsWith("/espace-client") && !pathname.startsWith("/espace-client/connexion")) {
    const session = await verifySession(request.cookies.get(CLIENT_COOKIE)?.value, "client")
    if (!session) return redirectTo(request, "/espace-client/connexion", pathname + search)
  }

  return NextResponse.next()
}

function redirectTo(request: NextRequest, path: string, next: string) {
  const url = new URL(path, request.url)
  if (next && next !== "/admin" && next !== "/espace-client") url.searchParams.set("next", next)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ["/admin/:path*", "/espace-client/:path*"],
}
