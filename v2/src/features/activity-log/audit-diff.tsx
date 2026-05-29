/**
 * Shared diff-rendering components used by both:
 *   - EntityAuditPanel  (per-entity detail page sidebar)
 *   - ActivityLog       (global log page, expandable per row)
 */
import { useState } from 'react'
import {
  diffClauses,
  type ClauseDiffEntry,
  type DiffItem,
  type TextSpan,
} from '@/features/contracts/contract-diff'
import { cn } from '@/lib/utils'

const DIFF_COLLAPSE_AT = 3
const CLAUSE_COLLAPSE_AT = 3

// ─── text diff ───────────────────────────────────────────────────────────────

export function InlineTextDiff({ spans }: { spans: TextSpan[] }) {
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

// ─── field-level diff ────────────────────────────────────────────────────────

export function DiffList({ diffs }: { diffs: DiffItem[] }) {
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

// ─── clause diff ─────────────────────────────────────────────────────────────

export function ClauseDiffView({ before, after }: { before: unknown; after: unknown }) {
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

            {mainChanged && (
              <p className='mt-0.5 leading-relaxed break-words'>
                <InlineTextDiff spans={e.textSpans} />
              </p>
            )}

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

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns true when the before snapshot is a clause-only save
 * (useUpdateContractClausesFull stores exactly { contractClauses: [...] }).
 */
export function isClauseEdit(before: unknown): boolean {
  if (!before || typeof before !== 'object') return false
  const keys = Object.keys(before as object)
  return keys.length === 1 && keys[0] === 'contractClauses'
}

function toStr(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'ใช่' : 'ไม่'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v).trim() || '—'
}

/**
 * Generic diff for non-contract entities: compare every key in before vs after.
 * Keys are shown as-is (no Thai translation).
 * Skips keys where the serialised value didn't change.
 */
export function diffGeneric(before: unknown, after: unknown): DiffItem[] {
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') return []
  const b = before as Record<string, unknown>
  const a = after as Record<string, unknown>
  const keys = new Set([...Object.keys(b), ...Object.keys(a)])
  const diffs: DiffItem[] = []
  const SKIP = new Set(['id', 'created_at', 'updated_at', 'org_id'])
  for (const key of keys) {
    if (SKIP.has(key)) continue
    const bStr = toStr(b[key])
    const aStr = toStr(a[key])
    if (bStr !== aStr) {
      diffs.push({ label: key, from: bStr, to: aStr })
    }
  }
  return diffs
}
