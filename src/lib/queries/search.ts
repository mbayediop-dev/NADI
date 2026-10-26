"use server"

import { db } from "@/lib/db"
import { getAdmin } from "@/lib/auth/admin"
import { compareLotNumbers, formatArea, fullName } from "@/lib/format"
import { formatPhone } from "@/lib/phone"
import { LOT_STATUS } from "@/lib/labels"

export type SearchHit = { type: "lot" | "buyer" | "sale"; id: string; title: string; subtitle: string; href: string }

/** Recherche globale de l'administration (palette Ctrl+K). */
export async function searchAdmin(query: string): Promise<SearchHit[]> {
  const admin = await getAdmin()
  if (!admin) return []
  const q = query.trim().slice(0, 60)
  if (!q) return []
  const digits = q.replace(/\D/g, "")
  const lotQuery = q.replace(/^(n°|no|lot|terrain)\s*/i, "")

  const [lots, buyers, sales] = await Promise.all([
    db.lot.findMany({
      where: { OR: [{ number: { equals: lotQuery, mode: "insensitive" } }, { number: { startsWith: lotQuery, mode: "insensitive" } }] },
      take: 6,
      select: { id: true, number: true, block: true, areaM2: true, status: true },
    }),
    db.buyer.findMany({
      where: {
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
        ],
      },
      take: 6,
      select: { id: true, firstName: true, lastName: true, phone: true },
    }),
    db.sale.findMany({
      where: { reference: { contains: q, mode: "insensitive" } },
      take: 5,
      select: { id: true, reference: true, lot: { select: { number: true } }, buyer: { select: { firstName: true, lastName: true } } },
    }),
  ])

  return [
    ...lots
      .sort((a, b) => compareLotNumbers(a.number, b.number))
      .map((l) => ({
        type: "lot" as const,
        id: l.id,
        title: `Terrain n°${l.number}`,
        subtitle: [l.block && `Îlot ${l.block}`, formatArea(l.areaM2), LOT_STATUS[l.status].label].filter(Boolean).join(" · "),
        href: `/admin/terrains/${l.id}`,
      })),
    ...buyers.map((b) => ({ type: "buyer" as const, id: b.id, title: fullName(b), subtitle: formatPhone(b.phone), href: `/admin/acheteurs/${b.id}` })),
    ...sales.map((s) => ({
      type: "sale" as const,
      id: s.id,
      title: s.reference,
      subtitle: `Terrain n°${s.lot.number} · ${fullName(s.buyer)}`,
      href: `/admin/ventes/${s.id}`,
    })),
  ]
}
