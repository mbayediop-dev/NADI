import { Suspense } from "react"
import type { Metadata } from "next"
import { LegalPage } from "@/components/site/legal-page"

export const metadata: Metadata = { title: "Mentions légales" }

export default function MentionsLegalesPage() {
  return (
    <Suspense fallback={<div className="h-96 bg-pine-deep" />}>
      <LegalPage kind="legal" />
    </Suspense>
  )
}
