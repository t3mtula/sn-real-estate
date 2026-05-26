import { Activity } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getActionLabel,
  getActionTone,
  useEntityAuditLog,
} from '@/features/activity-log/queries'
import { cn } from '@/lib/utils'
import type { DiffItem } from '@/features/contracts/contract-diff'

const COLLAPSE_AT = 3

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const yearBE = d.getFullYear() + 543
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${day}/${mo}/${yearBE} ${hh}:${mm}`
}

function DiffList({ diffs }: { diffs: DiffItem[] }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? diffs : diffs.slice(0, COLLAPSE_AT)
  const hidden = diffs.length - COLLAPSE_AT

  return (
    <div className='mt-2 rounded-md bg-muted/40 px-3 py-2 text-xs space-y-1'>
      {visible.map((d, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static diff list
        <div key={i} className='flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 leading-snug'>
          <span className='text-muted-foreground shrink-0'>{d.label}:</span>
          <span className='text-destructive/80 line-through break-all'>{d.from}</span>
          <span className='text-muted-foreground shrink-0'>→</span>
          <span className='text-foreground break-all'>{d.to}</span>
        </div>
      ))}
      {!expanded && hidden > 0 && (
        <button
          type='button'
          onClick={() => setExpanded(true)}
          className='text-muted-foreground hover:text-foreground underline-offset-2 hover:underline'
        >
          ▼ ดูอีก {hidden} รายการ
        </button>
      )}
      {expanded && hidden > 0 && (
        <button
          type='button'
          onClick={() => setExpanded(false)}
          className='text-muted-foreground hover:text-foreground underline-offset-2 hover:underline'
        >
          ▲ ย่อ
        </button>
      )}
    </div>
  )
}

/**
 * Compact audit log timeline for a specific entity row.
 * Drop into the right-rail of a detail page.
 *
 * Pass `diffFn` to enable field-level change display (collapsed after 3 items).
 */
export function EntityAuditPanel({
  entity,
  entityId,
  title = 'ประวัติการเปลี่ยนแปลง',
  emptyText = 'ยังไม่มีประวัติ',
  diffFn,
}: {
  entity: string
  entityId: string | undefined
  title?: string
  emptyText?: string
  diffFn?: (before: unknown, after: unknown) => DiffItem[]
}) {
  const { data, isLoading } = useEntityAuditLog(entity, entityId)

  return (
    <div className='rounded-md border bg-card'>
      <div className='flex items-center gap-2 border-b px-4 py-3'>
        <Activity className='size-4 text-muted-foreground' />
        <h3 className='text-sm font-semibold'>{title}</h3>
      </div>
      {isLoading ? (
        <div className='space-y-2 p-4'>
          {Array.from({ length: 3 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
            <Skeleton key={`sk-${i}`} className='h-12 w-full' />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <p className='px-4 py-6 text-center text-xs text-muted-foreground'>
          {emptyText}
        </p>
      ) : (
        <ol className='divide-y'>
          {data.map((r) => {
            const diffs =
              diffFn && r.action === 'update' && r.before && r.after
                ? diffFn(r.before, r.after)
                : []
            return (
              <li key={r.id} className='px-4 py-3 text-sm'>
                <div className='flex items-start gap-2'>
                  <Badge
                    variant='outline'
                    className={cn('mt-0.5 shrink-0 font-normal', getActionTone(r.action))}
                  >
                    {getActionLabel(r.action)}
                  </Badge>
                  <div className='min-w-0 flex-1'>
                    <p className='leading-snug'>
                      {r.description?.trim() || '(ไม่มีคำอธิบาย)'}
                    </p>
                    <p className='mt-0.5 text-xs text-muted-foreground'>
                      {r.user_email || '—'} · {formatTime(r.created_at)}
                    </p>
                    {diffs.length > 0 && <DiffList diffs={diffs} />}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
