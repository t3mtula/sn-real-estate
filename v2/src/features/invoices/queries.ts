import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { parseBE } from '@/lib/thai'
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
const PAYMENT_FREQ_MAP: Record<string, { type: InvoiceData['freqType']; months: number; label: string }> = {
  // v2 canonical strings
  'รายเดือน': { type: 'monthly', months: 1, label: 'ค่าเช่ารายเดือน' },
  'รายไตรมาส': { type: 'quarterly', months: 3, label: 'ค่าเช่ารายไตรมาส' },
  'ทุก 3 เดือน': { type: 'quarterly', months: 3, label: 'ค่าเช่าทุก 3 เดือน' },
  'ทุก 6 เดือน': { type: 'semi', months: 6, label: 'ค่าเช่าครึ่งปี' },
  'ครึ่งปี': { type: 'semi', months: 6, label: 'ค่าเช่าครึ่งปี' },
  'รายปี': { type: 'yearly', months: 12, label: 'ค่าเช่ารายปี' },
  'ตามสัญญา': { type: 'lump', months: 1, label: 'ค่าเช่า (ชำระครั้งเดียว)' },
  // v1 keyword aliases (legacy contract data backward compat)
  'เดือนละ': { type: 'monthly', months: 1, label: 'ค่าเช่ารายเดือน' },
  'ไตรมาสละ': { type: 'quarterly', months: 3, label: 'ค่าเช่ารายไตรมาส' },
  'ครึ่งปีละ': { type: 'semi', months: 6, label: 'ค่าเช่าครึ่งปี' },
  'ปีละ': { type: 'yearly', months: 12, label: 'ค่าเช่ารายปี' },
  'ทุกปี': { type: 'yearly', months: 12, label: 'ค่าเช่ารายปี' },
}

export type PaymentFreq = {
  type: InvoiceData['freqType']
  months: number
  label: string
}

/**
 * Resolve payment frequency from structured payFreq field (preferred) or
 * fall back to legacy payment-string keyword lookup.
 *
 * Accepts either a contract data object or just the legacy payment string.
 *
 * payFreq enum values: 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'lump' | 'custom'
 * Accepts variants: 'yearly' ↔ 'annual', 'semi' ↔ 'semiannual'.
 */
export function getPaymentFreq(
  arg:
    | string
    | undefined
    | {
        payFreq?: string
        payment?: string
        durMonths?: unknown
        dur?: unknown
      },
): PaymentFreq {
  // string overload — legacy callers passing payment string only
  if (typeof arg === 'string' || arg == null) {
    const key = (arg ?? '').trim()
    return (
      PAYMENT_FREQ_MAP[key] ?? {
        type: 'monthly',
        months: 1,
        label: 'ค่าเช่ารายเดือน',
      }
    )
  }
  // Prefer structured payFreq
  const pf = (arg.payFreq ?? '').trim().toLowerCase()
  if (pf === 'monthly') return { type: 'monthly', months: 1, label: 'ค่าเช่ารายเดือน' }
  if (pf === 'quarterly') return { type: 'quarterly', months: 3, label: 'ค่าเช่ารายไตรมาส' }
  if (pf === 'semiannual' || pf === 'semi') return { type: 'semi', months: 6, label: 'ค่าเช่าครึ่งปี' }
  if (pf === 'annual' || pf === 'yearly') return { type: 'yearly', months: 12, label: 'ค่าเช่ารายปี' }
  if (pf === 'lump') {
    const dm = Number(arg.durMonths) || Number(arg.dur) || 12
    return { type: 'lump', months: dm, label: 'ค่าเช่า (ชำระครั้งเดียว)' }
  }
  // 'custom' or anything else — fall back to legacy payment string
  const key = (arg.payment ?? '').trim()
  return (
    PAYMENT_FREQ_MAP[key] ?? {
      type: 'monthly',
      months: 1,
      label: 'ค่าเช่ารายเดือน',
    }
  )
}

/** Invoice base amount from contract rate × cycle months · v2 numeric.
 *  Accepts either (rate, payment-string) or (rate, contract-data).
 */
export function getInvoiceAmount(
  rate: number | undefined,
  arg:
    | string
    | undefined
    | { payFreq?: string; payment?: string; durMonths?: unknown; dur?: unknown },
): number {
  const r = Number(rate) || 0
  if (!r) return 0
  const freq = getPaymentFreq(arg)
  return r * (freq.months ?? 1)
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
