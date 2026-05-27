import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { parseBE, parseAmtLoose } from '@/lib/thai'
import {
  INVOICE_STATUSES,
  type Invoice,
  type InvoiceData,
  type InvoiceStatus,
} from '@/features/invoices/types'

const TABLE = 'invoices'

/**
 * Fetch all invoices · sorted by month desc then invoiceNo desc
 */
export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: async (): Promise<Invoice[]> => {
      const { data, error } = await supabase
        .from(TABLE)
        .select('id, contract_id, status, category, data, created_at, updated_at')
      if (error) throw error
      const rows = (data ?? []) as Invoice[]
      return rows.sort((a, b) => {
        const ma = a.data?.month ?? ''
        const mb = b.data?.month ?? ''
        if (ma !== mb) return ma < mb ? 1 : -1
        const na = a.data?.invoiceNo ?? ''
        const nb = b.data?.invoiceNo ?? ''
        return na < nb ? 1 : na > nb ? -1 : 0
      })
    },
  })
}

/** Fetch single invoice by ID */
export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ['invoices', id],
    queryFn: async (): Promise<Invoice | null> => {
      if (!id) return null
      const { data, error } = await supabase
        .from(TABLE)
        .select('id, contract_id, status, category, data, created_at, updated_at')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data as Invoice | null
    },
    enabled: !!id,
  })
}

/** Fetch invoices for a single contract */
export function useInvoicesByContract(contractId: string | undefined) {
  return useQuery({
    queryKey: ['invoices', 'by-contract', contractId],
    queryFn: async (): Promise<Invoice[]> => {
      if (!contractId) return []
      const { data, error } = await supabase
        .from(TABLE)
        .select('id, contract_id, status, category, data, created_at, updated_at')
        .eq('contract_id', contractId)
      if (error) throw error
      const rows = (data ?? []) as Invoice[]
      return rows.sort((a, b) => {
        const ma = a.data?.month ?? ''
        const mb = b.data?.month ?? ''
        return ma < mb ? 1 : ma > mb ? -1 : 0
      })
    },
    enabled: !!contractId,
  })
}

/* ---------- helpers ---------- */

const STATUS_META: Record<InvoiceStatus, (typeof INVOICE_STATUSES)[number]> =
  Object.fromEntries(INVOICE_STATUSES.map((s) => [s.value, s])) as Record<
    InvoiceStatus,
    (typeof INVOICE_STATUSES)[number]
  >

export function getStatusMeta(status: string | undefined | null) {
  const key = (status ?? '').toLowerCase() as InvoiceStatus
  return STATUS_META[key] ?? STATUS_META.unknown
}

/**
 * Compute display status — combines stored status with overdue derivation
 *
 * Mirror v1 getDisplayStatus():
 *   - paid → 'paid'
 *   - voided → 'voided'
 *   - past dueDate · not paid → 'overdue' (we map to 'sent' tone + overdue flag)
 *   - partial → 'partial'
 *   - otherwise → status as-is (default 'draft')
 */
export function getEffectiveStatus(inv: Invoice): InvoiceStatus {
  const stored = (inv.status ?? inv.data?.status ?? '').toLowerCase()
  if (stored === 'paid') return 'paid'
  if (stored === 'voided') return 'voided'
  if (stored === 'partial') return 'partial'
  if (stored === 'sent' || stored === 'draft') {
    return (stored as InvoiceStatus) || 'draft'
  }
  return 'unknown'
}

/** Is invoice past due date and not paid/voided? */
export function isOverdue(inv: Invoice, now: Date = new Date()): boolean {
  const status = (inv.status ?? inv.data?.status ?? '').toLowerCase()
  if (status === 'paid' || status === 'voided') return false
  const due = parseBE(inv.data?.dueDate ?? '')
  if (!due) return false
  return due.toDate().getTime() < now.getTime()
}

/** Days overdue (positive = overdue) · returns 0 if not overdue */
export function daysOverdue(inv: Invoice, now: Date = new Date()): number {
  if (!isOverdue(inv, now)) return 0
  const due = parseBE(inv.data?.dueDate ?? '')
  if (!due) return 0
  return Math.floor((now.getTime() - due.toDate().getTime()) / 86_400_000)
}

/** Invoice display label · prefers invoiceNo · fallback id */
export function getInvoiceDisplay(inv: Invoice): string {
  return (inv.data?.invoiceNo ?? '').trim() || `#${inv.id}`
}

/**
 * Format month bucket "YYYY-MM" → BE display "เดือน BE-YY"
 * Example: "2026-05" → "พ.ค. 2569"
 */
export function formatMonth(month: string | undefined): string {
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return month ?? '—'
  const [y, mo] = month.split('-')
  const thMonthsShort = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
  ]
  const idx = Number.parseInt(mo, 10) - 1
  const yearBE = Number.parseInt(y, 10) + 543
  return `${thMonthsShort[idx]} ${yearBE}`
}

/* ---------- amount + frequency helpers (ported from v1 modules/19-invoices.js) ---------- */

/** Payment frequency mapping · v2 uses contract.payment string
 *  Includes v1 keyword variants (เดือนละ / ไตรมาสละ / ครึ่งปีละ / ปีละ)
 *  for backward compat with legacy contract data
 */
type FreqEntry = { type: InvoiceData['freqType']; months: number; label: string }

const PAYMENT_FREQ_MAP: Record<string, FreqEntry> = {
  // v2 canonical strings
  'รายเดือน':    { type: 'monthly',   months: 1,  label: 'ค่าเช่ารายเดือน' },
  'รายไตรมาส':  { type: 'quarterly', months: 3,  label: 'ค่าเช่ารายไตรมาส' },
  'ทุก 3 เดือน': { type: 'quarterly', months: 3,  label: 'ค่าเช่าทุก 3 เดือน' },
  'ทุก 6 เดือน': { type: 'semi',      months: 6,  label: 'ค่าเช่าครึ่งปี' },
  'ครึ่งปี':     { type: 'semi',      months: 6,  label: 'ค่าเช่าครึ่งปี' },
  'รายปี':       { type: 'yearly',    months: 12, label: 'ค่าเช่ารายปี' },
  'ตามสัญญา':   { type: 'lump',      months: 1,  label: 'ค่าเช่า (ชำระครั้งเดียว)' },
  // v1 keyword aliases
  'เดือนละ':    { type: 'monthly',   months: 1,  label: 'ค่าเช่ารายเดือน' },
  'ทุกเดือน':   { type: 'monthly',   months: 1,  label: 'ค่าเช่ารายเดือน' },
  'ไตรมาสละ':  { type: 'quarterly', months: 3,  label: 'ค่าเช่ารายไตรมาส' },
  'ครึ่งปีละ':  { type: 'semi',      months: 6,  label: 'ค่าเช่าครึ่งปี' },
  'ปีละ':       { type: 'yearly',    months: 12, label: 'ค่าเช่ารายปี' },
  'ทุกปี':      { type: 'yearly',    months: 12, label: 'ค่าเช่ารายปี' },
}

/** ลำดับ keyword จาก specific → generic เพื่อกัน false match */
const FREQ_KEYWORD_ORDER: Array<[string, FreqEntry]> = [
  ['รายไตรมาส',  PAYMENT_FREQ_MAP['รายไตรมาส']],
  ['ไตรมาสละ',  PAYMENT_FREQ_MAP['ไตรมาสละ']],
  ['ทุก 3 เดือน', PAYMENT_FREQ_MAP['ทุก 3 เดือน']],
  ['ครึ่งปีละ',  PAYMENT_FREQ_MAP['ครึ่งปีละ']],
  ['ทุก 6 เดือน', PAYMENT_FREQ_MAP['ทุก 6 เดือน']],
  ['ครึ่งปี',    PAYMENT_FREQ_MAP['ครึ่งปี']],
  ['รายปี',      PAYMENT_FREQ_MAP['รายปี']],
  ['ทุกปี',      PAYMENT_FREQ_MAP['ทุกปี']],
  ['ปีละ',       PAYMENT_FREQ_MAP['ปีละ']],
  ['รายเดือน',   PAYMENT_FREQ_MAP['รายเดือน']],
  ['ทุกเดือน',   PAYMENT_FREQ_MAP['ทุกเดือน']],
  ['เดือนละ',    PAYMENT_FREQ_MAP['เดือนละ']],
]

const DEFAULT_FREQ: FreqEntry = { type: 'monthly', months: 1, label: 'ค่าเช่ารายเดือน' }

/** Substring-match payment string → FreqEntry */
function matchPaymentText(text: string): FreqEntry {
  const t = (text ?? '').trim()
  if (!t) return DEFAULT_FREQ
  // exact match first (fastest)
  if (PAYMENT_FREQ_MAP[t]) return PAYMENT_FREQ_MAP[t]
  // substring match in priority order (specific → generic)
  for (const [keyword, freq] of FREQ_KEYWORD_ORDER) {
    if (t.includes(keyword)) return freq
  }
  return DEFAULT_FREQ
}

/** rateIntervalMonths → FreqEntry */
function monthsToFreq(months: number): FreqEntry | null {
  if (months === 1)  return PAYMENT_FREQ_MAP['รายเดือน']
  if (months === 3)  return PAYMENT_FREQ_MAP['รายไตรมาส']
  if (months === 6)  return PAYMENT_FREQ_MAP['ครึ่งปี']
  if (months === 12) return PAYMENT_FREQ_MAP['รายปี']
  return null
}

export type PaymentFreq = {
  type: InvoiceData['freqType']
  months: number
  label: string
}

/**
 * Resolve payment frequency.  Priority order:
 *  1. payFreq enum (v2 structured field)
 *  2. rateIntervalMonths (numeric months, v2 field)
 *  3. payment text keyword match (substring, handles legacy descriptive strings)
 */
export function getPaymentFreq(
  arg:
    | string
    | undefined
    | {
        payFreq?: string
        rateIntervalMonths?: number | string | null
        payment?: string
        durMonths?: unknown
        dur?: unknown
      },
): PaymentFreq {
  // string overload — legacy callers passing payment string directly
  if (typeof arg === 'string' || arg == null) {
    return matchPaymentText(arg ?? '')
  }

  // 1. payFreq enum (preferred, set by v2 contract form)
  const pf = (arg.payFreq ?? '').trim().toLowerCase()
  if (pf === 'monthly')                      return PAYMENT_FREQ_MAP['รายเดือน']
  if (pf === 'quarterly')                    return PAYMENT_FREQ_MAP['รายไตรมาส']
  if (pf === 'semiannual' || pf === 'semi')  return PAYMENT_FREQ_MAP['ครึ่งปี']
  if (pf === 'annual'     || pf === 'yearly')return PAYMENT_FREQ_MAP['รายปี']
  if (pf === 'lump') {
    const dm = Number(arg.durMonths) || Number(arg.dur) || 12
    return { type: 'lump', months: dm, label: 'ค่าเช่า (ชำระครั้งเดียว)' }
  }

  // 2. rateIntervalMonths (set explicitly on the contract)
  const rim = Number(arg.rateIntervalMonths)
  if (rim > 0) {
    const fromRim = monthsToFreq(rim)
    if (fromRim) return fromRim
  }

  // 3. payment text — substring match (handles v1 + v2 descriptive strings)
  return matchPaymentText(arg.payment ?? '')
}

/**
 * Detect the "unit" (in months) that a rate string's number represents.
 *   "เดือนละ X"   → 1   (monthly rate)
 *   "ปีละ X"      → 12  (annual rate)
 *   "ไตรมาสละ X" → 3   (quarterly rate)
 *   "ครึ่งปีละ X" → 6   (semi-annual rate)
 *   default        → 1
 */
function detectRateUnitMonths(rateStr: string): number {
  const t = (rateStr ?? '').toLowerCase()
  if (t.includes('ปีละ') || t.includes('รายปี') || t.includes('ต่อปี') || t.includes('ทุกปี')) return 12
  if (t.includes('ครึ่งปีละ') || t.includes('ราย 6 เดือน') || t.includes('ทุก 6 เดือน')) return 6
  if (t.includes('ไตรมาสละ') || t.includes('รายไตรมาส') || t.includes('ทุก 3 เดือน')) return 3
  return 1
}

/**
 * Invoice base amount — universal formula:
 *   billing_amount = r × (billing_period_months / rate_unit_months)
 *
 * Examples:
 *   "เดือนละ 3,000" · quarterly  → 3,000 × (3/1) = 9,000  ✓
 *   "ปีละ 201,000"  · annual     → 201,000 × (12/12) = 201,000  ✓
 *   "เดือนละ 1,000" · annual     → 1,000 × (12/1) = 12,000  ✓
 *   "เดือนละ 25,000"· monthly   → 25,000 × (1/1) = 25,000  ✓
 *
 * Accepts rate as string (preferred — carries unit info) or number fallback.
 */
export function getInvoiceAmount(
  rate: number | string | undefined,
  arg:
    | string
    | undefined
    | { payFreq?: string; rateIntervalMonths?: number | string | null; payment?: string; durMonths?: unknown; dur?: unknown },
): number {
  const freq = getPaymentFreq(arg)

  // ── lump contracts: ชำระครั้งเดียวเต็มยอด ────────────────────────────────
  // rate string บน lump เป็นคำอธิบาย เช่น "3 ปี=234,000 บาท" หรือ "1,320,000 บาท"
  // ไม่ควร parse ผ่านสูตร (จะผิดเพราะมีตัวเลขหลายตัวในสตริง)
  // ใช้ rateAmount (total lump sum) โดยตรง
  if (freq.type === 'lump') {
    if (typeof rate === 'number') return rate > 0 ? rate : 0
    // rate string: extract LAST comma-formatted number (= total amount)
    const matches = String(rate ?? '').match(/[\d,]+(?:\.\d+)?/g) ?? []
    const lastNum = matches
      .map((s) => parseFloat(s.replace(/,/g, '')))
      .filter((n) => !Number.isNaN(n) && n > 0)
      .pop() ?? 0
    return lastNum
  }

  // ── all other frequencies: r × (billing_months / rate_unit_months) ──────
  const billingMonths = freq.months ?? 1

  if (typeof rate === 'string' && rate.trim()) {
    const rateStr = rate.trim()
    const r = parseAmtLoose(rateStr) || 0
    if (!r) return 0
    const rateUnit = detectRateUnitMonths(rateStr)
    return r * (billingMonths / rateUnit)
  }

  // Numeric fallback (rateAmount only, no rate string)
  if (typeof rate === 'number') return rate > 0 ? rate : 0

  return 0
}

/**
 * Is the contract due for an invoice in this month?
 *
 * Mirror v1 isInvoiceDue() simplification:
 *   - month within contract start..end (inclusive)
 *   - frequency cycle aligns with start month
 *   - not cancelled
 */
export function isContractDueForMonth(
  contractData: {
    start?: string
    end?: string
    payment?: string
    payFreq?: string
    rateIntervalMonths?: number | string | null
    durMonths?: unknown
    dur?: unknown
    cancelled?: boolean
  } | undefined,
  month: string,
): boolean {
  if (!contractData) return false
  if (contractData.cancelled) return false
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return false
  const start = parseBE(contractData.start ?? '')
  const end = parseBE(contractData.end ?? '')
  if (!start || !end) return false
  const [y, mo] = month.split('-').map((s) => Number.parseInt(s, 10))
  const monthStart = new Date(y, mo - 1, 1)
  const monthEnd = new Date(y, mo, 0, 23, 59, 59)
  if (monthEnd.getTime() < start.toDate().getTime()) return false
  if (monthStart.getTime() > end.toDate().getTime()) return false
  const freq = getPaymentFreq(contractData)
  if (!freq.months || freq.months === 1) return true
  const startD = start.toDate()
  const diffMonths =
    (y - startD.getFullYear()) * 12 + (mo - 1 - startD.getMonth())
  if (diffMonths < 0) return false
  return diffMonths % freq.months === 0
}
