import "dotenv/config"
import { defineConfig } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // « react-server » neutralise l'import « server-only » de src/lib/storage (comme pour npm run storage:check)
    seed: "tsx --conditions=react-server prisma/seed.ts",
  },
  datasource: {
    // CLI (migrations, seed, studio) : connexion directe ou pooler en mode session ; l'application utilise DATABASE_URL (src/lib/db.ts)
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
})
