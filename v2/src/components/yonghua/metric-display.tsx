/**
 * MetricDisplay — number-first display block for list rows.
 *
 *   ┌──────────┐
 *   │  15,000  │  ← big bold number
 *   │ บาท/เดือน │  ← small label
 *   └──────────┘
 *
 * Used on landlord cards (revenue) and property/tenant rows (rent, exposure).
 */

import { SEVERITY_TEXT, type Severity } from '@/components/yonghua/severity'
import { cn } from '@/lib/utils'

type Props = {
  value: string
  label?: string
  tone?: Severity
  /** Right-align number — default true (best for column display) */
  align?: 'left' | 'right'
  /** Smaller size for tight rows */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_VALUE: Record<NonNullable<Props['size']>, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
}

export function MetricDisplay({
  value,
  label,
  tone,
  align = 'right',
  size = 'md',
  className,
}: Props) {
  return (
    <div
      className={cn(
        'flex flex-col leading-tight',
        align === 'right' ? 'items-end' : 'items-start',
        className,
      )}
    >
      <span
        className={cn(
          'font-bold tabular-nums',
          SIZE_VALUE[size],
          tone ? SEVERITY_TEXT[tone] : 'text-foreground',
        )}
      >
        {value}
      </span>
      {label && (
        <span className='text-[10px] text-muted-foreground'>{label}</span>
      )}
    </div>
  )
}
