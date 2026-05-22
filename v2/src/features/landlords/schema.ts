import { z } from 'zod'
import { PARTY_TYPES } from '@/features/landlords/types'

const partyValues = PARTY_TYPES.map((t) => t.value) as [
  (typeof PARTY_TYPES)[number]['value'],
  ...(typeof PARTY_TYPES)[number]['value'][],
]

/**
 * Landlord form schema
 * - banks[] ย้ายออกแล้ว (Phase 1B-3a) → table bank_accounts · ผูกผ่าน ownerLandlordId
 * - logo รับเป็น dataURL string · ว่างได้
 */
export const landlordFormSchema = z.object({
  name: z.string().trim().min(1, 'ระบุชื่อผู้ให้เช่า').max(300),
  shortName: z.string().trim().max(60),
  partyType: z.enum(partyValues, { message: 'เลือกประเภทผู้ให้เช่า' }),
  taxId: z
    .string()
    .trim()
    .max(50)
    .regex(/^[A-Za-z0-9-]*$/, 'ใช้ได้เฉพาะตัวอักษร ตัวเลข และเครื่องหมาย -'),
  branch: z.string().trim().max(20),
  phone: z.string().trim().max(50),
  signerName: z.string().trim().max(200),
  signerTitle: z.string().trim().max(100),
  logo: z.string().max(2_000_000),
  addrLine: z.string().trim().max(500),
  addrSubdistrict: z.string().trim().max(100),
  addrDistrict: z.string().trim().max(100),
  addrProvince: z.string().trim().max(100),
  addrPostal: z.string().trim().max(10),
  vatRegistered: z.boolean(),
  vatRate: z.number().min(0).max(100),
  promptPayId: z.string().trim().max(50),
  promptPayBank: z.string().trim().max(200),
  promptPayName: z.string().trim().max(200),
  notes: z.string().trim().max(1000),
})

export type LandlordFormValues = z.infer<typeof landlordFormSchema>

export const LANDLORD_FORM_DEFAULTS: LandlordFormValues = {
  name: '',
  shortName: '',
  partyType: 'company',
  taxId: '',
  branch: '00000',
  phone: '',
  signerName: '',
  signerTitle: '',
  logo: '',
  addrLine: '',
  addrSubdistrict: '',
  addrDistrict: '',
  addrProvince: '',
  addrPostal: '',
  vatRegistered: false,
  vatRate: 7,
  promptPayId: '',
  promptPayBank: '',
  promptPayName: '',
  notes: '',
}
