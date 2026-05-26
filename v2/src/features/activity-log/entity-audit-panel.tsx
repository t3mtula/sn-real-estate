import { Activity } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getActionLabel,
  getActionTone,
  useEntityAuditLog,
} from '@/features/activity-log/queries'
import { cn } from '@/lib/utils'
import type { DiffItem } from '@/features/contracts/contract-diff'

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
 * diffFn receives (before, after) from the audit record and returns DiffItem[].
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
                    {diffs.length > 0 && (
                      <div className='mt-2 rounded-md bg-muted/50 px-3 py-2'>
                        <table className='w-full text-xs'>
                          <tbody>
                            {diffs.map((d, i) => (
                              // biome-ignore lint/suspicious/noArrayIndexKey: static diff list
                              <tr key={i} className='align-top'>
                                <td className='py-0.5 pr-3 text-muted-foreground whitespace-nowrap'>
                                  {d.label}
                                </td>
                                <td className='py-0.5 pr-2 text-destructive/80 line-through whitespace-pre-wrap break-all'>
                                  {d.from}
                                </td>
                                <td className='py-0.5 pr-2 text-muted-foreground'>→</td>
                                <td className='py-0.5 text-foreground whitespace-pre-wrap break-all'>
                                  {d.to}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
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
