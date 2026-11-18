import "server-only"

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`)
  return value
}

export const env = {
  get sessionSecret() {
    const secret = required("SESSION_SECRET")
    if (secret.length < 32) throw new Error("SESSION_SECRET doit contenir au moins 32 caractères")
    return secret
  },
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  defaultCountry: (process.env.DEFAULT_COUNTRY ?? "SN").toUpperCase(),
  smsProvider: process.env.SMS_PROVIDER ?? "console",
  /** Nom d'expéditeur des SMS : 11 caractères au plus chez la plupart des opérateurs. */
  smsSenderName: process.env.SMS_SENDER_NAME ?? "FUTURIA",
  /** local | supabase | s3 */
  storageDriver: process.env.STORAGE_DRIVER ?? "local",
  storageLocalDir: process.env.STORAGE_LOCAL_DIR ?? "./storage",
  cronSecret: process.env.CRON_SECRET,
  isProduction: process.env.NODE_ENV === "production",
}
