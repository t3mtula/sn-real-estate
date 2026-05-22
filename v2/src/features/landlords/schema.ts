import { z } from 'zod'
import { PARTY_TYPES } from '@/features/landlords/types'

const partyValues = PARTY_TYPES.map((t) => t.value) as [
  (typeof PARTY_TYPES)[number]['value'],
  ...(typeof PARTY_TYPES)[number]['value'][],
]

/**
 * Bank account row in form (allows empty rows ที่ submit จะถูก filter ทิ้ง)
 */
export const landlordBankSchema = z.object({
  bank: z.string().trim().max(200),
  acctNo: z.string().trim().max(50),
  accountName: z.string().trim().max(200),
  label: z.string().trim().max(50),
})

/**
 * Landlord form schema
 * - taxId รับทั้ง Thai national ID และ passport (alphanumeric + dash)
 * - signerName / signerTitle ใช้เฉพาะนิติบุคคล
 * - banks ปล่อย empty array ได้ (landlord ที่ไม่มีบัญชีโอน) · row ว่างจะ filter ทิ้งใน mutation
 * - vatRate optional · default 7 ตอน submit ถ้า vatRegistered=true
 * - logo รับเป็น dataURL/URL string ผ่าน UI · ว่างได้
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
  logo: z.string().max(2_000_000), // dataURL base64 OK
  addrLine: z.string().trim().max(500),
  addrSubdistrict: z.string().trim().max(100),
  addrDistrict: z.string().trim().max(100),
  addrProvince: z.string().trim().max(100),
  addrPostal: z.string().trim().max(10),
  banks: z.array(landlordBankSchema).max(10, 'บัญชีธนาคารได้สูงสุด 10 บัญชี'),
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
  banks: [{ bank: '', acctNo: '', accountName: '', label: '' }],
  vatRegistered: false,
  vatRate: 7,
  promptPayId: '',
  promptPayBank: '',
  promptPayName: '',
  notes: '',
}

/** Empty bank row helper (สำหรับ field array add) */
export const EMPTY_BANK_ROW = { bank: '', acctNo: '', accountName: '', label: '' } as const
