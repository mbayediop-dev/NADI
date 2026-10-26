"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"

const KEY = "nadi-admin-theme"
const ThemeContext = React.createContext<{ dark: boolean; toggle: () => void }>({ dark: false, toggle: () => {} })

const EVENT = "nadi-admin-theme-change"

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback)
  window.addEventListener("storage", callback)
  return () => {
    window.removeEventListener(EVENT, callback)
    window.removeEventListener("storage", callback)
  }
}

function readDark() {
  try {
    return localStorage.getItem(KEY) === "dark"
  } catch {
    return false
  }
}

/** Thème clair/sombre de l'administration (classe « dark » posée sur <html> tant que l'admin est affiché). */
export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  const dark = React.useSyncExternalStore(subscribe, readDark, () => false)

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
    return () => document.documentElement.classList.remove("dark")
  }, [dark])

  const toggle = React.useCallback(() => {
    try {
      localStorage.setItem(KEY, readDark() ? "light" : "dark")
    } catch {}
    window.dispatchEvent(new Event(EVENT))
  }, [])

  return <ThemeContext value={{ dark, toggle }}>{children}</ThemeContext>
}

export function ThemeToggle() {
  const { dark, toggle } = React.use(ThemeContext)
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={dark ? "Thème clair" : "Thème sombre"}>
      {dark ? <Sun /> : <Moon />}
    </Button>
  )
}
