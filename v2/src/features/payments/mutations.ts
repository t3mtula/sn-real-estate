import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { logActivity } from '@/lib/audit-log'
import { supabase } from '@/lib/supabase'
import { amt } from '@/lib/thai'
import type { PaymentFormValues } from './schema'
import type { Payment, PaymentAllocation, PaymentStatus } from './types'

const TABLE = 'payments'
const INVOICES_TABLE = 'invoices'

/** Next receipt number: "REC-YYYYMMDD-NNN" */
async function nextReceiptNo(): Promise<string> {
  const prefix = `REC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
  const { data } = await supabase
    .from(TABLE)
    .select('data')
    .like("data->>'receiptNo'", `${prefix}%`)
    .order('created_at', { ascending: false })
    .limit(1)
  const last = (data?.[0] as { data: { receiptNo?: string } } | undefined)?.data?.receiptNo ?? ''
  const seq = last ? (parseInt(last.split('-').pop() ?? '0', 10) + 1) : 1
  return `${prefix}-${String(seq).padStart(3, '0')}`
}

/** Create a payment and update allocated invoices' paid_amount + status */
export function useCreatePayment() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (values: PaymentFormValues): Promise<Payment> => {
      const receiptNo = values.receiptNo || (await nextReceiptNo())

      // Build allocations — fetch invoices ONCE, reuse same data for update (no race)
      const allocations: PaymentAllocation[] = []
      // ivSnapshot: id → fresh data used for both allocation and update
      const ivSnapshot: Map<string, Record<string, unknown>> = new Map()

      if (values.invoice_ids.length > 0) {
        const { data: ivRows, error: ivErr } = await supabase
          .from(INVOICES_TABLE)
          .select('id, data')
          .in('id', values.invoice_ids)
        if (ivErr) throw ivErr

        // Greedy allocation: fill each invoice fully before moving to the next
        let remaining = values.amount
        for (const iv of ivRows ?? []) {
          const ivData = iv.data as Record<string, unknown>
          ivSnapshot.set(iv.id, ivData)
          if (remaining <= 0) break
          const total = Number(ivData?.total ?? 0)
          const alreadyPaid = Number(ivData?.paid_amount ?? 0)
          const outstanding = Math.max(0, total - alreadyPaid)
          const allocAmt = Math.min(remaining, outstanding)
          if (allocAmt <= 0) continue
          allocations.push({ invoice_id: iv.id, amount: allocAmt })
          remaining -= allocAmt
        }

        // remaining > 0.01 = leftover money after filling all selected invoices (overpay / no invoices)
        const status: PaymentStatus =
          allocations.length === 0 ? 'unallocated'
          : remaining > 0.01 ? 'unallocated'
          : remaining <= 0 ? 'matched'
          : 'partial'

        const paymentData = {
          date: values.date,
          amount: values.amount,
          bank_account_id: values.bank_account_id || undefined,
          contract_id: values.contract_id || undefined,
          payMethod: values.payMethod,
          payerName: values.payerName || undefined,
          slipRef: undefined,
          slipImageUrl: undefined,
          receiptNo,
          notes: values.notes || undefined,
          status,
          allocations,
        }

        const { data, error } = await supabase
          .from(TABLE)
          .insert({ data: paymentData })
          .select('id, data, created_at, updated_at')
          .single()
        if (error) throw error
        const payment = data as Payment

        // Update each allocated invoice — reuse ivSnapshot (no second fetch, no race)
        for (const alloc of allocations) {
          const ivData = ivSnapshot.get(alloc.invoice_id)
          if (!ivData) continue
          const total = Number(ivData?.total ?? 0)
          const prevPaid = Number(ivData?.paid_amount ?? 0)
          const newPaid = prevPaid + alloc.amount
          const newRemaining = Math.max(0, total - newPaid)
          const newStatus = newRemaining <= 0.01 ? 'paid' : 'partial'

          const { error: updateErr } = await supabase
            .from(INVOICES_TABLE)
            .update({
              data: {
                ...ivData,
                paid_amount: newPaid,
                remaining_amount: newRemaining,
                status: newStatus,
                last_payment_id: payment.id,
                last_payment_date: values.date,
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', alloc.invoice_id)
          if (updateErr) throw updateErr
        }

        await logActivity({
          action: 'create',
          entity: 'payment',
          entity_id: payment.id,
          description: `รับเงิน ${amt(values.amount, { decimal: 0 })} บาท (${receiptNo}) จาก ${values.payerName || 'ไม่ระบุ'}`,
        })

        return payment
      }

      // No invoices selected — unallocated payment
      const paymentData = {
        date: values.date,
        amount: values.amount,
        bank_account_id: values.bank_account_id || undefined,
        contract_id: values.contract_id || undefined,
        payMethod: values.payMethod,
        payerName: values.payerName || undefined,
        slipRef: undefined,
        slipImageUrl: undefined,
        receiptNo,
        notes: values.notes || undefined,
        status: 'unallocated' as PaymentStatus,
        allocations: [],
      }

      const { data, error } = await supabase
        .from(TABLE)
        .insert({ data: paymentData })
        .select('id, data, created_at, updated_at')
        .single()
      if (error) throw error

      await logActivity({
        action: 'create',
        entity: 'payment',
        entity_id: (data as Payment).id,
        description: `รับเงิน ${amt(values.amount, { decimal: 0 })} บาท (${receiptNo}) จาก ${values.payerName || 'ไม่ระบุ'} — ยังไม่จับคู่`,
      })

      return data as Payment
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TABLE] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('บันทึกรับเงินแล้ว')
    },
    onError: (err) => {
      toast.error('บันทึกไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
    },
  })
}

// ─── batch import (from PDF statement) ──────────────────────────────────────

export interface BatchPaymentRow {
  date: string
  amount: number
  bank_account_id?: string
  payerName?: string
  payMethod?: 'transfer' | 'cash' | 'check' | 'promptpay'
  notes?: string
  status: PaymentStatus
}

/** Insert multiple unallocated payments in one go (used by PDF import) */
export function useBatchSavePayments() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rows: BatchPaymentRow[]): Promise<void> => {
      if (rows.length === 0) return
      const prefix = `IMP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
      const records = rows.map((r, i) => ({
        data: {
          date: r.date,
          amount: r.amount,
          bank_account_id: r.bank_account_id ?? undefined,
          payerName: r.payerName ?? undefined,
          payMethod: r.payMethod ?? 'transfer',
          notes: r.notes ?? undefined,
          receiptNo: `${prefix}-${String(i + 1).padStart(3, '0')}`,
          status: r.status,
          allocations: [],
        },
      }))
      const { error } = await supabase.from(TABLE).insert(records)
      if (error) throw error
      void logActivity({
        action: 'create',
        entity: 'payment',
        description: `นำเข้า batch ${rows.length} รายการ (prefix ${prefix})`,
      })
    },
    onSuccess: (_, rows) => {
      qc.invalidateQueries({ queryKey: [TABLE] })
      toast.success(`นำเข้าแล้ว ${rows.length} รายการ`)
    },
    onError: (err) => {
      toast.error('นำเข้าไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
    },
  })
}

/** Delete a payment (and reverse invoice paid_amount).
 *  Order: delete payment record FIRST, then reverse allocations.
 *  Reason: if reversal fails mid-way, the payment is already gone so
 *  retry won't double-reverse. Partial reversal is visible via invoice
 *  mismatch rather than a phantom payment that can't be deleted. */
export function useDeletePayment() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payment: Payment) => {
      // 1. Delete payment record first
      const { error: deleteErr } = await supabase
        .from(TABLE)
        .delete()
        .eq('id', payment.id)
      if (deleteErr) throw deleteErr

      // 2. Reverse allocations — fetch each invoice fresh then patch
      for (const alloc of payment.data.allocations ?? []) {
        const { data: ivRow, error: fetchErr } = await supabase
          .from(INVOICES_TABLE)
          .select('id, data')
          .eq('id', alloc.invoice_id)
          .maybeSingle()
        if (fetchErr) throw fetchErr
        if (!ivRow) continue

        const ivData = ivRow.data as Record<string, unknown>
        const total = Number(ivData?.total ?? 0)
        const prevPaid = Number(ivData?.paid_amount ?? 0)
        const newPaid = Math.max(0, prevPaid - alloc.amount)
        const newRemaining = Math.max(0, total - newPaid)
        const prevStatus = String(ivData?.status ?? '')
        const newStatus =
          prevStatus === 'paid' || prevStatus === 'partial'
            ? newPaid <= 0 ? 'sent' : 'partial'
            : prevStatus

        const { error: updateErr } = await supabase
          .from(INVOICES_TABLE)
          .update({
            data: {
              ...ivData,
              paid_amount: newPaid,
              remaining_amount: newRemaining,
              status: newStatus,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', alloc.invoice_id)
        if (updateErr) throw updateErr
      }

      await logActivity({
        action: 'delete',
        entity: 'payment',
        entity_id: payment.id,
        description: `ลบรายการรับเงิน ${payment.data.receiptNo ?? payment.id}`,
      })
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TABLE] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('ลบรายการรับเงินแล้ว')
    },
    onError: (err) => {
      toast.error('ลบไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
    },
  })
}
