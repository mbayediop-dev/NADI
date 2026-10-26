"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { BadgeDollarSign, Loader2, Plus, Search, SquareStack, UserRound, Wallet } from "lucide-react"
import { searchAdmin, type SearchHit } from "@/lib/queries/search"
import { ADMIN_NAV } from "@/components/admin/nav-config"
import { Button } from "@/components/ui/button"
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"

const HIT_ICON = { lot: SquareStack, buyer: UserRound, sale: BadgeDollarSign } as const
const HIT_GROUP = { lot: "Terrains", buyer: "Acheteurs", sale: "Ventes" } as const

const subscribeNoop = () => () => {}

/** Recherche globale (Ctrl/⌘ + K) : terrains, acheteurs, ventes, raccourcis. */
export function CommandSearch() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [hits, setHits] = React.useState<SearchHit[]>([])
  const [loading, setLoading] = React.useState(false)
  const isMac = React.useSyncExternalStore(
    subscribeNoop,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => true,
  )

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  function changeQuery(value: string) {
    setQuery(value)
    setLoading(value.trim().length > 0)
    if (!value.trim()) setHits([])
  }

  React.useEffect(() => {
    const q = query.trim()
    if (!q) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const result = await searchAdmin(q)
        if (!cancelled) setHits(result)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 180)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  function go(href: string) {
    setOpen(false)
    setQuery("")
    router.push(href)
  }

  const groups = (["lot", "buyer", "sale"] as const).map((type) => ({ type, items: hits.filter((h) => h.type === type) })).filter((g) => g.items.length)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="hidden h-8 w-56 justify-start gap-2 text-muted-foreground md:inline-flex lg:w-72"
      >
        <Search />
        <span className="flex-1 text-left">Rechercher…</span>
        <Kbd>{isMac ? "⌘" : "Ctrl"} K</Kbd>
      </Button>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} className="md:hidden" aria-label="Rechercher">
        <Search />
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Recherche" description="Rechercher un terrain, un acheteur ou une vente" className="sm:max-w-xl">
        <Command shouldFilter={false}>
          <div className="relative">
            <CommandInput value={query} onValueChange={changeQuery} placeholder="N° de terrain, nom, téléphone, référence de vente…" />
            {loading && <Loader2 className="absolute top-1/2 right-4 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
          </div>
          <CommandList className="max-h-[60vh]">
            {query.trim() ? (
              <>
                {!loading && <CommandEmpty>Aucun résultat pour « {query} ».</CommandEmpty>}
                {groups.map((g) => (
                  <CommandGroup key={g.type} heading={HIT_GROUP[g.type]}>
                    {g.items.map((hit) => {
                      const Icon = HIT_ICON[hit.type]
                      return (
                        <CommandItem key={`${hit.type}-${hit.id}`} value={`${hit.type}-${hit.id}`} onSelect={() => go(hit.href)}>
                          <Icon />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{hit.title}</p>
                            <p className="truncate text-xs text-muted-foreground">{hit.subtitle}</p>
                          </div>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                ))}
              </>
            ) : (
              <>
                <CommandGroup heading="Actions rapides">
                  <CommandItem value="action-sale" onSelect={() => go("/admin/ventes/nouvelle")}>
                    <Plus />
                    Nouvelle vente (attribuer un terrain)
                  </CommandItem>
                  <CommandItem value="action-payment" onSelect={() => go("/admin/versements")}>
                    <Wallet />
                    Enregistrer un versement
                  </CommandItem>
                  <CommandItem value="action-buyer" onSelect={() => go("/admin/acheteurs")}>
                    <UserRound />
                    Ajouter un acheteur
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Aller à">
                  {ADMIN_NAV.flatMap((g) => g.items).map((item) => (
                    <CommandItem key={item.href} value={`nav-${item.href}`} onSelect={() => go(item.href)}>
                      <item.icon />
                      {item.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
