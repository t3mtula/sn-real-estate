/**
 * Format เงินบาท · ใช้ Intl.NumberFormat ของ browser
 *
 * amt(1234.5)         → "฿1,234.50"
 * amt(1234.5, {symbol: false})    → "1,234.50"
 * amt(1234.5, {decimal: 0})       → "฿1,235"
 * amt(null)           → "—"
 */
export interface AmtOptions {
  /** include ฿ symbol (default true) */
  symbol?: boolean
  /** decimal places (default 2) */
  decimal?: number
  /** show — for null/undefined/NaN (default true) */
  emDash?: boolean
}

const formatters = new Map<string, Intl.NumberFormat>()

function getFormatter(decimal: number): Intl.NumberFormat {
  const key = `d${decimal}`
  let fmt = formatters.get(key)
  if (!fmt) {
    fmt = new Intl.NumberFormat("th-TH", {
      minimumFractionDigits: decimal,
      maximumFractionDigits: decimal,
    })
    formatters.set(key, fmt)
  }
  return fmt
}

export function amt(value: number | string | null | undefined, options: AmtOptions = {}): string {
  const { symbol = true, decimal = 2, emDash = true } = options

  if (value === null || value === undefined || value === "") return emDash ? "—" : ""
  const num = typeof value === "string" ? parseAmtLoose(value) : value
  if (!Number.isFinite(num)) return emDash ? "—" : ""

  const formatted = getFormatter(decimal).format(num)
  return symbol ? `฿${formatted}` : formatted
}

/**
 * Parse user input ("1,234.50" หรือ "1234.5") → number · NaN ถ้า invalid
 */
export function parseAmt(input: string | null | undefined): number {
  if (!input) return Number.NaN
  const cleaned = input.replace(/[฿,\s]/g, "")
  const num = Number.parseFloat(cleaned)
  return Number.isFinite(num) ? num : Number.NaN
}

/**
 * Loose-parse a money-ish string from v1 legacy data.
 * Extracts the first numeric token from messy text like
 *   "เดือนละ 1,300 บาท (หนึ่งพันสามร้อยบาทถ้วน)"
 *   "1,320,000 บาท ( หนึ่งล้านสามแสนสองหมื่นบาทถ้วน)"
 *   "3 ปี=234,000 บาท ..."
 * Returns NaN if no parseable number is found (e.g. pure text like
 *   "ชำระค่าเช่าหมดเรียบร้อยแล้ว").
 */
export function parseAmtLoose(input: number | string | null | undefined): number {
  if (input === null || input === undefined || input === "") return Number.NaN
  if (typeof input === "number") return Number.isFinite(input) ? input : Number.NaN
  // Strip commas + currency + whitespace, then grab the first number we see.
  // Prefer the LARGEST number in the string (often the lump-sum or total),
  // not the leading "3 ปี".
  const cleaned = String(input).replace(/[฿,\s]/g, "")
  const matches = cleaned.match(/-?\d+(?:\.\d+)?/g)
  if (!matches || matches.length === 0) return Number.NaN
  // Pick the largest number found (avoids "3 ปี" beating "234,000")
  let best = Number.NaN
  for (const m of matches) {
    const n = Number.parseFloat(m)
    if (!Number.isFinite(n)) continue
    if (!Number.isFinite(best) || n > best) best = n
  }
  return best
}

/**
 * เลข → ตัวหนังสือไทย · ใช้ในเช็ค/ใบเสร็จ
 * "หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบสตางค์"
 */
const TH_DIGITS = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"]
const TH_PLACES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"]

function spellGroup(n: number): string {
  if (n === 0) return ""
  let result = ""
  const digits = String(n).split("").map(Number)
  const len = digits.length
  for (let i = 0; i < len; i++) {
    const digit = digits[i]
    if (digit === undefined) continue
    const place = len - 1 - i
    if (digit === 0) continue
    if (place === 0 && digit === 1 && len > 1) {
      result += "เอ็ด"
    } else if (place === 1 && digit === 1) {
      result += TH_PLACES[place]
    } else if (place === 1 && digit === 2) {
      result += `ยี่${TH_PLACES[place]}`
    } else {
      result += `${TH_DIGITS[digit]}${TH_PLACES[place]}`
    }
  }
  return result
}

export function spellAmt(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return ""
  const rounded = Math.round(value * 100) / 100
  const baht = Math.floor(rounded)
  const satang = Math.round((rounded - baht) * 100)

  let result = ""
  if (baht === 0) {
    result = "ศูนย์บาท"
  } else if (baht >= 1_000_000) {
    const millions = Math.floor(baht / 1_000_000)
    const remainder = baht % 1_000_000
    result = `${spellGroup(millions)}ล้าน${remainder ? spellGroup(remainder) : ""}บาท`
  } else {
    result = `${spellGroup(baht)}บาท`
  }

  if (satang === 0) {
    result += "ถ้วน"
  } else {
    result += `${spellGroup(satang)}สตางค์`
  }
  return result
}
