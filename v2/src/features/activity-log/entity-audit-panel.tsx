import { Activity, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getActionLabel,
  getActionTone,
  useEntityAuditLog,
} from '@/features/activity-log/queries'
import { cn } from '@/lib/utils'
import {
  diffClauses,
  type ClauseDiffEntry,
  type DiffItem,
  type TextSpan,
} from '@/features/contracts/contract-diff'

const DIFF_COLLAPSE_AT = 3
const CLAUSE_COLLAPSE_AT = 3
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

/** Render a text diff with colored inline spans */
function InlineTextDiff({ spans }: { spans: TextSpan[] }) {
  return (
    <>
      {spans.map((s, i) => {
        if (s.type === 'equal') return <span key={i}>{s.text}</span>
        if (s.type === 'del')
          return (
            <span
              key={i}
              className='rounded-sm bg-red-100 text-red-700 line-through dark:bg-red-950/60 dark:text-red-400'
            >
              {s.text}
            </span>
          )
        return (
          <span
            key={i}
            className='rounded-sm bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-400'
          >
            {s.text}
          </span>
        )
      })}
    </>
  )
}

/** Track-changes view for per-contract clause edits */
function ClauseDiffView({ before, after }: { before: unknown; after: unknown }) {
  const entries = diffClauses(before, after)
  const [expanded, setExpanded] = useState(false)
  if (entries.length === 0) return null

  const visible = expanded ? entries : entries.slice(0, CLAUSE_COLLAPSE_AT)
  const hidden = entries.length - CLAUSE_COLLAPSE_AT

  return (
    <div className='mt-2 space-y-2.5 rounded-md bg-muted/40 px-3 py-2 text-xs'>
      {visible.map((e: ClauseDiffEntry) => {
        const mainChanged = e.textSpans.some((s) => s.type !== 'equal')
        return (
          <div key={e.clauseNo}>
            {/* Clause header */}
            <span className='text-[10px] font-semibold text-muted-foreground'>
              ข้อ {e.clauseNo}
              {e.type === 'added' && (
                <span className='ms-1 text-green-600 dark:text-green-400'> · เพิ่มใหม่</span>
              )}
              {e.type === 'removed' && (
                <span className='ms-1 text-red-600 dark:text-red-400'> · ลบออก</span>
              )}
              {e.type === 'modified' && !mainChanged && e.subDiffs.length > 0 && (
                <span className='ms-1 text-sky-600 dark:text-sky-400'> · แก้ข้อย่อย</span>
              )}
            </span>

            {/* Main text — show only when it changed */}
            {mainChanged && (
              <p className='mt-0.5 leading-relaxed break-words'>
                <InlineTextDiff spans={e.textSpans} />
              </p>
            )}

            {/* Sub-clause diffs */}
            {e.subDiffs.map((sd) => (
              <p
                key={sd.index}
                className='mt-0.5 ms-3 leading-relaxed break-words text-[11px]'
              >
                <span
                  className={cn(
                    'me-1 font-medium',
                    sd.type === 'added'
                      ? 'text-green-600 dark:text-green-400'
                      : sd.type === 'removed'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-muted-foreground',
                  )}
                >
                  ({sd.index + 1})
                </span>
                <InlineTextDiff spans={sd.spans} />
              </p>
            ))}
          </div>
        )
      })}
      {!expanded && hidden > 0 && (
        <button
          type='button'
          onClick={() => setExpanded(true)}
          className='text-muted-foreground hover:text-foreground underline-offset-2 hover:underline'
        >
          ▼ ดูอีก {hidden} ข้อ
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

/** Field-level diff list (non-clause updates) */
function DiffList({ diffs }: { diffs: DiffItem[] }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? diffs : diffs.slice(0, DIFF_COLLAPSE_AT)
  const hidden = diffs.length - DIFF_COLLAPSE_AT

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
 * Detect clause-save vs regular contract edit.
 * useUpdateContractClausesFull stores before: { contractClauses: [...] } — exactly 1 key.
 * useUpdateContract stores before: existingData (full ContractData — many keys).
 */
function isClauseEdit(before: unknown): boolean {
  if (!before || typeof before !== 'object') return false
  const keys = Object.keys(before as object)
  return keys.length === 1 && keys[0] === 'contractClauses'
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
