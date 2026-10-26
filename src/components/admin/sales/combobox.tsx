"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export type ComboOption = { value: string; label: string; keywords?: string[]; render?: React.ReactNode }

/** Liste déroulante avec recherche (accents ignorés). */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Sélectionner…",
  searchPlaceholder = "Rechercher…",
  empty = "Aucun résultat.",
  renderValue,
  className,
  disabled,
}: {
  options: ComboOption[]
  value: string | undefined
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  empty?: string
  renderValue?: (option: ComboOption) => React.ReactNode
  className?: string
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const selected = options.find((o) => o.value === value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("h-auto min-h-11 w-full justify-between px-3 py-2 text-left font-normal", className)}
        >
          <span className={cn("min-w-0 flex-1 truncate", !selected && "text-muted-foreground")}>
            {selected ? (renderValue ? renderValue(selected) : selected.label) : placeholder}
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
        <Command
          filter={(itemValue, search, keywords) => {
            const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
            const haystack = norm([itemValue, ...(keywords ?? [])].join(" "))
            return norm(search)
              .split(/\s+/)
              .every((part) => haystack.includes(part))
              ? 1
              : 0
          }}
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-80">
            <CommandEmpty>{empty}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.value}`}
                  keywords={option.keywords}
                  onSelect={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  <div className="min-w-0 flex-1">{option.render ?? option.label}</div>
                  <Check className={cn("ml-2 size-4", option.value === value ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
