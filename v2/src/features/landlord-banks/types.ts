/**
 * Landlord ↔ Bank Account junction (M:M)
 *
 * Storage: Supabase `public.landlord_banks`
 *
 * Tem rule (2026-05-23):
 *   - 1 landlord ใช้บัญชีหลายอันได้ (ตัวเอง + spouse + บริษัทเครือ — tax optimization)
 *   - 1 บัญชีถูกใช้โดยหลาย landlord ได้ (ไม่ต้องสร้าง row ซ้ำใน bank_accounts)
 *   - is_default — บัญชีหลักของ landlord สำหรับ contract auto-suggest
 */

export type LandlordBank = {
  id: string
  landlord_id: string
  bank_account_id: string
  is_default: boolean
  note: string | null
  created_at: string | null
}
