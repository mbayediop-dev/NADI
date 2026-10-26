import { Suspense } from "react"
import type { Metadata } from "next"
import { LegalPage } from "@/components/site/legal-page"

export const metadata: Metadata = { title: "Politique de confidentialité" }

export default function ConfidentialitePage() {
  return (
    <Suspense fallback={<div className="h-96 bg-pine-deep" />}>
      <LegalPage kind="privacy" />
    </Suspense>
  )
}
