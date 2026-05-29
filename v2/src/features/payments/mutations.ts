import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { logActivity } from '@/lib/audit-log'
import { supabase } from '@/lib/supabase'
import { recordPaymentCore, deletePaymentCore, allocatePaymentToInvoices } from './core'
import type { PaymentFormValues } from './schema'
import type { Payment, PaymentStatus } from './types'

const TABLE = 'payments'

/** Create a payment and update allocated invoices — delegates to the single core writer */
export function useCreatePayment() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (values: PaymentFormValues): Promise<Payment> =>
      recordPaymentCore({
        date: values.date,
        amount: values.amount,
        bank_account_id: values.bank_account_id,
        contract_id: values.contract_id,
        payMethod: values.payMethod,
        payerName: values.payerName,
        notes: values.notes,
        receiptNo: values.receiptNo || undefined,
        invoice_ids: values.invoice_ids,
      }),

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
  time?: string
  amount: number
  bank_account_id?: string
  contract_id?: string
  payerName?: string
  sourceBankCode?: string
  sourceAcctSuffix?: string
  pickedManually?: boolean
  fingerprint?: string
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
      const records = rows.map((r) => ({
        data: {
          date: r.date,
          time: r.time || undefined,
          amount: r.amount,
          bank_account_id: r.bank_account_id ?? undefined,
          contract_id: r.contract_id ?? undefined,
          payerName: r.payerName ?? undefined,
          sourceBankCode: r.sourceBankCode || undefined,
          sourceAcctSuffix: r.sourceAcctSuffix || undefined,
          pickedManually: r.pickedManually || undefined,
          fingerprint: r.fingerprint || undefined,
          payMethod: r.payMethod ?? 'transfer',
          notes: r.notes ?? undefined,
          status: r.status,
          allocations: [],
        },
      }))
      const { error } = await supabase.from(TABLE).insert(records)
      if (error) throw error
      void logActivity({
        action: 'create',
        entity: 'payment',
        description: `นำเข้า statement ${rows.length} รายการ (ยังไม่จับคู่)`,
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

/** Allocate an existing (parked) payment to invoices — greedy, leftover stays as credit */
export function useAllocatePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ payment, invoiceIds }: { payment: Payment; invoiceIds: string[] }) =>
      allocatePaymentToInvoices(payment, invoiceIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TABLE] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('จับคู่เงินกับใบแจ้งหนี้แล้ว')
    },
    onError: (err) => {
      toast.error('จับคู่ไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
    },
  })
}

/** Delete a payment — removes the row then recomputes each previously-allocated invoice */
export function useDeletePayment() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (payment: Payment) => deletePaymentCore(payment),

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
