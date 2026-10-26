import { cn } from "@/lib/utils"

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9 shrink-0", className)} aria-hidden="true">
      <rect width="40" height="40" rx="9" fill="var(--pine-deep)" />
      <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="8.25" fill="none" stroke="var(--gold)" strokeOpacity=".45" strokeWidth="1.5" />
      <text x="20" y="28.5" textAnchor="middle" fontFamily="var(--font-serif), Georgia, serif" fontWeight="600" fontSize="23" fill="#fff">
        N
      </text>
      <rect x="11" y="31.5" width="18" height="1.6" rx=".8" fill="var(--gold)" />
    </svg>
  )
}

/** Logotype NADI GROUP : « NADI » en serif, « GROUP » en capitales espacées dorées. */
export function Logo({
  className,
  tone = "default",
  mark = false,
  size = "default",
}: {
  className?: string
  tone?: "default" | "light"
  mark?: boolean
  size?: "default" | "lg"
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {mark && <LogoMark />}
      <span className="inline-flex items-baseline gap-2 leading-none whitespace-nowrap">
        <span
          className={cn(
            "font-display font-semibold tracking-[-0.01em]",
            size === "lg" ? "text-[2.1rem]" : "text-[1.6rem]",
            tone === "light" ? "text-white" : "text-pine-deep",
          )}
        >
          NADI
        </span>
        <span
          className={cn(
            "font-semibold tracking-[0.42em]",
            size === "lg" ? "text-[0.85rem]" : "text-[0.7rem]",
            tone === "light" ? "text-gold" : "text-gold-strong",
          )}
        >
          GROUP
        </span>
      </span>
    </span>
  )
}
