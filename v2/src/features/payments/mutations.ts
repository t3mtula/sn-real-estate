import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { logActivity } from '@/lib/audit-log'
import { supabase } from '@/lib/supabase'
import { fmtBE, parseBE, amt } from '@/lib/thai'
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
      const paidDate = parseBE(values.date)
      if (!paidDate) throw new Error('วันที่ไม่ถูกต้อง')

      // Build allocations — split evenly across selected invoices
      const allocations: PaymentAllocation[] = []
      let remaining = values.amount

      if (values.invoice_ids.length > 0) {
        // Fetch invoices to compute how much each needs
        const { data: ivRows, error: ivErr } = await supabase
          .from(INVOICES_TABLE)
          .select('id, data')
          .in('id', values.invoice_ids)
        if (ivErr) throw ivErr

        for (const iv of ivRows ?? []) {
          if (remaining <= 0) break
          const ivData = iv.data as Record<string, unknown>
          const total = Number(ivData?.total ?? 0)
          const alreadyPaid = Number(ivData?.paid_amount ?? 0)
          const outstanding = Math.max(0, total - alreadyPaid)
          const allocAmt = Math.min(remaining, outstanding)
          if (allocAmt <= 0) continue
          allocations.push({ invoice_id: iv.id, amount: allocAmt })
          remaining -= allocAmt
        }
      }

      const status: PaymentStatus =
        allocations.length === 0 ? 'unallocated'
        : remaining > 0.01 ? 'unallocated'   // paid more than allocated
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

      // Update each allocated invoice's paid_amount + status
      for (const alloc of allocations) {
        const { data: ivRows } = await supabase
          .from(INVOICES_TABLE)
          .select('id, data')
          .eq('id', alloc.invoice_id)
          .maybeSingle()
        if (!ivRows) continue
        const ivData = ivRows.data as Record<string, unknown>
        const total = Number(ivData?.total ?? 0)
        const prevPaid = Number(ivData?.paid_amount ?? 0)
        const newPaid = prevPaid + alloc.amount
        const newRemaining = Math.max(0, total - newPaid)
        const newStatus = newRemaining <= 0.01 ? 'paid' : 'partial'

        await supabase
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
      }

      await logActivity({
        action: 'create',
        entity: 'payment',
        entityId: payment.id,
        detail: `รับเงิน ${amt(values.amount, { decimal: 0 })} บาท (${receiptNo}) จาก ${values.payerName || 'ไม่ระบุ'}`,
      })

      return payment
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

/** Delete a payment (and reverse invoice paid_amount) */
export function useDeletePayment() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payment: Payment) => {
      // Reverse allocations
      for (const alloc of payment.data.allocations ?? []) {
        const { data: ivRows } = await supabase
          .from(INVOICES_TABLE)
          .select('id, data')
          .eq('id', alloc.invoice_id)
          .maybeSingle()
        if (!ivRows) continue
        const ivData = ivRows.data as Record<string, unknown>
        const total = Number(ivData?.total ?? 0)
        const prevPaid = Number(ivData?.paid_amount ?? 0)
        const newPaid = Math.max(0, prevPaid - alloc.amount)
        const newRemaining = Math.max(0, total - newPaid)
        const prevStatus = String(ivData?.status ?? '')
        const newStatus =
          prevStatus === 'paid' || prevStatus === 'partial'
            ? newPaid <= 0 ? 'sent' : 'partial'
            : prevStatus

        await supabase
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
      }

      const { error } = await supabase
        .from(TABLE)
        .delete()
        .eq('id', payment.id)
      if (error) throw error

      await logActivity({
        action: 'delete',
        entity: 'payment',
        entityId: payment.id,
        detail: `ลบรายการรับเงิน ${payment.data.receiptNo ?? payment.id}`,
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
