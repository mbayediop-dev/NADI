"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, MessageCircle } from "lucide-react"
import { whatsappLink } from "@/lib/phone"
import { PlanLegend, PlanViewer } from "@/components/plan/plan-viewer"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { LotCard } from "@/components/site/explorer/lot-card"
import { LotDetails } from "@/components/site/explorer/lot-details"
import type { ExplorerSettings } from "@/components/site/explorer/types"
import type { PublicLot } from "@/components/site/lot-utils"
import { ReservationForm } from "@/components/site/reservation-form"

/** Plan centré sur le terrain ; un clic sur un autre lot ouvre sa page. */
export function LotPagePlan({ lot, lots, settings }: { lot: PublicLot; lots: PublicLot[]; settings: ExplorerSettings }) {
  const router = useRouter()
  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <PlanViewer
        imageUrl={settings.planImageUrl}
        width={settings.planWidth}
        height={settings.planHeight}
        lots={lots}
        selectedId={lot.id}
        focusSelected
        onSelect={(l) => l.id !== lot.id && router.push(`/terrains/${encodeURIComponent(l.number)}`)}
        className="aspect-[16/11] rounded-none sm:aspect-auto sm:h-[460px]"
      />
      <div className="border-t px-4 py-3">
        <PlanLegend className="text-xs" />
      </div>
    </div>
  )
}

export function LotPageDetails({ lot, similar, settings }: { lot: PublicLot; similar: PublicLot[]; settings: ExplorerSettings }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const canReserve = lot.status === "AVAILABLE" && settings.reservationsOpen
  const cta = (
      <div>
        {canReserve ? (
          <Button onClick={() => setOpen(true)} className="h-12 w-full rounded-md bg-gold text-base font-semibold text-gold-foreground hover:bg-gold/90">
            Réserver ce terrain
            <ArrowRight />
          </Button>
        ) : lot.status === "AVAILABLE" && settings.companyWhatsapp ? (
          <Button asChild className="h-12 w-full rounded-md text-base">
            <a href={whatsappLink(settings.companyWhatsapp, `Bonjour, je suis intéressé(e) par le terrain n° ${lot.number}.`)} target="_blank" rel="noopener noreferrer">
              <MessageCircle />
              Nous contacter pour ce terrain
            </a>
          </Button>
        ) : (
          <Button variant="outline" className="h-12 w-full rounded-md text-base" onClick={() => router.push("/terrains")}>
            Voir les terrains disponibles
            <ArrowRight />
          </Button>
        )}
      </div>
  )
  return (
    <>
      <LotDetails
        lot={lot}
        currency={settings.currencyLabel}
        similar={lot.status === "AVAILABLE" ? [] : similar.slice(0, 3)}
        onSelectSimilar={(l) => router.push(`/terrains/${encodeURIComponent(l.number)}`)}
        companyName={settings.companyName}
        companyWhatsapp={settings.companyWhatsapp}
        showTitle={false}
        cta={lot.status === "AVAILABLE" ? cta : undefined}
      />
      {lot.status !== "AVAILABLE" && <div className="mt-6">{cta}</div>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto p-6 sm:max-w-md">
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-2xl font-medium">Réserver le terrain n° {lot.number}</DialogTitle>
            <DialogDescription>Laissez vos coordonnées : un conseiller vous rappelle pour finaliser.</DialogDescription>
          </DialogHeader>
          <ReservationForm lot={lot} companyName={settings.companyName} companyWhatsapp={settings.companyWhatsapp} />
        </DialogContent>
      </Dialog>
    </>
  )
}

export function SimilarLots({ lots, currency }: { lots: PublicLot[]; currency: string }) {
  const router = useRouter()
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {lots.map((l) => (
        <li key={l.id}>
          <LotCard lot={l} currency={currency} compact onSelect={() => router.push(`/terrains/${encodeURIComponent(l.number)}`)} />
        </li>
      ))}
    </ul>
  )
}
