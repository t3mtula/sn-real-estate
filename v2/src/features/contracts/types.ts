/**
 * Contract type definitions
 *
 * Storage: Supabase `public.contracts` table — id (text) + data (jsonb) + timestamps.
 * v2 dual-maintain: เขียนทั้ง landlord_id/tenant_id/bankAccountId (FK) + inline
 *   strings (v1 backward compat) จนกว่า v1 จะ retire
 *
 * v1 fields mirror: id, no, pid (→ property), landlord, landlordAddr,
 *   tenant, tenantAddr, taxId, start, end, rate, deposit, payment, dur,
 *   cancelled + originalEnd + cancelledDate + cancelledReason, noticeDate +
 *   plannedMoveOut + noticeNote, madeAt + madeDate, wit1 + wit2, closed.
 *
 * v2 new: landlord_id, tenant_id, bankAccountId (FK · เลือกอิสระตอนทำสัญญา),
 *   parent_contract_id (สำหรับ sublease chain · ก→ข→ค บนทรัพย์เดียว)
 */

export const CONTRACT_STATUSES = [
  { value: 'active', label: 'ใช้งาน', tone: 'success' },
  { value: 'expiring', label: 'ใกล้หมด', tone: 'warning' },
  { value: 'upcoming', label: 'ยังไม่เริ่ม', tone: 'info' },
  { value: 'expired', label: 'หมดอายุ', tone: 'muted' },
  { value: 'cancelled', label: 'ยกเลิก', tone: 'destructive' },
  { value: 'closed', label: 'ปิด', tone: 'muted' },
  { value: 'unknown', label: 'ไม่ระบุ', tone: 'muted' },
] as const

export type ContractStatus = (typeof CONTRACT_STATUSES)[number]['value']

/**
 * Contract data (stored in `contracts.data` JSONB)
 */
export type ContractData = {
  /** Primary key inside JSON · v1 numeric · v2 epoch ms */
  pid?: number
  /** Contract number e.g. "SN.005-2569" */
  no?: string

  /** Link to property (via property.data.pid · v1 legacy + v2) */
  pid_property?: number

  /** Tenant — v2 native FK + v1 inline */
  tenant_id?: string
  tenant?: string
  tenantAddr?: string
  taxId?: string
  tenantSignerName?: string
  tenantSignerTitle?: string

  /** Landlord — v2 native FK + v1 inline */
  landlord_id?: string
  landlord?: string
  landlordAddr?: string
  invHeaderId?: string

  /** Bank account — v2 (เลือกอิสระตอนทำสัญญา) */
  bankAccountId?: string

  /** Sublease chain — v2 new */
  parent_contract_id?: string

  /** Dates (BE strings "DD/MM/YYYY") */
  start?: string
  end?: string
  /** Saved before cancel for restoring */
  originalEnd?: string

  /** Money */
  rate?: number
  deposit?: number
  /** Payment frequency e.g. "เดือนละ", "รายเดือน" */
  payment?: string
  /** Duration months */
  dur?: number

  /** Cancel info */
  cancelled?: boolean
  cancelledDate?: string
  cancelledReason?: string

  /** Move-out notice */
  noticeDate?: string
  plannedMoveOut?: string
  noticeNote?: string

  /**
   * Where + when signed
   * `madeAt` = assembled address string · เก็บไว้สำหรับ v1 backward compat + PDF
   * แยกเป็น 5 sub-fields ที่ user กรอกผ่าน ThaiAddressInput (camelCase ตาม Tenant/Landlord)
   */
  madeAt?: string
  madeAtLine?: string
  madeAtSubdistrict?: string
  madeAtDistrict?: string
  madeAtProvince?: string
  madeAtPostal?: string
  madeDate?: string

  /** Witnesses */
  wit1?: string
  wit2?: string

  /** Closed (legacy v1) */
  closed?: boolean

  /** Per-contract clause overrides */
  clauseOverrides?: Record<string, string>

  /** v1 legacy other fields stored intact */
  [key: string]: unknown
}

/** Contract row จาก Supabase */
export type Contract = {
  id: string
  data: ContractData
  created_at: string | null
  updated_at: string | null
}

/** Default expiring threshold (days) · v1 sysConfig.expiringDays default 90 */
export const EXPIRING_THRESHOLD_DAYS = 90
