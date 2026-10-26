import "dotenv/config"
import { defineConfig } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // CLI (migrations, seed, studio) : connexion directe ou pooler en mode session ; l'application utilise DATABASE_URL (src/lib/db.ts)
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
})
