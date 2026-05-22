/**
 * Invoice type definitions
 *
 * Storage: Supabase `public.invoices` table — shared with v1 (parallel write).
 *   columns: id text · contract_id text · status text · category text · data jsonb · timestamps
 *
 * v1 schema mirror (modules/19-invoices.js generateInvoice):
 *   id (number) · cid · pid · month "YYYY-MM" · invoiceNo · date (BE) · dueDate (BE) ·
 *   items[] · total · headerId · freqType · freqLabel · vatMode · vatRate · vatBase ·
 *   status · paidAmount · remainingAmount · payments[] · tenant · property · createdAt
 *
 * v2 additions (optional):
 *   bankAccountId — เลือกบัญชีรับเงินตอนออกใบแจ้ง (สำหรับ Phase 1B-3d reconciliation)
 *   landlord — snapshot landlord name (v1 มีแต่ headerId)
 *
 * v2 native PK = id (text) · primary key เดียวกับ v1 (id col)
 */

export const INVOICE_STATUSES = [
  { value: 'draft', label: 'ร่าง', tone: 'muted' },
  { value: 'sent', label: 'ออกแล้ว', tone: 'info' },
  { value: 'partial', label: 'จ่ายบางส่วน', tone: 'warning' },
  { value: 'paid', label: 'ชำระแล้ว', tone: 'success' },
  { value: 'voided', label: 'ยกเลิก', tone: 'destructive' },
  { value: 'unknown', label: 'ไม่ระบุ', tone: 'muted' },
] as const

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]['value']

export const INVOICE_CATEGORIES = [
  { value: 'rent', label: 'ค่าเช่า' },
  { value: 'deposit', label: 'เงินประกัน' },
] as const

export type InvoiceCategory = (typeof INVOICE_CATEGORIES)[number]['value']

/** Line item ในใบแจ้งหนี้ */
export type InvoiceItem = {
  desc: string
  amount: number
}

/** Inline payment record (v1 legacy · embedded ใน invoice.data.payments) */
export type InvoicePayment = {
  date?: string
  amount?: number
  method?: string
  ref?: string
  note?: string
  [key: string]: unknown
}

/** Invoice data (stored in `invoices.data` JSONB) */
export type InvoiceData = {
  /** Primary key inside JSON · v1 numeric · v2 epoch ms */
  id?: number | string
  /** Contract id (FK to contracts.data.pid · v1 cid · ใช้ text col contract_id ใน Supabase) */
  cid?: number | string
  /** Property pid (snapshot จาก contract.pid_property) */
  pid?: number
  /** Month bucket "YYYY-MM" (Gregorian) */
  month?: string
  /** Invoice number e.g. "INV-2026-05-0001" หรือ "DEP-..." */
  invoiceNo?: string
  /** Issue date (BE string "DD/MM/YYYY") */
  date?: string
  /** Due date (BE string) */
  dueDate?: string
  /** Line items */
  items?: InvoiceItem[]
  /** Total (sum of items · post-VAT for inclusive/exclusive) */
  total?: number
  /** Legacy v1: invoice_headers FK */
  headerId?: number | string
  /** v2: bank account FK (เลือกบัญชีรับเงิน) */
  bankAccountId?: string
  /** Frequency snapshot */
  freqType?: 'monthly' | 'quarterly' | 'semi' | 'yearly' | 'lump'
  freqLabel?: string
  /** VAT snapshot (locked at creation) */
  vatMode?: 'none' | 'inclusive' | 'exclusive'
  vatRate?: number
  vatBase?: number
  /** Status (mirror top-level status col) */
  status?: InvoiceStatus | string
  /** Money tracking */
  paidAmount?: number
  remainingAmount?: number
  /** Embedded payments (v1 legacy · 3d-2 จะย้ายไป payments table) */
  payments?: InvoicePayment[]
  /** Snapshot strings (denormalized for list rendering) */
  tenant?: string
  property?: string
  landlord?: string
  /** Category (mirror top-level category col) */
  category?: InvoiceCategory | string
  /** Timestamps in data (legacy v1 — Supabase has its own created_at/updated_at) */
  createdAt?: string
  updatedAt?: string
  /** v1 legacy other fields preserved intact */
  [key: string]: unknown
}

/** Invoice row จาก Supabase */
export type Invoice = {
  id: string
  contract_id: string | null
  status: string | null
  category: string | null
  data: InvoiceData
  created_at: string | null
  updated_at: string | null
}
