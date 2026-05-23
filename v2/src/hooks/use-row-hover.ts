/**
 * useRowHover — generic hover-with-cursor-position state for any data table.
 *
 * Pairs with the `CursorPopover` component to show a follow-cursor popover
 * showing extra detail for the row being hovered.
 *
 * Usage:
 *   const { hover, onEnter, onMove, onLeave } = useRowHover<Tenant>()
 *
 *   <TableRow
 *     onMouseEnter={onEnter(row.original)}
 *     onMouseMove={onMove(row.original)}
 *     onMouseLeave={onLeave}
 *   >
 *
 *   <CursorPopover open={!!hover} x={hover?.x ?? 0} y={hover?.y ?? 0}>
 *     {hover && <SomeDetailComponent row={hover.row} />}
 *   </CursorPopover>
 */

import type React from 'react'
import { useRef, useState } from 'react'

export type RowHoverState<T> = { row: T; x: number; y: number } | null

export function useRowHover<T extends { id: string }>(delay = 250) {
  const [hover, setHover] = useState<RowHoverState<T>>(null)
  const timer = useRef<number | null>(null)

  function onEnter(row: T) {
    return (e: React.MouseEvent) => {
      if (timer.current) window.clearTimeout(timer.current)
      const x = e.clientX
      const y = e.clientY
      timer.current = window.setTimeout(() => {
        setHover({ row, x, y })
      }, delay)
    }
  }

  function onMove(row: T) {
    return (e: React.MouseEvent) => {
      if (hover && hover.row.id === row.id) {
        setHover({ row, x: e.clientX, y: e.clientY })
      }
    }
  }

  function onLeave() {
    if (timer.current) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    setHover(null)
  }

  return { hover, onEnter, onMove, onLeave }
}
