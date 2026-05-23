/**
 * Contract data normalization helpers.
 *
 * Legacy v1 IDB data stored numeric-looking fields as strings (e.g. "5,000",
 * "3 ปี", or numeric ids as numbers). v2 form schema expects real numbers
 * and text bank IDs. These helpers coerce safely at read time.
 */

import type { ContractData } from '@/features/contracts/types'

/** Safely coerce a JSONB value that might be string / number / null to a number. */
export function coerceNumber(v: unknown): number {
  if (typeof v === 'number' && !isNaN(v)) return v
  if (typeof v === 'string') {
    const s = v.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/)
    if (s) return parseFloat(s[1])
  }
  return 0
}

/** Coerce contract dur field — "3 ปี" → 36 months · "36" → 36 · 36 → 36. */
export function coerceDurMonths(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const match = v.match(/(\d+)/)
    if (!match) return 0
    const n = parseInt(match[1], 10)
    if (/ปี/.test(v)) return n * 12
    return n
  }
  return 0
}

/**
 * Read-time normalize: returns a shape consumers can trust.
 *
 * Adds derived numeric fields without mutating the original. Keeps all
 * original v1 keys untouched so write paths can still round-trip.
 */
export function normalizeContract(d: ContractData | undefined) {
  if (!d) return null
  const dAny = d as Record<string, unknown>
  return {
    ...d,
    depositNum: coerceNumber(d.deposit),
    rateNum: coerceNumber(d.rate),
    durMonths: coerceNumber(dAny.durMonths) || coerceDurMonths(d.dur),
    bankAccountId: d.bankAccountId ? String(d.bankAccountId) : undefined,
  }
}
