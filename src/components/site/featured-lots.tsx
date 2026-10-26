import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ChevronRight, LandPlot, Scaling } from "lucide-react"
import { formatArea, formatMoney } from "@/lib/format"
import { LOT_STATUS } from "@/lib/labels"
import { cn } from "@/lib/utils"
import type { PlanLot } from "@/components/plan/plan-viewer"
import { MiniPlan } from "@/components/site/mini-plan"
import { Reveal } from "@/components/site/reveal"
import type { PublicLot } from "@/components/site/lot-utils"

/** Choisit des terrains disponibles variés (mis en avant d'abord, îlots différents ensuite). */
export function pickFeaturedLots(lots: PublicLot[], count = 3) {
  const available = lots
    .filter((l) => l.status === "AVAILABLE")
    .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a.number.localeCompare(b.number, "fr", { numeric: true }))
  const picked: PublicLot[] = []
  for (const lot of available) {
    if (picked.length >= count) break
    if (!picked.some((p) => p.block && p.block === lot.block)) picked.push(lot)
  }
  for (const lot of available) {
    if (picked.length >= count) break
    if (!picked.includes(lot)) picked.push(lot)
  }
  return picked
}

/** Seconde caractéristique de la carte : angle de rue, sinon l'îlot */
function lotKind(lot: PublicLot) {
  if (/angle/i.test(lot.position ?? "")) return "Terrain en angle"
  if (lot.block) return `Îlot ${lot.block}`
  return null
}

export function FeaturedLotCard({
  lot,
  photo,
  plan,
  planLots,
  currency,
  index = 0,
}: {
  lot: PublicLot
  photo: string | null
  plan: { imageUrl: string | null; width: number; height: number }
  planLots: PlanLot[]
  currency: string
  index?: number
}) {
  const href = `/terrains/${encodeURIComponent(lot.number)}`
  const deposit = lot.plan?.deposit ?? 0
  const kind = lotKind(lot)
  return (
    <Reveal
      delay={index * 0.06}
      className="group flex h-full flex-col overflow-hidden rounded-lg border bg-card shadow-xs transition-shadow duration-300 hover:shadow-[0_24px_50px_-28px_rgb(0_0_0/0.4)]"
    >
      <Link href={href} className="relative block aspect-[16/10] overflow-hidden bg-muted" tabIndex={-1} aria-hidden>
        {photo ? (
          <Image
            src={photo}
            unoptimized={photo.endsWith(".svg")}
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
        ) : (
          <MiniPlan {...plan} lots={planLots} focusId={lot.id} padding={0.12} className="size-full transition-transform duration-700 group-hover:scale-[1.04]" />
        )}
        <span
          className={cn(
            "absolute bottom-3 left-3 rounded-sm px-2.5 py-1 text-xs font-semibold text-white shadow-sm",
            lot.status === "AVAILABLE" ? "bg-status-available-strong" : "bg-pine-deep",
          )}
        >
          {LOT_STATUS[lot.status].label}
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-[1.15rem] leading-tight font-bold">
          <Link href={href} className="transition-colors hover:text-primary">
            Lot {lot.number}
          </Link>
        </h3>
        <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground/80">
          <span className="inline-flex items-center gap-1.5">
            <Scaling className="size-4 text-muted-foreground" />
            {formatArea(lot.areaM2)}
          </span>
          {kind && (
            <span className="inline-flex items-center gap-1.5">
              <LandPlot className="size-4 text-muted-foreground" />
              {kind}
            </span>
          )}
        </p>
        <p className="mt-3 text-[1.4rem] leading-none font-bold tracking-tight tabular">{lot.price != null ? formatMoney(lot.price, currency) : "Prix sur demande"}</p>
        <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
          {deposit > 0
            ? `À partir de ${formatMoney(deposit, currency)} d'acompte et possibilité de paiement échelonné.`
            : "Possibilité de paiement échelonné, selon vos besoins."}
        </p>
        <div className="mt-5 flex items-center justify-between">
          <Link href={href} className="inline-flex items-center gap-2 text-sm font-semibold transition-colors hover:text-primary">
            Voir les détails
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href={href}
            aria-label={`Voir le lot ${lot.number}`}
            className="grid size-9 place-items-center rounded-full border border-gold/70 text-gold-strong transition-colors hover:bg-gold hover:text-gold-foreground"
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>
    </Reveal>
  )
}
