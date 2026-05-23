import { z } from 'zod'
import type { MeterType } from '@/features/meters/types'

export const METER_TYPES: { value: MeterType; label: string }[] = [
  { value: 'water', label: 'น้ำ' },
  { value: 'electricity', label: 'ไฟฟ้า' },
  { value: 'other', label: 'อื่นๆ' },
]

export const meterReadingFormSchema = z
  .object({
    property_id: z.string().trim().min(1, 'เลือกทรัพย์สิน'),
    property_name: z.string().trim(),
    contract_id: z.string().trim().optional(),
    type: z.enum(['water', 'electricity', 'other'] as const),
    meter_no: z.string().trim().max(100).optional(),
    reading_date: z
      .string()
      .trim()
      .min(1, 'ระบุวันที่อ่านมิเตอร์')
      .regex(/^\d{2}\/\d{2}\/\d{4}$/, 'รูปแบบวันที่ต้องเป็น DD/MM/YYYY'),
    prev_reading: z.number({ error: 'ระบุค่ามิเตอร์ก่อนหน้า' }).min(0, 'ค่ามิเตอร์ต้องไม่ติดลบ'),
    curr_reading: z.number({ error: 'ระบุค่ามิเตอร์ปัจจุบัน' }).min(0, 'ค่ามิเตอร์ต้องไม่ติดลบ'),
    rate_per_unit: z.number({ error: 'ระบุราคาต่อหน่วย' }).min(0, 'ราคาต้องไม่ติดลบ'),
    fixed_fee: z.number().min(0).optional().default(0),
    notes: z.string().trim().max(2000).optional(),
    billed: z.boolean().optional().default(false),
    invoice_id: z.string().trim().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.curr_reading < val.prev_reading) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['curr_reading'],
        message: 'ค่ามิเตอร์ปัจจุบันต้องไม่น้อยกว่าค่าก่อนหน้า',
      })
    }
  })

export type MeterReadingFormValues = z.infer<typeof meterReadingFormSchema>

export const METER_READING_FORM_DEFAULTS: MeterReadingFormValues = {
  property_id: '',
  property_name: '',
  contract_id: '',
  type: 'electricity',
  meter_no: '',
  reading_date: '',
  prev_reading: 0,
  curr_reading: 0,
  rate_per_unit: 0,
  fixed_fee: 0,
  notes: '',
  billed: false,
  invoice_id: '',
}
