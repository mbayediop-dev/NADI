import "server-only"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/generated/prisma/client"
import { databaseSsl } from "@/lib/db-ssl"

// En développement, le client est conservé entre les rechargements à chaud ; il est recréé si DATABASE_URL change (rechargement du .env).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaUrl?: string }

function createClient(connectionString: string | undefined) {
  // DATABASE_URL : pooler Supabase en mode transaction (port 6543) ; la CLI Prisma utilise DIRECT_URL (prisma.config.ts)
  const adapter = new PrismaPg({ connectionString, ssl: databaseSsl(connectionString) })
  return new PrismaClient({ adapter })
}

const connectionString = process.env.DATABASE_URL

export const db = globalForPrisma.prisma && globalForPrisma.prismaUrl === connectionString ? globalForPrisma.prisma : createClient(connectionString)

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db
  globalForPrisma.prismaUrl = connectionString
}
