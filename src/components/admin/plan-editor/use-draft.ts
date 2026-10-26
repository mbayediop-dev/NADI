"use client"

import * as React from "react"
import { clampPoint, rectPolygon, type Point } from "@/lib/plan"

export type Tool = "polygon" | "rect"

/**
 * État d'édition d'une forme : points normalisés (0..1), outil actif,
 * gestion des clics / glisser sur la couche SVG du plan.
 */
export function useDraft(initial: Point[] | null) {
  const [points, setPoints] = React.useState<Point[]>(initial ?? [])
  const [closed, setClosed] = React.useState(!!initial && initial.length >= 3)
  const [tool, setTool] = React.useState<Tool>("polygon")
  const [cursor, setCursor] = React.useState<Point | null>(null)
  const [rectStart, setRectStart] = React.useState<Point | null>(null)
  const [dirty, setDirty] = React.useState(false)
  const drag = React.useRef<{ index: number; moved: boolean } | null>(null)
  const down = React.useRef<{ x: number; y: number; time: number } | null>(null)
  const lastUp = React.useRef<{ x: number; y: number; time: number } | null>(null)

  const reset = React.useCallback((next: Point[] | null) => {
    setPoints(next ?? [])
    setClosed(!!next && next.length >= 3)
    setRectStart(null)
    setCursor(null)
    setDirty(false)
    drag.current = null
  }, [])

  const clear = React.useCallback(() => {
    setPoints([])
    setClosed(false)
    setRectStart(null)
    setDirty(true)
  }, [])

  const close = React.useCallback(() => {
    setPoints((pts) => {
      if (pts.length >= 3) setClosed(true)
      return pts
    })
  }, [])

  const undo = React.useCallback(() => {
    if (closed) return
    setPoints((pts) => pts.slice(0, -1))
    setDirty(true)
  }, [closed])

  function screenDistance(client: { x: number; y: number }, rect: DOMRect, p: Point) {
    return Math.hypot(client.x - (rect.left + p[0] * rect.width), client.y - (rect.top + p[1] * rect.height))
  }

  const onPointer = React.useCallback(
    (event: React.PointerEvent<SVGSVGElement>, raw: Point, phase: "down" | "move" | "up") => {
      const point = clampPoint(raw)
      const target = event.target as Element
      // lus immédiatement : l'événement n'est plus exploitable dans les mises à jour d'état
      const svgRect = event.currentTarget.getBoundingClientRect()
      const client = { x: event.clientX, y: event.clientY }

      if (phase === "down") {
        down.current = { x: event.clientX, y: event.clientY, time: Date.now() }
        const vertex = target.getAttribute?.("data-vertex")
        const mid = target.getAttribute?.("data-mid")
        if (vertex != null) {
          drag.current = { index: Number(vertex), moved: false }
          event.currentTarget.setPointerCapture(event.pointerId)
          return
        }
        if (mid != null) {
          const i = Number(mid)
          setPoints((pts) => [...pts.slice(0, i + 1), point, ...pts.slice(i + 1)])
          drag.current = { index: i + 1, moved: true }
          setDirty(true)
          event.currentTarget.setPointerCapture(event.pointerId)
          return
        }
        if (tool === "rect") {
          setRectStart(point)
          setCursor(point)
          event.currentTarget.setPointerCapture(event.pointerId)
        }
        return
      }

      if (phase === "move") {
        if (drag.current) {
          const start = down.current
          if (!drag.current.moved && start && Math.hypot(client.x - start.x, client.y - start.y) < 4) return
          const index = drag.current.index
          drag.current.moved = true
          setPoints((pts) => pts.map((p, i) => (i === index ? point : p)))
          setDirty(true)
          return
        }
        setCursor(point)
        return
      }

      // phase === "up"
      if (drag.current) {
        const { index, moved } = drag.current
        drag.current = null
        // clic simple sur le premier point : fermer la forme
        if (!moved && index === 0 && !closed) {
          setPoints((pts) => {
            if (pts.length >= 3) setClosed(true)
            return pts
          })
        }
        return
      }
      if (tool === "rect" && rectStart) {
        const [x0, y0] = rectStart
        setRectStart(null)
        if (Math.abs(point[0] - x0) > 0.002 && Math.abs(point[1] - y0) > 0.002) {
          setPoints(rectPolygon(x0, y0, point[0], point[1]))
          setClosed(true)
          setDirty(true)
          setTool("polygon")
        }
        return
      }
      if (tool !== "polygon" || closed) return
      const start = down.current
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return // c'était un déplacement du plan
      const now = Date.now()
      const prev = lastUp.current
      lastUp.current = { x: event.clientX, y: event.clientY, time: now }
      // double-clic : fermer la forme
      if (prev && now - prev.time < 320 && Math.hypot(event.clientX - prev.x, event.clientY - prev.y) < 8) {
        setPoints((pts) => {
          if (pts.length >= 3) setClosed(true)
          return pts
        })
        return
      }
      setPoints((pts) => {
        if (pts.length >= 3 && screenDistance(client, svgRect, pts[0]) < 14) {
          setClosed(true)
          return pts
        }
        return [...pts, point]
      })
      setDirty(true)
    },
    [tool, closed, rectStart],
  )

  return { points, closed, tool, setTool, cursor, rectStart, dirty, onPointer, reset, clear, close, undo, setDirty }
}
