/**
 * Payment core — single source of truth สำหรับ "รับเงิน" ทั้งระบบ
 *
 * กฎ (กัน split-brain ถาวร):
 *   - เงินทุกก้อนเก็บใน `payments` table ที่เดียว (พร้อม allocations[] → invoices)
 *   - ยอดจ่าย/คงเหลือ/สถานะของ invoice = "กระจก" (mirror) ที่ recompute จาก payments
 *     ทั้งหมดเสมอ (ไม่ใช่บวก/ลบทีละครั้ง) → ลบ/แก้ payment แล้วยอดตรงเองทุกครั้ง
 *   - ชื่อ field บน invoice ใช้ camelCase ชุดเดียว: paidAmount / remainingAmount / status
 *     (เลิกใช้ snake_case paid_amount และเลิกฝัง payments[] ใน invoice)
 *
 * ทุก entry point (ปุ่มรับเงินในใบแจ้งหนี้ · /payments · OCR import) เรียกผ่านที่นี่
 */
import { logActivity } from '@/lib/audit-log'
import { supabase } from '@/lib/supabase'
import type { Payment, PaymentAllocation, PaymentStatus } from './types'

const PAY = 'payments'
const INV = 'invoices'

// ── Counter allocation (Postgres RPC · atomic per period) ────────────────────
//   allocate_receipt_nos(invoice_month text, count int) → text[]   REC-YYYY-MM-NNNN
//   allocate_tax_invoice_nos(issue_date date, count int) → text[]  TIV-YYMM-NNNN

export async function allocateReceiptNos(month: string, count: number): Promise<string[]> {
  const { data, error } = await supabase.rpc('allocate_receipt_nos', { invoice_month: month, count })
  if (error) throw new Error(`allocate_receipt_nos: ${error.message}`)
  return data as string[]
}

export async function allocateTaxInvoiceNos(count: number): Promise<string[]> {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase.rpc('allocate_tax_invoice_nos', { issue_date: today, count })
  if (error) throw new Error(`allocate_tax_invoice_nos: ${error.message}`)
  return data as string[]
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** payments ทุกแถวที่ allocate ให้ invoice นี้ (jsonb contains) */
async function fetchPaymentsForInvoice(invoiceId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from(PAY)
    .select('id, data, created_at, updated_at')
    .filter('data->allocations', 'cs', JSON.stringify([{ invoice_id: invoiceId }]))
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Payment[]
}

/** ยอดที่ allocate ให้ invoice นี้ จาก payment แถวเดียว */
export function allocatedToInvoice(payment: Payment, invoiceId: string): number {
  return (payment.data.allocations ?? [])
    .filter((a) => a.invoice_id === invoiceId)
    .reduce((s, a) => s + (Number(a.amount) || 0), 0)
}

/**
 * Recompute "กระจกเงิน" ของ invoice จาก payments ทั้งหมดที่จับคู่ไว้
 * — paidAmount / remainingAmount / status (data + column) · allocate receiptNo/taxInvoiceNo เมื่อถึงเงื่อนไข
 * ไม่แตะ invoice ที่ voided
 */
export async function recomputeInvoiceMirror(invoiceId: string): Promise<void> {
  const { data: ivRow, error } = await supabase
    .from(INV)
    .select('data, status')
    .eq('id', invoiceId)
    .maybeSingle()
  if (error) throw error
  if (!ivRow) return

  const d = { ...(ivRow.data as Record<string, unknown>) }
  const prevStatus = String(d.status ?? ivRow.status ?? 'sent')
  if (prevStatus === 'voided') return // ไม่ปลุก invoice ที่ยกเลิกแล้ว

  const total = Number(d.total ?? 0)
  const pays = await fetchPaymentsForInvoice(invoiceId)
  const paid = pays.reduce((s, p) => s + allocatedToInvoice(p, invoiceId), 0)
  const remaining = Math.max(0, total - paid)

  let status: string
  if (paid <= 0.01) status = prevStatus === 'paid' || prevStatus === 'partial' ? 'sent' : prevStatus
  else if (remaining <= 0.01) status = 'paid'
  else status = 'partial'

  // receiptNo: ออกครั้งเดียวเมื่อเริ่มมีการชำระ (paid/partial) · format REC-YYYY-MM-NNNN
  let receiptNo = d.receiptNo as string | undefined
  if (!receiptNo && (status === 'paid' || status === 'partial')) {
    const month = (d.month as string) ?? new Date().toISOString().slice(0, 7)
    ;[receiptNo] = await allocateReceiptNos(month, 1)
  }

  // taxInvoiceNo: ออกเมื่อจ่ายครบ + เป็นใบ VAT
  let taxInvoiceNo = d.taxInvoiceNo as string | undefined
  let taxInvoiceIssuedAt = d.taxInvoiceIssuedAt as string | undefined
  const isVat = d.vatMode && d.vatMode !== 'none'
  if (isVat && status === 'paid' && !taxInvoiceNo) {
    ;[taxInvoiceNo] = await allocateTaxInvoiceNos(1)
    taxInvoiceIssuedAt = new Date().toISOString()
  }

  // paidAt = วันที่ของ payment ล่าสุด (เมื่อจ่ายครบ)
  const latest = pays.length ? pays[pays.length - 1] : undefined
  const paidAt = status === 'paid' ? (latest?.data.date ?? (d.paidAt as string | undefined)) : (d.paidAt as string | undefined)

  const merged: Record<string, unknown> = {
    ...d,
    paidAmount: paid,
    remainingAmount: remaining,
    status,
    ...(receiptNo ? { receiptNo } : {}),
    ...(taxInvoiceNo ? { taxInvoiceNo, taxInvoiceIssuedAt } : {}),
    ...(paidAt ? { paidAt } : {}),
  }
  // ลบ field ตกค้างจากระบบเก่า (กันอ่านชนกัน)
  delete merged.paid_amount
  delete merged.remaining_amount
  delete merged.last_payment_id
  delete merged.last_payment_date

  const { error: upErr } = await supabase
    .from(INV)
    .update({ data: merged, status, updated_at: new Date().toISOString() })
    .eq('id', invoiceId)
  if (upErr) throw upErr
}

// ── record / delete (the only writers) ───────────────────────────────────────

export interface RecordPaymentInput {
  date: string
  amount: number
  bank_account_id?: string
  contract_id?: string
  payMethod: string
  payerName?: string
  notes?: string
  slipRef?: string
  slipImageUrl?: string
  /** invoices ที่จะ allocate ให้ (เรียงตามลำดับความสำคัญ · greedy เต็มทีละใบ) */
  invoice_ids: string[]
  receiptNo?: string
}

/**
 * บันทึกเงิน 1 ก้อน → payments table + recompute invoice ที่เกี่ยวข้องทุกใบ
 * greedy: เติมแต่ละ invoice ให้เต็มก่อนไปใบถัดไป
 */
export async function recordPaymentCore(input: RecordPaymentInput): Promise<Payment> {
  const allocations: PaymentAllocation[] = []
  let derivedContractId: string | undefined

  if (input.invoice_ids.length > 0) {
    const { data: ivRows, error: ivErr } = await supabase
      .from(INV)
      .select('id, data, contract_id')
      .in('id', input.invoice_ids)
    if (ivErr) throw ivErr
    const byId = new Map(
      (ivRows ?? []).map((r) => [r.id as string, { data: r.data as Record<string, unknown>, contract_id: r.contract_id as string | null }]),
    )

    let remaining = input.amount
    for (const ivId of input.invoice_ids) {
      if (remaining <= 0.01) break
      const row = byId.get(ivId)
      if (!row) continue
      const dd = row.data
      const total = Number(dd.total ?? 0)
      const already = Number(dd.paidAmount ?? dd.paid_amount ?? 0)
      const out = Math.max(0, total - already)
      const alloc = Math.min(remaining, out)
      if (alloc <= 0) continue
      allocations.push({ invoice_id: ivId, amount: alloc })
      remaining -= alloc
      // ผูก contract จากใบแรกที่จับคู่ (ช่วย trace slip→สัญญา)
      if (!derivedContractId) derivedContractId = row.contract_id ?? (dd.cid != null ? String(dd.cid) : undefined)
    }
  }

  const leftover = input.amount - allocations.reduce((s, a) => s + a.amount, 0)
  const status: PaymentStatus =
    allocations.length === 0 ? 'unallocated' : leftover > 0.01 ? 'partial' : 'matched'

  const paymentData = {
    date: input.date,
    amount: input.amount,
    bank_account_id: input.bank_account_id || undefined,
    contract_id: input.contract_id || derivedContractId || undefined,
    payMethod: input.payMethod,
    payerName: input.payerName || undefined,
    slipRef: input.slipRef || undefined,
    slipImageUrl: input.slipImageUrl || undefined,
    receiptNo: input.receiptNo || undefined,
    notes: input.notes || undefined,
    status,
    allocations,
  }

  const { data: ins, error: insErr } = await supabase
    .from(PAY)
    .insert({ data: paymentData })
    .select('id, data, created_at, updated_at')
    .single()
  if (insErr) throw insErr
  const payment = ins as Payment

  for (const a of allocations) await recomputeInvoiceMirror(a.invoice_id)

  await logActivity({
    action: 'create',
    entity: 'payment',
    entity_id: payment.id,
    description:
      `รับเงิน ${Math.round(input.amount).toLocaleString('th-TH')} บาท จาก ${input.payerName || 'ไม่ระบุ'}` +
      (allocations.length ? ` · จับคู่ ${allocations.length} ใบ` : ' · ยังไม่จับคู่'),
  })

  return payment
}

/**
 * ปลดการจับคู่ invoice ออกจาก payments ทุกแถว (ใช้ตอนจะลบ invoice)
 * — เงินไม่หาย · payment ที่ไม่เหลือ allocation = กลายเป็น "ยังไม่จับคู่"
 */
export async function unallocateInvoiceFromPayments(invoiceId: string): Promise<void> {
  const pays = await fetchPaymentsForInvoice(invoiceId)
  for (const p of pays) {
    const remaining = (p.data.allocations ?? []).filter((a) => a.invoice_id !== invoiceId)
    const allocated = remaining.reduce((s, a) => s + (Number(a.amount) || 0), 0)
    const status: PaymentStatus =
      remaining.length === 0 ? 'unallocated' : Number(p.data.amount) - allocated > 0.01 ? 'partial' : 'matched'
    const { error } = await supabase
      .from(PAY)
      .update({ data: { ...p.data, allocations: remaining, status }, updated_at: new Date().toISOString() })
      .eq('id', p.id)
    if (error) throw error
  }
}

/** ลบเงิน 1 ก้อน → ลบแถว แล้ว recompute invoice ที่เคยจับคู่ทุกใบ */
export async function deletePaymentCore(payment: Payment): Promise<void> {
  const invoiceIds = [...new Set((payment.data.allocations ?? []).map((a) => a.invoice_id))]

  const { error: delErr } = await supabase.from(PAY).delete().eq('id', payment.id)
  if (delErr) throw delErr

  for (const id of invoiceIds) await recomputeInvoiceMirror(id)

  await logActivity({
    action: 'delete',
    entity: 'payment',
    entity_id: payment.id,
    description: `ลบรายการรับเงิน ${payment.data.receiptNo ?? payment.id}`,
  })
}
