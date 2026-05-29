/**
 * Bank PDF Statement Parser
 * รองรับ: SCB (ไทยพาณิชย์), KBank (กสิกรไทย), BBL (กรุงเทพ)
 *
 * Input:  ข้อความที่ดึงจาก PDF โดย "เรียงตามบรรทัดจริง" (ดู extractPdfText ใน pdf-import.tsx)
 *         — 1 บรรทัด = 1 รายการ · ห้ามยำทั้งหน้าเป็นบรรทัดเดียว ไม่งั้นจับได้แค่รายการแรก
 * Output: ParsedTransaction[] — เฉพาะรายการเงินเข้า (credit)
 *
 * ⚠️ statement แต่ละธนาคาร (หรือแม้แต่ธนาคารเดียวกันคนละชนิดบัญชี) หน้าตาต่างกันได้
 *    → ถ้าเจอรูปแบบที่ไม่รู้จัก ให้คืน UNKNOWN/0 รายการ แล้วให้คนตรวจ ไม่เดาเงียบ ๆ
 */

export type BankType = 'SCB' | 'KBANK' | 'BBL' | 'UNKNOWN'

export interface ParsedTransaction {
  /** วันที่ในรูปแบบ DD/MM/YYYY พ.ศ. */
  date: string
  /** เวลา HH:MM (ถ้ามี) */
  time: string
  /** ยอดเงิน (บาท) */
  amount: number
  /** ชื่อผู้โอน (อาจถูก truncate หรือว่างถ้า statement ไม่ให้มา เช่น BBL) */
  payerName: string
  /** ธนาคารของผู้โอน เช่น KBANK, SCB, BBL */
  sourceBankCode: string
  /** เลขท้ายบัญชีผู้โอน (ถ้ามี) */
  sourceAcctSuffix: string
  /** รายละเอียดดิบจาก statement */
  description: string
  /** ช่องทาง: โอนเงิน / ฝากสาขา / โมบายแบงก์กิ้ง */
  channel: string
}

export interface StatementInfo {
  bank: BankType
  /** เลขที่บัญชีของ statement นี้ (ตัด dash/space ออก · BBL อาจถูกปิดบังกลาง เช่น 2764xxx959) */
  acctNoRaw: string
  /** ช่วงวันที่ */
  period: string
  /** ชื่อเจ้าของบัญชี */
  accountName: string
}

export interface ParsedStatement {
  info: StatementInfo
  transactions: ParsedTransaction[]
}

// ─── helpers ────────────────────────────────────────────────────────────────

/** 2-digit AD year → BE string "DD/MM/YYYY" */
function toBeDate(day: string, month: string, year2: string): string {
  const yearBE = 2000 + parseInt(year2, 10) + 543
  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${yearBE}`
}

/** 4-digit AD year → BE string "DD/MM/YYYY" (BBL ใช้ ค.ศ. เต็ม) */
function toBeDate4(day: string, month: string, year4: string): string {
  const yearBE = parseInt(year4, 10) + 543
  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${yearBE}`
}

/** "3,900.00" → 3900 */
function parseAmt(s: string): number {
  return parseFloat(s.replace(/,/g, '')) || 0
}

/** ลบ dash/hyphen/space ทั้งหมด สำหรับเทียบเลขบัญชี */
export function stripDashes(s: string): string {
  return s.replace(/[-\s]/g, '')
}

// ─── SCB parser ─────────────────────────────────────────────────────────────
//   01/04/26 11:25 X1 ENET 3,900.00 4,439.43 รับโอนจาก KBANK x9812 นาย อัษฎาวุฒิ มลิล
//   02/04/26 09:23 C1 TELL 6,300.00 12,240.63 บ้านโป่ง (ราชบุรี)

const SCB_LINE = /(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}:\d{2})\s+([A-Z]\d)\s+(\w+)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*(.*)/

function parseSCBLine(line: string): ParsedTransaction | null {
  const m = line.match(SCB_LINE)
  if (!m) return null

  const [, day, month, yr, time, code, channel, amtStr, , desc] = m
  const amount = parseAmt(amtStr)
  const descTrim = desc.trim()

  const isTell = channel === 'TELL' || code === 'C1'
  const isDebit = descTrim.startsWith('โอนไป') || code === 'X2'
  if (isDebit && !isTell) return null

  let sourceBankCode = ''
  let sourceAcctSuffix = ''
  let payerName = ''
  const fromMatch = descTrim.match(/รับโอนจาก\s+(\w+)\s+x(\w+)\s+(.+)/)
  if (fromMatch) {
    sourceBankCode = fromMatch[1]
    sourceAcctSuffix = fromMatch[2]
    payerName = fromMatch[3].trim()
  } else if (isTell) {
    payerName = 'ฝากสาขา'
    sourceBankCode = 'CASH'
  }

  return {
    date: toBeDate(day, month, yr),
    time,
    amount,
    payerName,
    sourceBankCode,
    sourceAcctSuffix,
    description: descTrim,
    channel: isTell ? 'ฝากสาขา' : 'โอนเงิน',
  }
}

function parseSCBStatement(text: string): ParsedTransaction[] {
  return text
    .split('\n')
    .map((line) => parseSCBLine(line.trim()))
    .filter((t): t is ParsedTransaction => t !== null && t.amount > 0)
}

// ─── KBank parser ────────────────────────────────────────────────────────────
//   17-04-26 14:15 รับโอนเงิน 46,200.00 46,721.62 K PLUS จาก X2884 น.ส. กมลวรรณ กลอนก++
//   02-04-26 21:15 รับโอนเงิน 7,986.00 9,015.31 Internet/Mobile SCB จาก SCB X0852 นาง อารี อุ่นแ++
// รูปแบบ: วันที่ เวลา <ชนิดรายการ> <ยอด> <คงเหลือ> <ช่องทาง...> จาก [BANK] Xnnnn ชื่อ

const KBANK_LINE = /(\d{2})-(\d{2})-(\d{2})\s+(\d{2}:\d{2})\s+([฀-๿a-zA-Z\s/]+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+(.*)/

const KBANK_CREDIT_TYPES = ['รับโอนเงิน', 'ฝากเงินสด', 'รับโอน', 'ฝากเงิน']

function parseKBankLine(line: string): ParsedTransaction | null {
  const m = line.match(KBANK_LINE)
  if (!m) return null

  const [, day, month, yr, time, txType, amtStr, , rest] = m
  const txTypeTrim = txType.trim()
  if (!KBANK_CREDIT_TYPES.some((t) => txTypeTrim.includes(t))) return null

  const amount = parseAmt(amtStr)
  if (amount <= 0) return null

  let sourceBankCode = ''
  let sourceAcctSuffix = ''
  let payerName = ''

  // "จาก SCB X0852 ชื่อ" (มีรหัสธนาคาร) หรือ "จาก X2884 ชื่อ" (โอนภายในกสิกรกันเอง)
  const withBank = rest.match(/จาก\s+([A-Z]{2,})\s+X(\w+)\s+(.+)/)
  const sameBank = rest.match(/จาก\s+X(\w+)\s+(.+)/)
  if (withBank) {
    sourceBankCode = withBank[1]
    sourceAcctSuffix = withBank[2]
    payerName = withBank[3].replace(/\+\+$/, '').trim()
  } else if (sameBank) {
    sourceBankCode = 'KBANK'
    sourceAcctSuffix = sameBank[1]
    payerName = sameBank[2].replace(/\+\+$/, '').trim()
  }

  let channel = 'โอนเงิน'
  if (/Internet|Mobile|PLUS|MAKE/.test(rest)) channel = 'โมบายแบงก์กิ้ง'

  return {
    date: toBeDate(day, month, yr),
    time,
    amount,
    payerName,
    sourceBankCode,
    sourceAcctSuffix,
    description: rest.trim(),
    channel,
  }
}

function parseKBankStatement(text: string): ParsedTransaction[] {
  return text
    .split('\n')
    .map((line) => parseKBankLine(line.trim()))
    .filter((t): t is ParsedTransaction => t !== null)
}

// ─── BBL parser ────────────────────────────────────────────────────────────
//   12/05/2026 12:36:52 12/05/2026 TRF FR OTH BK 0.00 100.00 208,179.98 Mobile Phone Banking
//   09/05/2026 12:14:20 09/05/2026 0.00 2,982.00 201,467.68 Mobile Phone Banking
// รูปแบบ: วันที่(ค.ศ.) เวลา วันที่มีผล [รายละเอียด] <debit> <credit> <คงเหลือ> <ช่องทาง>
// เงินเข้า = credit > 0 · BBL ไม่ให้ชื่อผู้โอน (จับคู่ด้วยยอด+วันที่+บัญชีแทน)

const BBL_LINE = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})\s+\d{2}\/\d{2}\/\d{4}\s+(.*?)(-?[\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+(.+)$/

function parseBBLLine(line: string): ParsedTransaction | null {
  const m = line.match(BBL_LINE)
  if (!m) return null

  const [, day, month, year4, time, descRaw, , creditStr, , channelRaw] = m
  const credit = parseAmt(creditStr)
  if (credit <= 0) return null // เอาเฉพาะเงินเข้า

  const desc = descRaw.trim()
  return {
    date: toBeDate4(day, month, year4),
    time: time.slice(0, 5),
    amount: credit,
    payerName: '', // BBL Transaction Report ไม่ระบุชื่อผู้โอน
    sourceBankCode: /OTH BK/i.test(desc) ? 'OTHER' : '',
    sourceAcctSuffix: '',
    description: desc || channelRaw.trim(),
    channel: channelRaw.trim() || 'โอนเงิน',
  }
}

function parseBBLStatement(text: string): ParsedTransaction[] {
  return text
    .split('\n')
    .map((line) => parseBBLLine(line.trim()))
    .filter((t): t is ParsedTransaction => t !== null)
}

// ─── detect bank ─────────────────────────────────────────────────────────────

export function detectBank(text: string): BankType {
  if (text.includes('ไทยพาณิชย์') || text.includes('SIAM COMMERCIAL')) return 'SCB'
  if (text.includes('กสิกรไทย') || text.includes('KASIKORNBANK') || text.includes('KBPDF')) return 'KBANK'
  if (text.includes('ธนาคารกรุงเทพ') || text.includes('BANGKOK BANK')) return 'BBL'
  return 'UNKNOWN'
}

function extractSCBInfo(text: string): Omit<StatementInfo, 'bank'> {
  const acctMatch = text.match(/(\d{3}-\d{6}-\d)/) || text.match(/(\d{3}-\d-\d{5}-\d)/)
  const nameMatch = text.match(/ชื่อ - สกุล\s*\n?\s*Name\s*\n?\s*([^\n]+)/)
  const periodMatch = text.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/)
  return {
    acctNoRaw: stripDashes(acctMatch?.[1] ?? ''),
    accountName: nameMatch?.[1]?.trim() ?? '',
    period: periodMatch ? `${periodMatch[1]} - ${periodMatch[2]}` : '',
  }
}

function extractKBankInfo(text: string): Omit<StatementInfo, 'bank'> {
  const acctMatch = text.match(/(\d{3}-\d-\d{5}-\d)/)
  const nameMatch = text.match(/ชื่อบัญชี\s*([^\n]+)/)
  const periodMatch = text.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/)
  return {
    acctNoRaw: stripDashes(acctMatch?.[1] ?? ''),
    accountName: nameMatch?.[1]?.trim() ?? '',
    period: periodMatch ? `${periodMatch[1]} - ${periodMatch[2]}` : '',
  }
}

function extractBBLInfo(text: string): Omit<StatementInfo, 'bank'> {
  // เลขบัญชีถูกปิดบังกลาง เช่น "2764xxx959" → เก็บไว้เทียบแบบหน้า-หลัง
  const acctMatch = text.match(/(\d{3,}x{2,}\d{2,})/i)
  const nameMatch = text.match(/Customer\s*:\s*(.+?)\s+Bank\s*:/)
  const periodMatch = text.match(/(\d{2}\/\d{2}\/\d{4})\s*(?:to|-)\s*(\d{2}\/\d{2}\/\d{4})/)
  return {
    acctNoRaw: (acctMatch?.[1] ?? '').toLowerCase(),
    accountName: nameMatch?.[1]?.trim() ?? '',
    period: periodMatch ? `${periodMatch[1]} - ${periodMatch[2]}` : '',
  }
}

// ─── main export ─────────────────────────────────────────────────────────────

export function parseStatementText(text: string): ParsedStatement {
  const bank = detectBank(text)

  if (bank === 'SCB') return { info: { bank, ...extractSCBInfo(text) }, transactions: parseSCBStatement(text) }
  if (bank === 'KBANK') return { info: { bank, ...extractKBankInfo(text) }, transactions: parseKBankStatement(text) }
  if (bank === 'BBL') return { info: { bank, ...extractBBLInfo(text) }, transactions: parseBBLStatement(text) }

  return { info: { bank: 'UNKNOWN', acctNoRaw: '', accountName: '', period: '' }, transactions: [] }
}

/**
 * เทียบเลขบัญชี statement กับเลขบัญชีในระบบ
 * - ปกติ: ตัด dash แล้วเท่ากันเป๊ะ
 * - BBL ปิดบังกลาง (เช่น 2764xxx959): เทียบ 4 ตัวหน้า + 3 ตัวท้าย
 */
export function acctNoMatches(statementAcct: string, systemAcct: string): boolean {
  const stmt = statementAcct.toLowerCase().trim()
  const sys = stripDashes(systemAcct)
  if (!stmt || !sys) return false
  if (stripDashes(stmt) === sys && !stmt.includes('x')) return true
  if (stmt.includes('x')) {
    const digits = stmt.replace(/x+/gi, '|')
    const [head, tail] = digits.split('|')
    if (head && tail && head.length >= 3 && tail.length >= 2) {
      return sys.startsWith(head) && sys.endsWith(tail)
    }
  }
  return false
}
