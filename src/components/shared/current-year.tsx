"use client"

import * as React from "react"

const subscribe = () => () => {}

/** Année courante, calculée côté client uniquement (compatible avec le prérendu statique). */
export function CurrentYear() {
  const year = React.useSyncExternalStore(
    subscribe,
    () => new Date().getFullYear(),
    () => null,
  )
  return <>{year ?? ""}</>
}
