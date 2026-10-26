// Options TLS de la connexion PostgreSQL (partagées par l'application et le seed, sans « server-only »)
import { readFileSync } from "node:fs"

/**
 * Supabase chiffre les connexions mais signe ses certificats avec sa propre autorité.
 * - DATABASE_SSL_CA (chemin du certificat racine téléchargé depuis le tableau de bord Supabase,
 *   Project Settings → Database → SSL) : vérification complète du serveur ;
 * - sinon : connexion chiffrée sans vérification de l'autorité ;
 * - base locale (localhost) : pas de TLS.
 */
export function databaseSsl(connectionString = process.env.DATABASE_URL ?? "") {
  let host = ""
  try {
    host = new URL(connectionString).hostname
  } catch {
    host = ""
  }
  if (!host || host === "localhost" || host === "127.0.0.1" || host === "[::1]") return undefined
  const ca = process.env.DATABASE_SSL_CA
  return ca ? { ca: readFileSync(ca, "utf8") } : { rejectUnauthorized: false }
}
