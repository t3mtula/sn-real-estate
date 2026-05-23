/**
 * CursorPopover — popover anchored at the mouse position, not at a trigger
 * element. Use with `useCursorHover` to track which row the cursor is over
 * and where the popover should render.
 *
 * The popover is non-interactive (pointer-events: none) so it never
 * interferes with hover detection on the underlying row.
 */

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  x: number
  y: number
  children: ReactNode
  className?: string
}

const OFFSET = 16

export function CursorPopover({ open, x, y, children, className }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 384, h: 300 })

  useLayoutEffect(() => {
    if (open && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setSize({ w: rect.width, h: rect.height })
    }
  }, [open, children])

  if (!open || typeof document === 'undefined') return null

  const vw = window.innerWidth
  const vh = window.innerHeight
  const fitsRight = x + size.w + OFFSET < vw
  const fitsDown = y + size.h + OFFSET < vh
  const left = fitsRight ? x + OFFSET : Math.max(8, x - size.w - OFFSET)
  const top = fitsDown ? y + OFFSET : Math.max(8, y - size.h - OFFSET)

  return createPortal(
    <div
      ref={ref}
      role='tooltip'
      className={cn(
        'fixed z-[100] pointer-events-none w-96 rounded-md border bg-popover p-4 text-popover-foreground shadow-lg ring-1 ring-black/5',
        className,
      )}
      style={{ left, top }}
    >
      {children}
    </div>,
    document.body,
  )
}
