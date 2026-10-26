"use client"

import { motion, useReducedMotion } from "motion/react"

/**
 * Apparition douce au défilement. Si l'utilisateur préfère réduire les animations,
 * l'élément apparaît instantanément (le balisage reste identique côté serveur et client,
 * ce qui évite qu'une opacité 0 rendue côté serveur ne persiste après l'hydratation).
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 18,
  as = "div",
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  y?: number
  as?: "div" | "li" | "section"
}) {
  const reduce = useReducedMotion()
  const Comp = motion[as]
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={reduce ? { duration: 0 } : { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Comp>
  )
}
