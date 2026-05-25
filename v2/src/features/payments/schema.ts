import { z } from 'zod'
import { parseBE } from '@/lib/thai'

const beDateStr = z
  .string()
  .trim()
  .refine((s) => !s || !!parseBE(s), { message: 'รูปแบบวันที่ไม่ถูกต้อง (dd/mm/yyyy พ.ศ.)' })

export const paymentFormSchema = z.object({
  date: beDateStr.refine((s) => s.length > 0, { message: 'กรอกวันที่รับเงิน' }),
  amount: z.number().positive('ยอดรับต้องมากกว่า 0'),
  bank_account_id: z.string().trim().max(100),
  contract_id: z.string().trim().max(100),
  payMethod: z.enum(['transfer', 'cash', 'check', 'promptpay']),
  payerName: z.string().trim().max(200),
  receiptNo: z.string().trim().max(100),
  notes: z.string().trim().max(500),
  /** invoice IDs to allocate this payment to (full amount split evenly if multiple) */
  invoice_ids: z.array(z.string()),
})

export type PaymentFormValues = z.infer<typeof paymentFormSchema>

export const PAYMENT_FORM_DEFAULTS: PaymentFormValues = {
  date: '',
  amount: 0,
  bank_account_id: '',
  contract_id: '',
  payMethod: 'transfer',
  payerName: '',
  receiptNo: '',
  notes: '',
  invoice_ids: [],
}

export const PAY_METHOD_LABELS: Record<string, string> = {
  transfer: 'โอนเงิน',
  cash: 'เงินสด',
  check: 'เช็ค',
  promptpay: 'พร้อมเพย์',
}
