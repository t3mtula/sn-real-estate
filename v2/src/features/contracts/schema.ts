import { z } from 'zod'
import { parseBE } from '@/lib/thai'

const beDateStr = (msg = 'รูปแบบวันที่ไม่ถูกต้อง (ใช้ dd/mm/yyyy พ.ศ.)') =>
  z
    .string()
    .trim()
    .refine((s) => !s || !!parseBE(s), { message: msg })

/**
 * Contract form schema
 *
 * Mirror v1 validation (modules/15-contract-form.js):
 * - เลขสัญญา required + ไม่ใช่ '-/--/N/A/dashes' + unique (check ใน mutations)
 * - ค่าเช่า > 0
 * - วันเริ่ม + วันสิ้นสุด valid BE format · end > start
 * - มัดจำ ≥ 0 (optional)
 * - ระยะ months ≥ 0 (optional · auto-calc ถ้าว่าง)
 *
 * v2 native: pid_property + tenant_id + landlord_id + bankAccountId +
 *   parent_contract_id (FK · เลือกผ่าน Select)
 */
export const contractFormSchema = z
  .object({
    /** เลขสัญญา (e.g. "SN.005-2569") */
    no: z
      .string()
      .trim()
      .min(1, 'กรอกเลขสัญญา')
      .max(50)
      .refine((s) => !/^[-–—_.]+$/.test(s), {
        message: 'เลขสัญญาไม่ถูกต้อง',
      }),

    /** ทรัพย์สิน (link via property.data.pid) */
    pid_property: z.string().min(1, 'เลือกทรัพย์สิน'),

    /** ผู้เช่า (FK) */
    tenant_id: z.string().min(1, 'เลือกผู้เช่า'),

    /** ผู้ให้เช่า (FK · ไม่จำเป็นต้องเป็นเจ้าของจริง · sublease ได้) */
    landlord_id: z.string().min(1, 'เลือกผู้ให้เช่า'),

    /** บัญชีรับเงิน (FK · optional) */
    bankAccountId: z.string().trim().max(50),

    /** Sublease — สัญญาแม่ (optional) */
    parent_contract_id: z.string().trim().max(50),

    /** Dates (BE) */
    start: beDateStr().refine((s) => s.length > 0, { message: 'กรอกวันเริ่มต้น' }),
    end: beDateStr().refine((s) => s.length > 0, { message: 'กรอกวันสิ้นสุด' }),

    /** Money */
    rate: z.number().positive('ค่าเช่าต้องมากกว่า 0'),
    deposit: z.number().min(0, 'มัดจำต้องไม่ติดลบ'),
    /** ระยะสัญญา (เดือน) · optional auto-calc */
    dur: z.number().min(0, 'ระยะต้องไม่ติดลบ').max(600),
    /** Payment frequency description (e.g. "รายเดือน", "ทุก 3 เดือน") */
    payment: z.string().trim().max(200),

    /** วัตถุประสงค์ (e.g. "พักอาศัย", "ค้าขาย") */
    purpose: z.string().trim().max(200),

    /** การลงนาม */
    madeAt: z.string().trim().max(200),
    madeDate: beDateStr(),
    wit1: z.string().trim().max(200),
    wit2: z.string().trim().max(200),
  })
  .superRefine((vals, ctx) => {
    const s = parseBE(vals.start)
    const e = parseBE(vals.end)
    if (s && e && e.toDate().getTime() <= s.toDate().getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end'],
        message: 'วันสิ้นสุดต้องหลังวันเริ่มต้น',
      })
    }
  })

export type ContractFormValues = z.infer<typeof contractFormSchema>

export const CONTRACT_FORM_DEFAULTS: ContractFormValues = {
  no: '',
  pid_property: '',
  tenant_id: '',
  landlord_id: '',
  bankAccountId: '',
  parent_contract_id: '',
  start: '',
  end: '',
  rate: 0,
  deposit: 0,
  dur: 0,
  payment: 'รายเดือน',
  purpose: 'พักอาศัย',
  madeAt: '',
  madeDate: '',
  wit1: '',
  wit2: '',
}

/** Common payment frequency presets · v1 datalist */
export const PAYMENT_PRESETS = [
  'รายเดือน',
  'ทุก 3 เดือน',
  'รายไตรมาส',
  'รายปี',
  'ตามสัญญา',
] as const

/** Common purpose presets · v1 dropdown */
export const PURPOSE_PRESETS = [
  'พักอาศัย',
  'ค้าขาย',
  'สำนักงาน',
  'โกดัง',
  'ที่จอดรถ',
  'เสาส่งสัญญาณ',
  'อื่นๆ',
] as const
