"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import type { Range } from "@/components/site/lot-utils"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

/** Recherche rapide (accueil) : ouvre la page des terrains avec les filtres choisis. */
export function LotFilterBar({ areas, budgets }: { areas: Range[]; budgets: Range[] }) {
  const router = useRouter()
  const [area, setArea] = React.useState("all")
  const [budget, setBudget] = React.useState("all")
  const [status, setStatus] = React.useState("AVAILABLE")

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (area !== "all") params.set("surface", area)
    if (budget !== "all") params.set("budget", budget)
    if (status !== "all") params.set("statut", status)
    router.push(`/terrains${params.size ? `?${params}` : ""}#plan`)
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end lg:gap-5">
      <Field label="Surface" id="f-area">
        <Select value={area} onValueChange={setArea}>
          <SelectTrigger id="f-area" className="h-11 w-full rounded-md bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les surfaces</SelectItem>
            {areas.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Budget" id="f-budget">
        <Select value={budget} onValueChange={setBudget} disabled={budgets.length === 0}>
          <SelectTrigger id="f-budget" className="h-11 w-full rounded-md bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les budgets</SelectItem>
            {budgets.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Statut" id="f-status">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger id="f-status" className="h-11 w-full rounded-md bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AVAILABLE">Disponibles uniquement</SelectItem>
            <SelectItem value="all">Tous les terrains</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Button type="submit" size="lg" className="h-11 rounded-md bg-pine-deep px-9 text-[0.95rem] font-semibold text-white hover:bg-pine-deep/90 sm:col-span-2 lg:col-span-1">
        Rechercher
      </Button>
    </form>
  )
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      {children}
    </div>
  )
}
