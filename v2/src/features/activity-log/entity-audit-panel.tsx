import { Activity, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getActionLabel,
  getActionTone,
  useEntityAuditLog,
} from '@/features/activity-log/queries'
import {
  ClauseDiffView,
  DiffList,
  isClauseEdit,
} from '@/features/activity-log/audit-diff'
import { cn } from '@/lib/utils'
import type { DiffItem } from '@/features/contracts/contract-diff'

const ENTRIES_INITIAL = 5

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

/**
 * Compact audit log timeline for a specific entity row.
 * Drop into the right-rail of a detail page.
 *
 * Pass `diffFn` to enable field-level change display.
 * Clause edits are auto-detected and rendered as track-changes inline diff.
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
  const [showAll, setShowAll] = useState(false)

  const allEntries = data ?? []
  const visibleEntries = showAll ? allEntries : allEntries.slice(0, ENTRIES_INITIAL)
  const hiddenCount = allEntries.length - ENTRIES_INITIAL

  return (
    <div className='rounded-md border bg-card'>
      <div className='flex items-center gap-2 border-b px-4 py-3'>
        <Activity className='size-4 text-muted-foreground' />
        <h3 className='text-sm font-semibold'>{title}</h3>
        {allEntries.length > 0 && (
          <span className='ms-auto text-xs text-muted-foreground'>
            {allEntries.length} รายการ
          </span>
        )}
      </div>
      {isLoading ? (
        <div className='space-y-2 p-4'>
          {Array.from({ length: 3 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
            <Skeleton key={`sk-${i}`} className='h-12 w-full' />
          ))}
        </div>
      ) : allEntries.length === 0 ? (
        <p className='px-4 py-6 text-center text-xs text-muted-foreground'>
          {emptyText}
        </p>
      ) : (
        <>
          <ol className='divide-y'>
            {visibleEntries.map((r) => {
              const clauseEdit = r.action === 'update' && isClauseEdit(r.before)
              const fieldDiffs =
                !clauseEdit && diffFn && r.action === 'update' && r.before && r.after
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
                      {clauseEdit && <ClauseDiffView before={r.before} after={r.after} />}
                      {fieldDiffs.length > 0 && <DiffList diffs={fieldDiffs} />}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
          {hiddenCount > 0 && (
            <button
              type='button'
              onClick={() => setShowAll((v) => !v)}
              className='flex w-full items-center justify-center gap-1.5 border-t px-4 py-2.5 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            >
              {showAll ? (
                <><ChevronUp className='size-3.5' /> ย่อ</>
              ) : (
                <><ChevronDown className='size-3.5' /> ดูอีก {hiddenCount} รายการ</>
              )}
            </button>
          )}
        </>
      )}
    </div>
  )
}
