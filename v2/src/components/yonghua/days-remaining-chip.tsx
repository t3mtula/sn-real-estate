/**
 * DaysRemainingChip — glanceable "เหลือ X วัน" pill with semantic color.
 *
 * Used in contracts/properties/landlords list rows to surface contract expiry
 * urgency at a glance. Sits next to or below rent amount.
 */

import { Clock } from 'lucide-react'
import {
  daysUntil,
  remainingLabel,
  severityByDaysRemaining,
} from '@/lib/contracts/stats'
import { SEVERITY_BADGE } from '@/components/yonghua/severity'
import { cn } from '@/lib/utils'

type Props = {
  /** Contract end date in BE "DD/MM/YYYY" format */
  end?: string | null
  /** Contract start date in BE "DD/MM/YYYY" — used to detect "not yet started" */
  start?: string | null
  cancelled?: boolean
  closed?: boolean
  /** Hide icon for compact contexts */
  hideIcon?: boolean
  className?: string
}

export function DaysRemainingChip({
  end,
  start,
  cancelled = false,
  closed = false,
  hideIcon = false,
  className,
}: Props) {
  const days = daysUntil(end)
  const startDays = daysUntil(start)
  const started = startDays == null || startDays <= 0
  const sev = severityByDaysRemaining(days, { started, cancelled, closed })
  const label = remainingLabel(days, { started, cancelled, closed })
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium tabular-nums',
        SEVERITY_BADGE[sev],
        className,
      )}
    >
      {!hideIcon && <Clock className='size-2.5' />}
      {label}
    </span>
  )
}
