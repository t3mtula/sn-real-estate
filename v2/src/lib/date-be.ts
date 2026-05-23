/**
 * date-be.ts — Buddhist Era (พ.ศ.) date helpers
 *
 * All functions work with "DD/MM/YYYY" strings where YYYY is BE year (พ.ศ.)
 * e.g. "01/06/2569" = 1 June 2026 CE
 *
 * Delegates parsing/formatting to the canonical @/lib/thai functions so the
 * two sources stay consistent. This module adds ISO ↔ BE bridge helpers and
 * a standalone isBEString validator that components can import without pulling
 * in all of @/lib/thai.
 */

import { parseBE, fmtBE, todayBE } from '@/lib/thai'

export { todayBE }

/**
 * Parse a "DD/MM/YYYY" BE string → JS Date (CE).
 * Returns null for empty or invalid input.
 */
export function parseBEString(str: string): Date | null {
  if (!str?.trim()) return null
  const d = parseBE(str.trim())
  return d ? d.toDate() : null
}

/**
 * Format a JS Date → "DD/MM/YYYY" BE string.
 */
export function formatBEDate(date: Date): string {
  return fmtBE(date)
}

/**
 * "DD/MM/YYYY" BE → "YYYY-MM-DD" CE (ISO)
 * Returns "" if invalid.
 */
export function beToISO(str: string): string {
  if (!str?.trim()) return ''
  const d = parseBE(str.trim())
  if (!d) return ''
  return d.format('YYYY-MM-DD')
}

/**
 * "YYYY-MM-DD" CE (ISO) → "DD/MM/YYYY" BE
 * Returns "" if invalid.
 */
export function isoToBE(str: string): string {
  if (!str?.trim()) return ''
  // Parse as CE date using dayjs, then format as BE
  const parts = str.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!parts) return ''
  const [, yStr, mStr, dStr] = parts
  const y = Number.parseInt(yStr, 10)
  const mo = Number.parseInt(mStr, 10)
  const day = Number.parseInt(dStr, 10)
  if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(day)) return ''
  const date = new Date(y, mo - 1, day)
  if (date.getFullYear() !== y || date.getMonth() + 1 !== mo || date.getDate() !== day) return ''
  const dayPad = String(day).padStart(2, '0')
  const moPad = String(mo).padStart(2, '0')
  const yyyy = y + 543
  return `${dayPad}/${moPad}/${yyyy}`
}

/**
 * Validates that a string matches "DD/MM/YYYY" format AND is a real date.
 * The YYYY part must be a plausible BE year (> 2400, i.e. after CE ~1857).
 */
export function isBEString(str: string): boolean {
  if (!str?.trim()) return false
  const trimmed = str.trim()
  // Must match DD/MM/YYYY exactly
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return false
  const [, , yyyy] = trimmed.split('/').map(Number)
  if (yyyy < 2400) return false // sanity: must be BE year
  return !!parseBE(trimmed)
}

/**
 * Normalize a raw user-typed string to "DD/MM/YYYY" BE format.
 *
 * Handles:
 * - CE year input (e.g. 2026 → 2569) when year ≤ 2100
 * - Partial padding: "1/6/2569" → "01/06/2569"
 * - Two-digit BE year (e.g. "69" → 2569)
 *
 * Returns "" if the value cannot be parsed.
 */
export function normalizeBEInput(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  const m = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (!m) return ''

  const dd = Number.parseInt(m[1], 10)
  const mm = Number.parseInt(m[2], 10)
  let yyyy = Number.parseInt(m[3], 10)

  // 2-digit year → assume 2500+
  if (m[3].length === 2) yyyy = 2500 + yyyy

  // CE year (≤ 2100 is definitely CE, not BE) → convert to BE
  if (yyyy <= 2100) yyyy += 543

  // Basic range checks
  if (mm < 1 || mm > 12) return ''
  if (dd < 1 || dd > 31) return ''

  const beStr = `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${yyyy}`
  // Final validation via parseBE (catches invalid calendar dates like 31 Feb)
  return parseBE(beStr) ? beStr : ''
}
