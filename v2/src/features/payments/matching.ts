/**
 * Payment ↔ Contract matching — เดาว่าเงินที่โอนเข้ามาเป็นของผู้เช่ารายไหน
 *
 * ตรรกะ (ตามที่ตกลงกับ Tem):
 *   1. กรองด้วยบัญชี — เหลือเฉพาะสัญญาที่ระบุให้โอนเข้าบัญชีนี้ (contract.bankAccountId)
 *   2. ยอดเงิน — เทียบกับยอดต่อรอบของสัญญา (getInvoiceAmount ถอดจาก rate string)
 *   3. ชื่อผู้โอน — ใช้ยืนยัน/ตัดสินเมื่อยอดตรงหลายสัญญา
 *
 * คืน suggestion + ระดับความมั่นใจ · ไม่ผูกอัตโนมัติถ้าไม่ชัด (ให้คนเลือก)
 */
import type { Contract } from '@/features/contracts/types'
import { getInvoiceAmount } from '@/features/invoices/queries'

export type MatchConfidence = 'high' | 'medium' | 'none'

export interface MatchResult {
  contractId?: string
  contractNo?: string
  tenantName?: string
  confidence: MatchConfidence
  /** เหตุผลย่อ (ไว้โชว์/ดีบั๊ก) */
  reason: string
}

const AMOUNT_TOL = 1 // บาท

/** ตัดคำนำหน้า/ช่องว่าง/ตัวพิมพ์ ออกเพื่อเทียบชื่อข้ามไทย-อังกฤษ-ตัดท้าย */
function normalizeName(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/(นาย|นาง|นางสาว|น\.ส\.|บจก\.|บมจ\.|หจก\.|บริษัท|ห้างหุ้นส่วน|mr\.?|mrs\.?|miss|ms\.?|company|co\.?|ltd\.?)/g, '')
    .replace(/[^a-z0-9ก-๙]/g, '')
    .trim()
}

/** ชื่อผู้โอน ~ ชื่อผู้เช่า ไหม (อย่างใดอย่างหนึ่งเป็น substring ของอีกฝั่ง · กันสั้นเกิน) */
function nameLooksSame(payer: string, tenant: string): boolean {
  const a = normalizeName(payer)
  const b = normalizeName(tenant)
  if (a.length < 3 || b.length < 3) return false
  return a.includes(b) || b.includes(a)
}

interface Candidate {
  id: string
  no: string
  tenant: string
  expected: number
}

/** สร้างรายชื่อสัญญาผู้สมัครของบัญชีนี้ (กรองยกเลิกออก) พร้อมยอดต่อรอบ */
export function candidatesForAccount(contracts: Contract[], bankAccountId: string): Candidate[] {
  return contracts
    .filter((c) => c.data?.bankAccountId === bankAccountId && c.data?.cancelled !== true)
    .map((c) => ({
      id: c.id,
      no: String(c.data?.no ?? ''),
      tenant: String(c.data?.tenant ?? c.data?.tenantName ?? ''),
      expected: getInvoiceAmount(c.data?.rate as string | number | undefined, c.data),
    }))
}

/**
 * จับคู่ transaction หนึ่งรายการกับสัญญา
 * @param tx       ยอด + ชื่อผู้โอน จาก statement
 * @param candidates  สัญญาของบัญชีนี้ (จาก candidatesForAccount)
 */
export function matchTransaction(
  tx: { amount: number; payerName?: string },
  candidates: Candidate[],
): MatchResult {
  if (candidates.length === 0) {
    return { confidence: 'none', reason: 'ไม่มีสัญญาผูกกับบัญชีนี้' }
  }

  const byAmount = candidates.filter((c) => c.expected > 0 && Math.abs(c.expected - tx.amount) <= AMOUNT_TOL)
  const payer = tx.payerName ?? ''

  // ยอดตรงรายเดียว → มั่นใจสูง (ชื่อยิ่งตรงยิ่งชัด)
  if (byAmount.length === 1) {
    const c = byAmount[0]
    const nameOk = payer && nameLooksSame(payer, c.tenant)
    return {
      contractId: c.id, contractNo: c.no, tenantName: c.tenant,
      confidence: 'high',
      reason: nameOk ? 'ยอด+ชื่อตรง' : 'ยอดตรง (บัญชีนี้รายเดียว)',
    }
  }

  // ยอดตรงหลายราย → ใช้ชื่อตัดสิน
  if (byAmount.length > 1) {
    const byName = byAmount.filter((c) => payer && nameLooksSame(payer, c.tenant))
    if (byName.length === 1) {
      const c = byName[0]
      return { contractId: c.id, contractNo: c.no, tenantName: c.tenant, confidence: 'high', reason: 'ยอดตรงหลายราย · ชื่อช่วยชี้' }
    }
    const c = byAmount[0]
    return { contractId: c.id, contractNo: c.no, tenantName: c.tenant, confidence: 'medium', reason: `ยอดตรง ${byAmount.length} สัญญา · เลือกยืนยัน` }
  }

  // ยอดไม่ตรง → ลองชื่ออย่างเดียว
  const byName = candidates.filter((c) => payer && nameLooksSame(payer, c.tenant))
  if (byName.length === 1) {
    const c = byName[0]
    return { contractId: c.id, contractNo: c.no, tenantName: c.tenant, confidence: 'medium', reason: 'ชื่อตรง (ยอดไม่ตรงค่าเช่า)' }
  }

  return { confidence: 'none', reason: 'ไม่พบสัญญาที่ยอด/ชื่อตรง' }
}
