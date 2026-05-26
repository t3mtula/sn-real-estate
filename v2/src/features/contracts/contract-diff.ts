import type { ContractData } from '@/features/contracts/types'

export type DiffItem = { label: string; from: string; to: string }

// ─── character-level diff ───────────────────────────────────────────────────

export type TextSpan = { type: 'equal' | 'del' | 'ins'; text: string }

/** LCS-based character diff · falls back to block del/ins for long texts */
export function diffText(before: string, after: string): TextSpan[] {
  if (before === after) return [{ type: 'equal', text: before }]
  if (!before) return [{ type: 'ins', text: after }]
  if (!after) return [{ type: 'del', text: before }]

  const a = [...before]
  const b = [...after]
  const m = a.length
  const n = b.length

  // Cap to prevent O(n²) blowup on very long texts
  if (m > 400 || n > 400) {
    return [{ type: 'del', text: before }, { type: 'ins', text: after }]
  }

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])

  // Backtrace
  const raw: TextSpan[] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      raw.unshift({ type: 'equal', text: a[i - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      raw.unshift({ type: 'ins', text: b[j - 1] })
      j--
    } else {
      raw.unshift({ type: 'del', text: a[i - 1] })
      i--
    }
  }

  // Merge consecutive same-type spans
  const merged: TextSpan[] = []
  for (const op of raw) {
    if (merged.length > 0 && merged[merged.length - 1].type === op.type) {
      merged[merged.length - 1].text += op.text
    } else {
      merged.push({ ...op })
    }
  }
  return merged
}

// ─── clause diff ────────────────────────────────────────────────────────────

type RawClause = { text: string; sub?: string[] }

export type SubDiffEntry = {
  index: number
  type: 'modified' | 'added' | 'removed'
  spans: TextSpan[]
}

export type ClauseDiffEntry = {
  clauseNo: number
  type: 'modified' | 'added' | 'removed'
  textSpans: TextSpan[]
  subDiffs: SubDiffEntry[]
}

function normClause(c: RawClause): { text: string; sub: string[] } {
  return { text: (c.text ?? '').trim(), sub: (c.sub ?? []).map((s) => s.trim()) }
}

export function diffClauses(before: unknown, after: unknown): ClauseDiffEntry[] {
  const bClauses = ((before as Record<string, unknown>)?.contractClauses ?? []) as RawClause[]
  const aClauses = ((after as Record<string, unknown>)?.contractClauses ?? []) as RawClause[]
  if (!bClauses.length && !aClauses.length) return []

  const results: ClauseDiffEntry[] = []
  const len = Math.max(bClauses.length, aClauses.length)

  for (let idx = 0; idx < len; idx++) {
    const bRaw = bClauses[idx]
    const aRaw = aClauses[idx]

    if (!bRaw) {
      const a = normClause(aRaw)
      results.push({
        clauseNo: idx + 1,
        type: 'added',
        textSpans: [{ type: 'ins', text: a.text }],
        subDiffs: a.sub.map((s, i) => ({ index: i, type: 'added', spans: [{ type: 'ins', text: s }] })),
      })
      continue
    }
    if (!aRaw) {
      const b = normClause(bRaw)
      results.push({
        clauseNo: idx + 1,
        type: 'removed',
        textSpans: [{ type: 'del', text: b.text }],
        subDiffs: b.sub.map((s, i) => ({ index: i, type: 'removed', spans: [{ type: 'del', text: s }] })),
      })
      continue
    }

    const b = normClause(bRaw)
    const a = normClause(aRaw)
    const textChanged = b.text !== a.text
    const subLen = Math.max(b.sub.length, a.sub.length)
    const subDiffs: SubDiffEntry[] = []

    for (let si = 0; si < subLen; si++) {
      const bs = b.sub[si]
      const as_ = a.sub[si]
      if (!bs) {
        subDiffs.push({ index: si, type: 'added', spans: [{ type: 'ins', text: as_ }] })
      } else if (!as_) {
        subDiffs.push({ index: si, type: 'removed', spans: [{ type: 'del', text: bs }] })
      } else if (bs !== as_) {
        subDiffs.push({ index: si, type: 'modified', spans: diffText(bs, as_) })
      }
    }

    if (textChanged || subDiffs.length > 0) {
      results.push({
        clauseNo: idx + 1,
        type: 'modified',
        textSpans: textChanged ? diffText(b.text, a.text) : [{ type: 'equal', text: b.text }],
        subDiffs,
      })
    }
  }
  return results
}

// ─── field diff ─────────────────────────────────────────────────────────────

const TRACKED: Array<{ key: keyof ContractData; label: string }> = [
  { key: 'no', label: 'เลขที่สัญญา' },
  { key: 'tenant', label: 'ผู้เช่า' },
  { key: 'tenantAddr', label: 'ที่อยู่ผู้เช่า' },
  { key: 'taxId', label: 'เลขผู้เสียภาษี' },
  { key: 'landlord', label: 'ผู้ให้เช่า' },
  { key: 'landlordAddr', label: 'ที่อยู่ผู้ให้เช่า' },
  { key: 'start', label: 'วันเริ่ม' },
  { key: 'end', label: 'วันสิ้นสุด' },
  { key: 'rate', label: 'ค่าเช่า' },
  { key: 'rateAmount', label: 'ค่าเช่า (จำนวน)' },
  { key: 'rateIntervalMonths', label: 'ความถี่ชำระ' },
  { key: 'billingStart', label: 'วันเริ่มเก็บ' },
  { key: 'deposit', label: 'เงินประกัน' },
  { key: 'payment', label: 'รอบชำระ' },
  { key: 'dur', label: 'ระยะสัญญา' },
  { key: 'madeDate', label: 'วันที่ทำสัญญา' },
  { key: 'madeAt', label: 'สถานที่ทำสัญญา' },
  { key: 'wit1', label: 'พยานคนที่ 1' },
  { key: 'wit2', label: 'พยานคนที่ 2' },
  { key: 'cancelled', label: 'ยกเลิก' },
  { key: 'cancelledDate', label: 'วันที่ยกเลิก' },
  { key: 'cancelledReason', label: 'เหตุผลยกเลิก' },
  { key: 'noticeDate', label: 'วันแจ้งออก' },
  { key: 'plannedMoveOut', label: 'วันที่วางแผนออก' },
  { key: 'closed', label: 'ปิดสัญญา' },
  { key: 'bankAccountId', label: 'บัญชีธนาคาร' },
]

function toStr(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'ใช่' : 'ไม่'
  return String(v).trim() || '—'
}

export function diffContractData(before: unknown, after: unknown): DiffItem[] {
  const b = (before ?? {}) as Record<string, unknown>
  const a = (after ?? {}) as Record<string, unknown>
  const diffs: DiffItem[] = []
  for (const { key, label } of TRACKED) {
    const bStr = toStr(b[key])
    const aStr = toStr(a[key])
    if (bStr !== aStr) {
      diffs.push({ label, from: bStr, to: aStr })
    }
  }
  return diffs
}
