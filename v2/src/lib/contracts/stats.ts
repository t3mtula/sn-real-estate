/**
 * Contract stats — pure helpers shared across list/detail/dashboard pages.
 *
 * Single source of truth for:
 *   - severity tone derivation (color + label) by days-remaining
 *   - monthly revenue normalization across payment frequencies
 *   - timeline arithmetic (days remaining, progress %)
 */

import { parseBE } from '@/lib/thai'

export type Severity = 'success' | 'warning' | 'urgent' | 'critical' | 'info' | 'muted'

/**
 * Months per payment cycle.
 *   monthly=1, quarterly=3, semi=6, annual=12, lump=null (one-shot)
 *
 * Prefers structured payFreq, falls back to legacy payment-string keyword.
 */
export function monthsPerCycle(d: {
  payFreq?: string | null
  payment?: string | null
}): number | null {
  const pf = (d.payFreq ?? '').toLowerCase().trim()
  if (pf === 'monthly') return 1
  if (pf === 'quarterly') return 3
  if (pf === 'semiannual' || pf === 'semi') return 6
  if (pf === 'annual' || pf === 'yearly') return 12
  if (pf === 'lump') return null
  // Fallback: parse legacy payment string
  const s = (d.payment ?? '').trim()
  if (/ปีละ|รายปี|ต่อปี/.test(s)) return 12
  if (/ไตรมาส/.test(s)) return 3
  if (/ครึ่งปี|6 เดือน/.test(s)) return 6
  if (/ลำพ|ทั้งหมด|ครั้งเดียว|วันเซ็น/.test(s)) return null
  if (/เดือน/.test(s)) return 1
  // Default to monthly when unknown — matches v1 behavior
  return 1
}

/**
 * Convert contract rate to monthly revenue (THB/month).
 *
 * Lump-sum contracts contribute 0 since they don't translate to a monthly
 * cadence (matches v1 dashboard `monthlyRev` behavior).
 *
 * Accepts rate as number or v1-legacy string.
 */
export function monthlyRevenue(
  rate: number | string | null | undefined,
  d: { payFreq?: string | null; payment?: string | null },
): number {
  const n = typeof rate === 'number' ? rate : Number(String(rate ?? '').replace(/[,\s฿]/g, ''))
  if (!Number.isFinite(n) || n <= 0) return 0
  const m = monthsPerCycle(d)
  if (m == null) return 0 // lump-sum doesn't contribute to monthly revenue
  return n / m
}

/**
 * Friendly short label for payment frequency (Thai).
 */
export function freqShortLabel(d: {
  payFreq?: string | null
  payment?: string | null
}): string {
  const m = monthsPerCycle(d)
  if (m === 1) return 'รายเดือน'
  if (m === 3) return 'รายไตรมาส'
  if (m === 6) return 'ครึ่งปี'
  if (m === 12) return 'รายปี'
  // lump-sum
  if (m == null) return 'จ่ายครั้งเดียว'
  return ''
}

/**
 * Days remaining until contract end (BE date string).
 * Positive = days left · Negative = days past expiry · null = no/invalid end.
 */
export function daysUntil(endBE: string | null | undefined): number | null {
  const d = parseBE(endBE ?? '')
  if (!d) return null
  return Math.round((d.toDate().getTime() - Date.now()) / 86_400_000)
}

/**
 * Days since a date (BE).
 * Positive = days elapsed since · Negative = future · null = no/invalid date.
 */
export function daysSince(dateBE: string | null | undefined): number | null {
  const d = parseBE(dateBE ?? '')
  if (!d) return null
  return Math.round((Date.now() - d.toDate().getTime()) / 86_400_000)
}

/**
 * Map days-remaining to a severity tone — shared scale for chips, badges, strips.
 *
 * Scale (matches ContractTimelineBar color bands):
 *   - cancelled              → critical (red)
 *   - not yet started        → info     (sky)
 *   - past expiry            → critical (red)
 *   - 1-30 days remaining    → urgent   (orange)
 *   - 31-90 days remaining   → warning  (amber)
 *   - >90 days remaining     → success  (emerald)
 *   - no end date            → muted    (slate)
 */
export function severityByDaysRemaining(
  daysRemaining: number | null,
  options: { started?: boolean; cancelled?: boolean; closed?: boolean } = {},
): Severity {
  if (options.cancelled) return 'critical'
  if (options.closed) return 'muted'
  if (daysRemaining == null) return 'muted'
  if (options.started === false) return 'info'
  if (daysRemaining < 0) return 'critical'
  if (daysRemaining <= 30) return 'urgent'
  if (daysRemaining <= 90) return 'warning'
  return 'success'
}

/**
 * Friendly remaining-days label.
 *   - cancelled       → "ยกเลิก"
 *   - closed          → "ปิดสัญญา"
 *   - not yet started → "เริ่มอีก N วัน"
 *   - past expiry     → "หมดเมื่อ N วัน"
 *   - in future       → "เหลือ N วัน"
 *   - no date         → "ไม่ระบุ"
 */
export function remainingLabel(
  daysRemaining: number | null,
  options: { started?: boolean; cancelled?: boolean; closed?: boolean } = {},
): string {
  if (options.cancelled) return 'ยกเลิก'
  if (options.closed) return 'ปิดสัญญา'
  if (daysRemaining == null) return 'ไม่ระบุ'
  if (options.started === false) return `เริ่มอีก ${Math.abs(daysRemaining).toLocaleString('th-TH')} วัน`
  if (daysRemaining < 0) return `หมดเมื่อ ${Math.abs(daysRemaining).toLocaleString('th-TH')} วัน`
  return `เหลือ ${daysRemaining.toLocaleString('th-TH')} วัน`
}
