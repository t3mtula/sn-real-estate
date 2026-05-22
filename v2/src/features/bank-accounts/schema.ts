import { z } from 'zod'

/**
 * Bank Account form schema
 * - bank + acctNo อย่างน้อยต้องมี 1 (ใน superRefine)
 * - accountName ว่างได้ (default = ชื่อเจ้าของ)
 * - ownerLandlordId optional (ระบุภายหลังได้ · บัญชี anonymous เป็นไปได้)
 */
export const bankAccountFormSchema = z
  .object({
    bank: z.string().trim().min(1, 'ระบุชื่อธนาคาร').max(200),
    acctNo: z.string().trim().min(1, 'ระบุเลขบัญชี').max(50),
    accountName: z.string().trim().max(200),
    label: z.string().trim().max(50),
    ownerLandlordId: z.string().trim().max(50),
    active: z.boolean(),
    notes: z.string().trim().max(1000),
  })

export type BankAccountFormValues = z.infer<typeof bankAccountFormSchema>

export const BANK_ACCOUNT_FORM_DEFAULTS: BankAccountFormValues = {
  bank: '',
  acctNo: '',
  accountName: '',
  label: '',
  ownerLandlordId: '',
  active: true,
  notes: '',
}
