/**
 * Bank Account type definitions
 *
 * Storage: Supabase `public.bank_accounts` table — id (text) + data (jsonb) + timestamps.
 *
 * Tem rule (2026-05-22): bank ไม่ผูก landlord 1:1
 *   - 1 landlord มีได้หลายบัญชี (owner)
 *   - 1 บัญชี = owned by 1 landlord (informational)
 *   - Contract เลือก bank ใดก็ได้ — ไม่จำเป็นต้องเป็นของ landlord ในสัญญา
 *   - Use case: ก ให้ ข เช่า · ค (sub-tenant) จ่ายเข้าบัญชี ก ตรง (tax optimization)
 */

export type BankAccountData = {
  /** Primary key inside JSON · epoch ms */
  pid?: number
  /** ชื่อธนาคาร (เช่น "ธนาคารกรุงเทพ") · ไม่รวมสาขา */
  bank: string
  /** สาขา (เช่น "บ้านโป่ง") · ว่างได้ */
  branch?: string
  /** เลขบัญชี (display value with dashes) */
  acctNo: string
  /** ชื่อบัญชี (อาจไม่ตรงกับเจ้าของบัญชี — เช่น บัญชีของกรรมการ) */
  accountName: string
  /** label สั้น สำหรับ dropdown ใน contract form (เช่น "หลัก", "ค่าน้ำค่าไฟ", "VAT") */
  label?: string
  /** เจ้าของบัญชี — link ไป landlords.id · informational only */
  ownerLandlordId?: string
  /** ชื่อเจ้าของบัญชี (cache สำหรับ display เร็ว · refresh เมื่อ landlord rename) */
  ownerLandlordName?: string
  /** active สำหรับ filter contract form (ปิด account เก่าได้โดยไม่ลบ) */
  active?: boolean
  /** หมายเหตุภายใน */
  notes?: string
}

/** Bank Account row จาก Supabase */
export type BankAccount = {
  id: string
  data: BankAccountData
  created_at: string | null
  updated_at: string | null
}
