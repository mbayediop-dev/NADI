import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PrintButton } from "@/components/shared/print-button"

export function PrintToolbar({ back }: { back: { href: string; label: string } }) {
  return (
    <div className="no-print mx-auto mb-6 flex w-full max-w-[760px] flex-wrap items-center justify-between gap-3">
      <Button variant="ghost" asChild>
        <Link href={back.href}>
          <ArrowLeft />
          {back.label}
        </Link>
      </Button>
      <PrintButton />
    </div>
  )
}
