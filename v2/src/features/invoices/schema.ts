import { z } from 'zod'

/**
 * Generate-invoice form schema
 *
 * v1 reference: confirmGenerateAllInvoices / generateInvoice in modules/19-invoices.js
 *
 * Required:
 *   contract_id — pick the contract
 *   month "YYYY-MM" (Gregorian) — month bucket
 *
 * Optional (auto-fill from contract):
 *   bankAccountId — override bank to receive
 *   amount — override base amount (rate × cycle by default)
 *   dueDay — day of month invoice is due (1-31 · default 5)
 *   category — rent or deposit
 *   note — extra description
 */
export const generateInvoiceFormSchema = z.object({
  contract_id: z.string().min(1, 'เลือกสัญญา'),
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'รูปแบบเดือนไม่ถูกต้อง (YYYY-MM)'),
  bankAccountId: z.string().trim().max(50).optional().default(''),
  amount: z.number().min(0, 'ยอดต้องไม่ติดลบ').optional(),
  dueDay: z
    .number()
    .int('วันครบกำหนดต้องเป็นจำนวนเต็ม')
    .min(1, 'อย่างน้อยวันที่ 1')
    .max(31, 'ไม่เกินวันที่ 31')
    .optional()
    .default(5),
  category: z.enum(['rent', 'deposit']).default('rent'),
  note: z.string().trim().max(500).optional().default(''),
})

export type GenerateInvoiceFormValues = z.input<typeof generateInvoiceFormSchema>

export const GENERATE_INVOICE_DEFAULTS: GenerateInvoiceFormValues = {
  contract_id: '',
  month: '',
  bankAccountId: '',
  dueDay: 5,
  category: 'rent',
  note: '',
}
