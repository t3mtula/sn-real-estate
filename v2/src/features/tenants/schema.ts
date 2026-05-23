import { z } from 'zod'
import { isValidCitizenId } from '@/lib/thai/id'
import { PARTY_TYPES } from '@/features/tenants/types'

const partyValues = PARTY_TYPES.map((t) => t.value) as [
  (typeof PARTY_TYPES)[number]['value'],
  ...(typeof PARTY_TYPES)[number]['value'][],
]

/**
 * Tenant form schema
 * - taxId รับทั้ง Thai national ID (13 digits) และ passport (alphanumeric)
 * - signerName / signerTitle ใช้เฉพาะนิติบุคคล (UI hide ตอน partyType === 'person')
 * - dup-check ของ taxId ทำใน mutation layer (ไม่ใช่ใน zod) เพราะต้อง query DB
 */
export const tenantFormSchema = z.object({
  name: z.string().trim().min(1, 'ระบุชื่อผู้เช่า').max(300),
  partyType: z.enum(partyValues, { message: 'เลือกประเภทผู้เช่า' }),
  taxId: z
    .string()
    .trim()
    .max(50)
    .regex(/^[A-Za-z0-9\-]*$/, 'ใช้ได้เฉพาะตัวอักษร ตัวเลข และเครื่องหมาย -')
    .refine(
      (v) => {
        const digits = v.replace(/[^0-9]/g, '')
        if (digits.length === 13) return isValidCitizenId(v)
        return true  // passport หรือ non-13-digit = ไม่ตรวจ checksum
      },
      { message: 'เลขประจำตัว 13 หลักไม่ถูกต้อง (checksum ผิด)' },
    ),
  branch: z.string().trim().max(20),
  phone: z.string().trim().max(50),
  signerName: z.string().trim().max(200),
  signerTitle: z.string().trim().max(100),
  addrLine: z.string().trim().max(500),
  addrSubdistrict: z.string().trim().max(100),
  addrDistrict: z.string().trim().max(100),
  addrProvince: z.string().trim().max(100),
  addrPostal: z.string().trim().max(10),
})

export type TenantFormValues = z.infer<typeof tenantFormSchema>

export const TENANT_FORM_DEFAULTS: TenantFormValues = {
  name: '',
  partyType: 'person',
  taxId: '',
  branch: '00000',
  phone: '',
  signerName: '',
  signerTitle: '',
  addrLine: '',
  addrSubdistrict: '',
  addrDistrict: '',
  addrProvince: '',
  addrPostal: '',
}
