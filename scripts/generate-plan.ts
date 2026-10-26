// Génère le fond de plan de démonstration : npx tsx scripts/generate-plan.ts
import { writeFileSync } from "node:fs"
import { renderPlanSvg } from "../prisma/seed/layout"

writeFileSync("public/plan/site-plan.svg", renderPlanSvg())
console.log("public/plan/site-plan.svg généré")
