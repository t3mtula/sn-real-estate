/**
 * Tenant type definitions
 *
 * Storage: Supabase `public.tenants` table — id (text) + data (jsonb) + timestamps.
 * v1 ไม่มี table นี้ — tenant ถูกเก็บ inline ใน contracts.data (c.tenant, c.taxId ฯลฯ).
 * v2 dual-maintain: เขียนทั้ง tenants table (FK) + contract.data inline (v1 backward compat)
 */

export const PARTY_TYPES = [
  { value: 'person', label: 'บุคคลธรรมดา' },
  { value: 'company', label: 'นิติบุคคล' },
] as const

export type PartyType = (typeof PARTY_TYPES)[number]['value']

/**
 * Tenant data (stored in `tenants.data` JSONB)
 */
export type TenantData = {
  /** Primary key inside JSON · epoch ms */
  pid?: number
  /** ชื่อเต็ม (รวม prefix) */
  name: string
  /** ประเภท (บุคคล/นิติบุคคล) */
  partyType: PartyType
  /** เลขผู้เสียภาษีไทย 13 หลัก หรือ passport (alphanumeric) · ว่างได้ */
  taxId?: string
  /** สาขาผู้เสียภาษี · default '00000' (สำนักงานใหญ่) */
  branch?: string
  /** เบอร์โทร */
  phone?: string
  /** ชื่อกรรมการที่เซ็น (เฉพาะนิติบุคคล) */
  signerName?: string
  /** ตำแหน่งกรรมการ (เฉพาะนิติบุคคล) */
  signerTitle?: string
  /** Logo (URL หรือ base64 dataURL) */
  logo?: string
  /** ที่อยู่ 5 ช่อง (เหมือน Properties Phase 1A) */
  addrLine?: string
  addrSubdistrict?: string
  addrDistrict?: string
  addrProvince?: string
  addrPostal?: string
  /** Default witnesses (dynamic list, can be empty) */
  witnesses?: string[]
}

/** Tenant row จาก Supabase */
export type Tenant = {
  id: string
  data: TenantData
  created_at: string | null
  updated_at: string | null
}
