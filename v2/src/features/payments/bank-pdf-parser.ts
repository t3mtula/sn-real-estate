/**
 * Bank PDF Statement Parser
 * รองรับ: SCB (ไทยพาณิชย์), KBank (กสิกรไทย)
 *
 * Input:  raw text extracted from PDF (via pdfjs-dist)
 * Output: ParsedTransaction[] — เฉพาะรายการรับเงินเข้า (credit)
 */

export type BankType = 'SCB' | 'KBANK' | 'UNKNOWN'

export interface ParsedTransaction {
  /** วันที่ในรูปแบบ DD/MM/YYYY พ.ศ. */
  date: string
  /** เวลา HH:MM */
  time: string
  /** ยอดเงิน (บาท) */
  amount: number
  /** ชื่อผู้โอน (อาจถูก truncate จากธนาคาร) */
  payerName: string
  /** ธนาคารของผู้โอน เช่น KBANK, SCB, BBL */
  sourceBankCode: string
  /** 4 หลักท้ายบัญชีผู้โอน */
  sourceAcctSuffix: string
  /** รายละเอียดดิบจาก statement */
  description: string
  /** ประเภท: โอนผ่านอินเทอร์เน็ต / ฝากสาขา */
  channel: string
}

export interface StatementInfo {
  bank: BankType
  /** เลขที่บัญชีของ statement นี้ (stripped dashes) */
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

/** แปลง 2-digit AD year → 4-digit AD → BE string "DD/MM/YYYY" */
function toBeDate(day: string, month: string, year2: string): string {
  const yearAD = 2000 + parseInt(year2, 10)
  const yearBE = yearAD + 543
  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${yearBE}`
}

/** ดึงตัวเลขจาก string เช่น "3,900.00" → 3900 */
function parseAmt(s: string): number {
  return parseFloat(s.replace(/,/g, '')) || 0
}

/** ลบ dash/hyphen ทั้งหมด สำหรับเทียบเลขบัญชี */
export function stripDashes(s: string): string {
  return s.replace(/[-\s]/g, '')
}

// ─── SCB parser ─────────────────────────────────────────────────────────────
// Format per line:
//   DD/MM/YY HH:MM X1 ENET 3,900.00 4,439.43รับโอนจาก KBANK x9812 นาย อัษฎาวุฒิ มลิล
//   DD/MM/YY HH:MM C1 TELL 6,300.00 12,240.63 บ้านโป่ง (ราชบุรี)
//   DD/MM/YY HH:MM X2 ENET 31,655.00 539.43โอนไป KBANK x0698 น.ส. ภาวิณี วังมะนาว

const SCB_LINE = /(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}:\d{2})\s+([A-Z]\d)\s+(\w+)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*(.*)/

function parseSCBLine(line: string): ParsedTransaction | null {
  const m = line.match(SCB_LINE)
  if (!m) return null

  const [, day, month, yr, time, code, channel, amtStr, , desc] = m
  const amount = parseAmt(amtStr)
  const descTrim = desc.trim()

  // เฉพาะ credit เท่านั้น
  const isTell = channel === 'TELL' || code === 'C1'
  const isDebit = descTrim.startsWith('โอนไป') || code === 'X2'

  if (isDebit && !isTell) return null

  // Parse description: "รับโอนจาก KBANK x9812 นาย อัษฎาวุฒิ มลิล"
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
// Format per line:
//   DD-MM-YY HH:MM รับโอนเงิน 7,986.00 9,015.31 Internet/Mobile SCB จาก SCB X0852 นาง อารี อุ่นแ++
//   DD-MM-YY HH:MM ถอนเงินสด 93,120.00 1,029.31 สาขาบ้านโป่ง รหัสอ้างอิง K0657017

const KBANK_LINE = /(\d{2})-(\d{2})-(\d{2})\s+(\d{2}:\d{2})\s+([฀-๿a-zA-Z\s\/]+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+(.*)/

const KBANK_CREDIT_TYPES = ['รับโอนเงิน', 'ฝากเงินสด', 'รับโอน', 'ฝากเงิน']

function parseKBankLine(line: string): ParsedTransaction | null {
  const m = line.match(KBANK_LINE)
  if (!m) return null

  const [, day, month, yr, time, txType, amtStr, , rest] = m
  const txTypeTrim = txType.trim()

  // เฉพาะ credit
  if (!KBANK_CREDIT_TYPES.some((t) => txTypeTrim.includes(t))) return null

  const amount = parseAmt(amtStr)
  if (amount <= 0) return null

  // Parse rest: "Internet/Mobile SCB จาก SCB X0852 นาง อารี อุ่นแ++"
  let sourceBankCode = ''
  let sourceAcctSuffix = ''
  let payerName = ''
  let channel = 'โอนเงิน'

  const fromMatch = rest.match(/จาก\s+(\w+)\s+X(\w+)\s+(.+)/)
  if (fromMatch) {
    sourceBankCode = fromMatch[1]
    sourceAcctSuffix = fromMatch[2]
    payerName = fromMatch[3].replace(/\+\+$/, '').trim()
  }

  if (rest.includes('Internet') || rest.includes('Mobile') || rest.includes('PLUS') || rest.includes('MAKE')) {
    channel = 'โมบายแบงก์กิ้ง'
  }

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

// ─── detect bank ─────────────────────────────────────────────────────────────

export function detectBank(text: string): BankType {
  if (text.includes('ไทยพาณิชย์') || text.includes('SIAM COMMERCIAL')) return 'SCB'
  if (text.includes('กสิกรไทย') || text.includes('KASIKORNBANK') || text.includes('KBPDF')) return 'KBANK'
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

// ─── main export ─────────────────────────────────────────────────────────────

export function parseStatementText(text: string): ParsedStatement {
  const bank = detectBank(text)

  if (bank === 'SCB') {
    return {
      info: { bank, ...extractSCBInfo(text) },
      transactions: parseSCBStatement(text),
    }
  }

  if (bank === 'KBANK') {
    return {
      info: { bank, ...extractKBankInfo(text) },
      transactions: parseKBankStatement(text),
    }
  }

  return {
    info: { bank: 'UNKNOWN', acctNoRaw: '', accountName: '', period: '' },
    transactions: [],
  }
}
