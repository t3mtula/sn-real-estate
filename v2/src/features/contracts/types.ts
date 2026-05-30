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

/**
 * Move-out inspection record · stored in contract.data.inspection
 */
export type MoveOutInspectionItem = {
  label: string
  status: 'pass' | 'fail' | 'na'
  deduction: number
  note: string
}

export type MoveOutInspection = {
  date: string            // "DD/MM/YYYY" BE
  inspector: string
  items: MoveOutInspectionItem[]
  totalDeduction: number
  notes: string
  completedAt: string     // ISO timestamp
}

/**
 * Deposit return record · stored in contract.data.depositReturn
 */
export type DepositReturn = {
  originalDeposit: number
  deductionFromInspection: number
  deductionUnpaidInvoices: number
  otherDeductions: number
  otherDeductionsNote: string
  refundAmount: number    // calculated
  returnDate: string      // "DD/MM/YYYY" BE
  returnMethod: string    // โอนเงิน/เงินสด/เช็ค
  returnRef: string
  returnNote: string
  completedAt: string     // ISO timestamp
}

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

  /** ฟอร์มสัญญา (template) ที่ผูกกับสัญญานี้ · ถ้าไม่ระบุ = ใช้ active template */
  templateId?: string

  /** Sublease chain — v2 new */
  parent_contract_id?: string

  /** Dates (BE strings "DD/MM/YYYY") */
  start?: string
  end?: string
  /** Saved before cancel for restoring */
  originalEnd?: string

  /** ค่าเช่า — ข้อความในสัญญา (free text) หรือ legacy number */
  rate?: number | string
  deposit?: number | string
  /** ค่าเช่าสำหรับคำนวณ */
  rateAmount?: number
  /** รอบเรียกเก็บ = ทุก N เดือน (1=รายเดือน · 3=ไตรมาส · 12=รายปี) */
  rateIntervalMonths?: number
  /** วันเริ่มเก็บค่าเช่า (อาจต่างจาก start) */
  billingStart?: string
  /** Legacy fields — ไว้ backward compat */
  rateFreq?: string
  monthlyBaht?: number
  /** Payment description e.g. "ชำระล่วงหน้า ภายในวันที่ 5" */
  payment?: string
  /** Duration — display string ("3 ปี", "2 ปี 6 เดือน") หรือ legacy number */
  dur?: number | string
  /** Duration months (computed) */
  durMonths?: number
  durRaw?: string

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

  /**
   * Per-contract clause overrides (legacy index-based · deprecated)
   * @deprecated ใช้ contractClauses แทน
   */
  clauseOverrides?: Record<string, string>

  /**
   * Per-contract clause snapshot — full clause set for this contract.
   * Set on first save of the clause editor; print prefers this over template.
   * Structure mirrors ContractClause[] from template.
   */
  contractClauses?: Array<{ text: string; sub?: string[] }>

  /** Move-out inspection record */
  inspection?: MoveOutInspection

  /** Deposit return record */
  depositReturn?: DepositReturn

  /** สถานะการต่อสัญญา · ใช้บน renewals page */
  renewalStatus?: 'pending' | 'negotiating' | 'will_renew' | 'no_renewal'
  /** จุด/ล็อกบนทรัพย์สิน เช่น "ล็อก A", "ห้อง 3" */
  spot?: string
  /**
   * ผู้เช่ารายนี้ต้องจ่ายค่าน้ำ/ไฟไหม — ตอนสร้างสัญญาดึงค่าตั้งต้นจาก property.utilities[*].enabled
   * (override ได้) · เรตอ่านจากทรัพย์สิน ไม่เก็บซ้ำที่นี่
   * ไม่มี key = สัญญาเก่า (ถือว่าไม่เก็บ จนกว่าจะตั้งค่า)
   */
  utilities?: { water?: boolean; electricity?: boolean }
  /** Tags — free-form labels พนักงานติดเอง · ใช้ group/filter (เช่น "โซนเหนือ", "เก็บต้นเดือน") */
  tags?: string[]
  /** วันครบกำหนดใบแจ้งหนี้ (1-31) */
  dueDay?: number
  /** ข้อความปรับค่าเช่า เช่น "ปรับขึ้น 5% เมื่อต่อสัญญา" */
  rateAdj?: string
  /** ID ของสัญญาที่ต่อมา (ต้นทาง) */
  renewedFrom?: string
  /** ID ของสัญญาที่คัดลอกมา */
  copiedFrom?: string

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
