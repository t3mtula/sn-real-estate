/**
 * Landlord type definitions
 *
 * Storage: Supabase `public.landlords` table — id (text) + data (jsonb) + timestamps.
 * v1 ไม่มี table นี้ — เก็บ inline ใน contracts.data (c.landlord, c.landlordAddr,
 *   c.bank, c.acctNo, c.accountName, c.landlordSignerName, c.landlordSignerTitle)
 *   + invoice_headers ทับซ้อนกัน (1:1).
 * v2 dual-maintain: เขียนทั้ง landlords (FK) + contract.data inline (v1 backward compat)
 *   + ไม่แตะ invoice_headers ตอนนี้ (จะลบทีหลังตอน v1 retire).
 */

export const PARTY_TYPES = [
  { value: 'person', label: 'บุคคลธรรมดา' },
  { value: 'company', label: 'นิติบุคคล' },
] as const

export type PartyType = (typeof PARTY_TYPES)[number]['value']

/**
 * Landlord data (stored in `landlords.data` JSONB)
 *
 * NOTE (Phase 1B-3a): `banks` field deprecated — ย้ายไป table `bank_accounts` แล้ว
 *   query บัญชีของ landlord ผ่าน useBankAccountsByOwner(landlord.id)
 */
export type LandlordData = {
  /** Primary key inside JSON · epoch ms */
  pid?: number
  /** ชื่อเต็มตามทะเบียน (ใช้ใน contract/invoice header) */
  name: string
  /** ชื่อย่อ สำหรับ list / KPI cards (เช่น "บจก.สมบัตินภา") */
  shortName?: string
  /** ประเภท (บุคคล/นิติบุคคล) */
  partyType: PartyType
  /** เลขผู้เสียภาษีไทย 13 หลัก หรือ passport · ว่างได้ */
  taxId?: string
  /** สาขาผู้เสียภาษี · default '00000' (สำนักงานใหญ่) */
  branch?: string
  /** เบอร์โทร */
  phone?: string
  /** ชื่อกรรมการที่เซ็น (เฉพาะนิติบุคคล) */
  signerName?: string
  /** ตำแหน่งกรรมการ */
  signerTitle?: string
  /** Logo (URL หรือ base64 dataURL) */
  logo?: string | null
  /** ที่อยู่ 5 ช่อง (เหมือน Properties/Tenants) */
  addrLine?: string
  addrSubdistrict?: string
  addrDistrict?: string
  addrProvince?: string
  addrPostal?: string
  /** @deprecated Phase 1B-3a — ย้ายไป table `bank_accounts` (legacy data preserved for rollback) */
  banks?: Array<{ bank: string; acctNo: string; accountName: string; label?: string }>
  /** จด VAT หรือไม่ */
  vatRegistered?: boolean
  /** อัตรา VAT % (default 7) */
  vatRate?: number
  /** vatMode (none/inclusive/exclusive — preexisting v1 field) */
  vatMode?: string
  /** PromptPay (เลขประจำตัวผู้เสียภาษี/เบอร์โทร) */
  promptPayId?: string
  /** ธนาคารที่ผูก PromptPay */
  promptPayBank?: string
  /** ชื่อผู้รับ PromptPay */
  promptPayName?: string
  /** Link ไปยัง invoice_headers row (v1 backward compat) */
  invoiceHeaderId?: string
  /** หมายเหตุภายใน */
  notes?: string
}

/** Landlord row จาก Supabase */
export type Landlord = {
  id: string
  data: LandlordData
  created_at: string | null
  updated_at: string | null
}
