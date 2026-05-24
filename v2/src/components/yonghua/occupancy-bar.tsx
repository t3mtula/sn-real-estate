/**
 * OccupancyBar — mini horizontal bar showing occupied vs vacant ratio.
 *
 * Designed for landlord cards (overall portfolio occupancy) and property
 * groups. Default size is compact (32px wide × 4px tall) but expandable.
 */

import { cn } from '@/lib/utils'

type Props = {
  occupied: number
  total: number
  /** Show "X/Y · NN%" label on the right */
  showLabel?: boolean
  /** Bar width (Tailwind class) — default w-20 */
  widthClass?: string
  className?: string
}

export function OccupancyBar({
  occupied,
  total,
  showLabel = true,
  widthClass = 'w-20',
  className,
}: Props) {
  const safeTotal = Math.max(0, total)
  const safeOcc = Math.max(0, Math.min(safeTotal, occupied))
  const pct = safeTotal === 0 ? 0 : Math.round((safeOcc / safeTotal) * 100)
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'h-1.5 overflow-hidden rounded-full bg-muted',
          widthClass,
        )}
        title={`${safeOcc}/${safeTotal} · ${pct}%`}
      >
        <div
          className='h-full rounded-full bg-emerald-500 transition-[width] duration-300'
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className='text-[10px] tabular-nums text-muted-foreground'>
          {safeOcc}/{safeTotal} · {pct}%
        </span>
      )}
    </div>
  )
}
