/**
 * ContractTimelineBar — compact contract date progress strip (ported from v1).
 *
 * v1 reference: modules/16-renewals.js (.progress-cell · .pc-bar · .pc-fill)
 *
 * Shows: start date · % progress · end date · horizontal bar fill,
 * color-coded by days remaining:
 *   - green   : > 90 days remaining
 *   - amber   : ≤ 90 days remaining (within renewal threshold)
 *   - red     : already expired or cancelled
 *   - sky     : not yet started
 */

import { parseBE } from '@/lib/thai/date'
import { cn } from '@/lib/utils'

type Props = {
  start?: string
  end?: string
  /** Show dates above the bar */
  showDates?: boolean
  /** Show percent label inline */
  showPercent?: boolean
  /** Cancelled or closed → render in muted/red */
  cancelled?: boolean
  className?: string
}

function bandColors(daysRemaining: number, started: boolean, cancelled: boolean) {
  if (cancelled) return { bar: '#fecaca', fill: '#dc2626', text: 'text-destructive' }
  if (!started) return { bar: '#e0f2fe', fill: '#0284c7', text: 'text-sky-700 dark:text-sky-300' }
  if (daysRemaining < 0) return { bar: '#fecaca', fill: '#dc2626', text: 'text-destructive' }
  if (daysRemaining <= 30)
    return { bar: '#fed7aa', fill: '#ea580c', text: 'text-orange-700 dark:text-orange-400' }
  if (daysRemaining <= 90)
    return { bar: '#fde68a', fill: '#d97706', text: 'text-amber-700 dark:text-amber-400' }
  return { bar: '#bbf7d0', fill: '#10b981', text: 'text-emerald-700 dark:text-emerald-400' }
}

export function ContractTimelineBar({
  start,
  end,
  showDates = true,
  showPercent = true,
  cancelled = false,
  className,
}: Props) {
  const startDate = start ? parseBE(start)?.toDate() : null
  const endDate = end ? parseBE(end)?.toDate() : null

  if (!startDate || !endDate) {
    return (
      <div className={cn('text-xs text-muted-foreground', className)}>
        ไม่มีข้อมูลระยะเวลา
      </div>
    )
  }

  const today = new Date()
  const totalDays = Math.max(
    1,
    Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000),
  )
  const elapsedDays = Math.round((today.getTime() - startDate.getTime()) / 86_400_000)
  const daysRemaining = Math.round((endDate.getTime() - today.getTime()) / 86_400_000)
  const started = elapsedDays >= 0
  const pct = Math.max(0, Math.min(100, Math.round((elapsedDays / totalDays) * 100)))
  const colors = bandColors(daysRemaining, started, cancelled)

  const remainingLabel = cancelled
    ? 'ยกเลิก'
    : !started
      ? `เริ่มอีก ${Math.abs(elapsedDays).toLocaleString('th-TH')} วัน`
      : daysRemaining < 0
        ? `เกิน ${Math.abs(daysRemaining).toLocaleString('th-TH')} วัน`
        : `เหลือ ${daysRemaining.toLocaleString('th-TH')} วัน`

  return (
    <div className={cn('w-full', className)}>
      {showDates && (
        <div className='flex items-center justify-between gap-2 text-[10px] text-muted-foreground'>
          <span className='tabular-nums'>{start || '—'}</span>
          {showPercent && (
            <span className={cn('font-semibold tabular-nums', colors.text)}>
              {pct}%
            </span>
          )}
          <span className='tabular-nums'>{end || '—'}</span>
        </div>
      )}
      <div
        className='mt-0.5 h-1.5 w-full overflow-hidden rounded-full'
        style={{ background: colors.bar }}
      >
        <div
          className='h-full rounded-full transition-[width] duration-500'
          style={{ width: `${pct}%`, background: colors.fill }}
        />
      </div>
      <div
        className={cn(
          'mt-0.5 text-[10px] font-semibold tabular-nums',
          colors.text,
        )}
      >
        {remainingLabel}
      </div>
    </div>
  )
}
