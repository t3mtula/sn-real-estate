import { z } from 'zod'
import { PROPERTY_TYPES } from '@/features/properties/types'

const typeValues = PROPERTY_TYPES.map((t) => t.value) as [
  (typeof PROPERTY_TYPES)[number]['value'],
  ...(typeof PROPERTY_TYPES)[number]['value'][],
]

/**
 * Property form schema — locked to audit A4 + Tem's decision (type = enum, no free-text)
 * Address split into 5 sub-fields (with Thai address cascade autocomplete)
 */
export const propertyFormSchema = z.object({
  name: z.string().trim().min(1, 'ระบุชื่อทรัพย์สิน').max(200),
  type: z.enum(typeValues, { message: 'เลือกประเภททรัพย์สิน' }),
  location: z.string().trim().min(1, 'ระบุสถานที่').max(500),
  /** Free-text เลขที่/หมู่/ซอย/ถนน */
  addrLine: z.string().trim().max(500),
  /** ตำบล/แขวง (auto-fill from cascade) */
  addrSubdistrict: z.string().trim().max(100),
  /** อำเภอ/เขต (auto-fill from cascade) */
  addrDistrict: z.string().trim().max(100),
  /** จังหวัด (auto-fill from cascade) */
  addrProvince: z.string().trim().max(100),
  /** รหัสไปรษณีย์ 5 หลัก (auto-fill from cascade) */
  addrPostal: z.string().trim().max(10),
  titleDeed: z.string().trim().max(500),
  area: z.string().trim().max(200),
  owner: z.string().trim().max(200),
  /** Link ไป landlords.id · '' = ไม่ระบุ (เก็บเป็น free-text owner แทน) */
  ownerLandlordId: z.string().trim().max(50),
  multiTenant: z.boolean(),
  /** มิเตอร์น้ำ/ไฟ — flat fields map เข้า nested data.utilities ใน mutations */
  hasWater: z.boolean(),
  waterRate: z.number().min(0, 'เรตต้องไม่ติดลบ'),
  hasElectricity: z.boolean(),
  electricityRate: z.number().min(0, 'เรตต้องไม่ติดลบ'),
  images: z.array(z.string().url().or(z.string().startsWith('data:'))),
})

export type PropertyFormValues = z.infer<typeof propertyFormSchema>

export const PROPERTY_FORM_DEFAULTS: PropertyFormValues = {
  name: '',
  type: 'shophouse',
  location: '',
  addrLine: '',
  addrSubdistrict: '',
  addrDistrict: '',
  addrProvince: '',
  addrPostal: '',
  titleDeed: '',
  area: '',
  owner: '',
  ownerLandlordId: '',
  multiTenant: false,
  hasWater: false,
  waterRate: 0,
  hasElectricity: false,
  electricityRate: 0,
  images: [],
}
