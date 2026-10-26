import { Banknote, CircleDollarSign, FileCheck2, Landmark, Smartphone } from "lucide-react"
import type { PaymentMethod } from "@/generated/prisma/enums"
import { PAYMENT_METHOD } from "@/lib/labels"
import { cn } from "@/lib/utils"

const ICONS: Record<PaymentMethod, typeof Banknote> = {
  CASH: Banknote,
  WAVE: Smartphone,
  ORANGE_MONEY: Smartphone,
  FREE_MONEY: Smartphone,
  BANK_TRANSFER: Landmark,
  CHECK: FileCheck2,
  OTHER: CircleDollarSign,
}

/** Pastille illustrant le mode de paiement */
export function MethodIcon({ method, className }: { method: PaymentMethod; className?: string }) {
  const Icon = ICONS[method]
  return (
    <span title={PAYMENT_METHOD[method]} className={cn("grid size-9 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary", className)}>
      <Icon className="size-4" />
    </span>
  )
}
