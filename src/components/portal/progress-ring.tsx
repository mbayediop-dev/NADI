import { cn } from "@/lib/utils"

/** Anneau de progression (paiement, avancement des travaux). */
export function ProgressRing({
  value,
  size = 132,
  stroke = 12,
  className,
  trackClassName = "stroke-white/12",
  indicatorClassName = "stroke-gold",
  children,
}: {
  value: number
  size?: number
  stroke?: number
  className?: string
  trackClassName?: string
  indicatorClassName?: string
  children?: React.ReactNode
}) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(1, value))
  const offset = circumference * (1 - clamped)
  return (
    <div className={cn("relative grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className={trackClassName} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          className={cn(
            "transition-[stroke-dashoffset] duration-[1200ms] ease-out [stroke-dashoffset:var(--ring-offset)] starting:[stroke-dashoffset:var(--ring-circ)]",
            indicatorClassName,
          )}
          style={{ "--ring-offset": offset, "--ring-circ": circumference } as React.CSSProperties}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}
