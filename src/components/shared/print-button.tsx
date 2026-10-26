"use client"

import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

export function PrintButton({ label = "Imprimer / Enregistrer en PDF" }: { label?: string }) {
  return (
    <Button onClick={() => window.print()} className="no-print">
      <Printer />
      {label}
    </Button>
  )
}
