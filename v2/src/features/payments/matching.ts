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
  /** คะแนนความตรง 0-100 (ช่วยพนักงานตัดสิน) */
  score: number
  confidence: MatchConfidence
  /** เหตุผลย่อ (ไว้โชว์/ดีบั๊ก) */
  reason: string
}

function confFromScore(score: number): MatchConfidence {
  if (score >= 75) return 'high'
  if (score >= 40) return 'medium'
  return 'none'
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
/** คะแนนของสัญญา 1 ราย เทียบกับเงินก้อนนี้ + เก็บว่าตรงเพราะอะไร */
function scoreCandidate(
  tx: { amount: number; payerName?: string },
  c: Candidate,
): { score: number; amountHit: 'exact' | 'months' | 'no'; nameHit: boolean } {
  let amountHit: 'exact' | 'months' | 'no' = 'no'
  let score = 0
  if (c.expected > 0) {
    if (Math.abs(c.expected - tx.amount) <= AMOUNT_TOL) {
      amountHit = 'exact'; score += 60
    } else {
      const n = tx.amount / c.expected
      if (n >= 2 && n <= 12 && Math.abs(n - Math.round(n)) < 0.01) { amountHit = 'months'; score += 45 }
    }
  }
  const nameHit = !!(tx.payerName && nameLooksSame(tx.payerName, c.tenant))
  if (nameHit) score += 35
  return { score, amountHit, nameHit }
}

export function matchTransaction(
  tx: { amount: number; payerName?: string },
  candidates: Candidate[],
): MatchResult {
  if (candidates.length === 0) {
    return { score: 0, confidence: 'none', reason: 'ไม่มีสัญญาผูกกับบัญชีนี้' }
  }

  const scored = candidates.map((c) => ({ c, ...scoreCandidate(tx, c) }))
  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]

  if (best.score <= 0) {
    return { score: 0, confidence: 'none', reason: 'ไม่พบสัญญาที่ยอด/ชื่อตรง' }
  }

  // ถ้าหลายสัญญาคะแนนเท่ากันสูงสุด (เช่น 14 ห้องค่าเช่า 1,300 เท่ากัน) = ระบุไม่ได้แน่ → ลดความมั่นใจ
  const tied = scored.filter((s) => s.score === best.score).length
  let score = best.score
  let reason: string
  if (tied > 1 && !best.nameHit) {
    score = Math.min(score, 45)
    reason = `ยอดตรง ${tied} ห้อง · เลือกยืนยัน`
  } else if (best.amountHit === 'exact' && best.nameHit) {
    reason = 'ยอด + ชื่อตรง'
  } else if (best.amountHit === 'exact') {
    reason = 'ยอดตรงค่าเช่า'
  } else if (best.amountHit === 'months') {
    reason = 'ยอด = ค่าเช่าหลายเดือน'
  } else {
    reason = 'ชื่อตรง (ยอดไม่ตรงค่าเช่า)'
  }

  return {
    contractId: best.c.id,
    contractNo: best.c.no,
    tenantName: best.c.tenant,
    score,
    confidence: confFromScore(score),
    reason,
  }
}
