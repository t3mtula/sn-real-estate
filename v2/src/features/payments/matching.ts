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
  /** ค่าเช่า + น้ำ/ไฟเดือนนั้น (ถ้ามีมิเตอร์ค้างบิล) — ช่วยจับห้องที่รวมน้ำไฟ (B) */
  expectedWithUtil?: number
  /** ชื่อห้อง/ทรัพย์ (โชว์ใน dropdown ช่วยตัดสิน) */
  room?: string
}

/** คีย์บัญชีต้นทาง (ธนาคาร+เลขท้าย) สำหรับ "จำผู้เช่า" (A) — normalize ตัวพิมพ์/ช่องว่าง */
export function sourceKeyOf(bankCode?: string, suffix?: string): string {
  const b = String(bankCode ?? '').toUpperCase().trim()
  const s = String(suffix ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '').trim()
  return s ? `${b}|${s}` : ''
}

/**
 * สร้างรายชื่อสัญญาผู้สมัครของบัญชีนี้ (กรองยกเลิกออก) พร้อมยอดต่อรอบ
 * @param utilByContract  ยอดน้ำ/ไฟค้างบิลต่อสัญญา (B) — ถ้ามี จะใส่ expectedWithUtil = ค่าเช่า + น้ำไฟ
 */
export function candidatesForAccount(
  contracts: Contract[],
  bankAccountId: string,
  utilByContract?: Map<string, number>,
  propNameByPid?: Map<number, string>,
): Candidate[] {
  return contracts
    .filter((c) => c.data?.bankAccountId === bankAccountId && c.data?.cancelled !== true)
    .map((c) => {
      const expected = getInvoiceAmount(c.data?.rate as string | number | undefined, c.data)
      const util = utilByContract?.get(c.id) ?? 0
      const pid = c.data?.pid_property
      return {
        id: c.id,
        no: String(c.data?.no ?? ''),
        tenant: String(c.data?.tenant ?? c.data?.tenantName ?? ''),
        expected,
        expectedWithUtil: util > 0 ? Number((expected + util).toFixed(2)) : undefined,
        room: pid != null ? propNameByPid?.get(Number(pid)) : undefined,
      }
    })
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
  learnedContractId?: string,
): { score: number; amountHit: 'exact' | 'util' | 'months' | 'no'; nameHit: boolean; learnedHit: boolean } {
  let amountHit: 'exact' | 'util' | 'months' | 'no' = 'no'
  let score = 0
  if (c.expected > 0 && Math.abs(c.expected - tx.amount) <= AMOUNT_TOL) {
    amountHit = 'exact'; score += 60
  } else if (c.expectedWithUtil && Math.abs(c.expectedWithUtil - tx.amount) <= AMOUNT_TOL) {
    // B — ตรงกับ ค่าเช่า + น้ำ/ไฟเดือนนั้น (ห้องรวมน้ำไฟ ยอดไม่นิ่ง)
    amountHit = 'util'; score += 60
  } else if (c.expected > 0) {
    const n = tx.amount / c.expected
    if (n >= 2 && n <= 12 && Math.abs(n - Math.round(n)) < 0.01) { amountHit = 'months'; score += 45 }
  }
  const nameHit = !!(tx.payerName && nameLooksSame(tx.payerName, c.tenant))
  if (nameHit) score += 35
  // A — เคยจับบัญชีต้นทางนี้กับสัญญานี้มาก่อน = สัญญาณแรงสุด (เลขบัญชีมักเดิมทุกเดือน)
  const learnedHit = !!learnedContractId && c.id === learnedContractId
  if (learnedHit) score += 80
  return { score, amountHit, nameHit, learnedHit }
}

export function matchTransaction(
  tx: { amount: number; payerName?: string; sourceKey?: string },
  candidates: Candidate[],
  /** map เลขบัญชีต้นทาง → สัญญา ที่ระบบจำจากประวัติ (A) */
  learned?: Map<string, string>,
): MatchResult {
  if (candidates.length === 0) {
    return { score: 0, confidence: 'none', reason: 'ไม่มีสัญญาผูกกับบัญชีนี้' }
  }

  const learnedContractId =
    tx.sourceKey && learned ? learned.get(tx.sourceKey) : undefined

  const scored = candidates.map((c) => ({ c, ...scoreCandidate(tx, c, learnedContractId) }))
  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]

  if (best.score <= 0) {
    return { score: 0, confidence: 'none', reason: 'ไม่พบสัญญาที่ยอด/ชื่อตรง' }
  }

  // ถ้าหลายสัญญาคะแนนเท่ากันสูงสุด (เช่น 14 ห้องค่าเช่า 1,300 เท่ากัน) = ระบุไม่ได้แน่ → ลดความมั่นใจ
  const tied = scored.filter((s) => s.score === best.score).length
  let score = Math.min(100, best.score)
  let reason: string
  const amountMatched = best.amountHit === 'exact' || best.amountHit === 'util'
  if (best.learnedHit && best.nameHit) {
    reason = 'จำได้ + ชื่อตรง'
  } else if (best.learnedHit && amountMatched) {
    reason = 'จำได้ + ยอดตรง'
  } else if (best.learnedHit) {
    reason = 'เคยรับจากบัญชีต้นทางนี้'
  } else if (tied > 1 && !best.nameHit) {
    score = Math.min(score, 45)
    reason = `ยอดตรง ${tied} ห้อง · เลือกยืนยัน`
  } else if (best.amountHit === 'util') {
    reason = best.nameHit ? 'ยอด(ค่าเช่า+น้ำไฟ) + ชื่อตรง' : 'ยอด = ค่าเช่า + น้ำไฟ'
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
