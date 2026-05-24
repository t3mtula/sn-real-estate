/**
 * ContractMiniRow — compact one-line contract summary for hover previews.
 *
 *   [icon]  Title (tenant or property)         [days-chip]
 *           ฿15,000/ด · 1/1/68 → 31/12/68      [overdue?]
 *
 * Used inside Property/Tenant/Landlord hover popovers to preview the contracts
 * attached to that entity without making the user click into the detail page.
 */

import { Building2, UserRound } from 'lucide-react'
import { DaysRemainingChip } from '@/components/yonghua/days-remaining-chip'
import { OverdueBadge } from '@/components/yonghua/overdue-badge'
import { freqShortLabel, monthlyRevenue } from '@/lib/contracts/stats'
import { amt } from '@/lib/thai'
import type { ContractMatchRow } from '@/lib/queries/contract-match'

type Props = {
  contract: ContractMatchRow
  /** What to show as title — 'tenant' (in property/landlord hover) or 'property' (in tenant hover) */
  titleField: 'tenant' | 'property'
  overdueAmount?: number
  overdueCount?: number
}

export function ContractMiniRow({
  contract,
  titleField,
  overdueAmount = 0,
  overdueCount = 0,
}: Props) {
  const d = contract.data ?? {}
  const Icon = titleField === 'tenant' ? UserRound : Building2
  const title =
    titleField === 'tenant'
      ? String(d.tenant ?? '').trim() || '(ไม่ระบุผู้เช่า)'
      : String(d.property ?? '').trim() || '(ไม่ระบุทรัพย์)'
  const monthly = monthlyRevenue(d.rate ?? null, d ?? {})
  const rentText = monthly > 0
    ? amt(monthly, { symbol: false, decimal: 0 })
    : amt(d.rate ?? null, { symbol: false, decimal: 0 })
  const freq = freqShortLabel(d ?? {})
  const start = d.start ?? '—'
  const end = d.end ?? '—'
  // Visual: NOT a card / NOT clickable — hover popover is pointer-events:none.
  // Keep visual subtle (no border, no shadow, no hover state) so it doesn't
  // suggest interactivity. User sees the data, then clicks the underlying row
  // to navigate (or memorizes and clicks the entity in its own list).
  return (
    <div className='flex items-start gap-2 border-l-2 border-l-muted-foreground/20 pl-2 py-0.5'>
      <Icon className='mt-0.5 size-3.5 shrink-0 text-muted-foreground' />
      <div className='min-w-0 flex-1'>
        <div className='flex items-center justify-between gap-1'>
          <span className='truncate text-xs font-medium' title={title}>
            {title}
          </span>
          <DaysRemainingChip
            end={end}
            start={start}
            cancelled={!!d.cancelled}
            closed={!!d.closed}
            hideIcon
          />
        </div>
        <div className='mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground'>
          <span className='tabular-nums'>
            {rentText !== '—' ? `${rentText}/ด.` : '—'}
          </span>
          {freq && freq !== 'รายเดือน' && (
            <span className='rounded bg-muted px-1 py-px text-[9px]'>{freq}</span>
          )}
          <span>·</span>
          <span className='tabular-nums'>{start} → {end}</span>
        </div>
        {overdueCount > 0 && (
          <div className='mt-1'>
            <OverdueBadge count={overdueCount} amount={overdueAmount} unit='ใบ' />
          </div>
        )}
      </div>
    </div>
  )
}
