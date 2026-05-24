/**
 * OverdueBadge — number-first red badge for overdue/outstanding amounts.
 *
 * Two display modes:
 *   - amount only: "ค้าง 30,000"
 *   - amount + count: "ค้าง 30,000 · 2 ใบ"
 *
 * Renders nothing when count = 0 (callers don't need to gate).
 */

import { AlertTriangle } from 'lucide-react'
import { amt } from '@/lib/thai'
import { SEVERITY_BADGE } from '@/components/yonghua/severity'
import { cn } from '@/lib/utils'

type Props = {
  count: number
  amount: number
  /** Show count + "ใบ" / "ราย" suffix · default "ใบ" */
  unit?: 'ใบ' | 'ราย' | 'สัญญา'
  /** Hide count, just show amount */
  amountOnly?: boolean
  className?: string
}

export function OverdueBadge({
  count,
  amount,
  unit = 'ใบ',
  amountOnly = false,
  className,
}: Props) {
  if (count <= 0 && amount <= 0) return null
  const amountText = amt(amount, { symbol: false, decimal: 0 })
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums',
        SEVERITY_BADGE.critical,
        className,
      )}
    >
      <AlertTriangle className='size-3' />
      ค้าง {amountText}
      {!amountOnly && count > 0 && (
        <span className='font-normal opacity-80'>
          · {count.toLocaleString('th-TH')} {unit}
        </span>
      )}
    </span>
  )
}
