import dayjs, { type Dayjs } from "dayjs"
import buddhistEra from "dayjs/plugin/buddhistEra"
import customParseFormat from "dayjs/plugin/customParseFormat"

dayjs.extend(buddhistEra)
dayjs.extend(customParseFormat)

export { dayjs }

/**
 * รับ Date/string/Dayjs → คืน Dayjs · ใช้ในทุก app
 */
export function toDayjs(input: Date | string | Dayjs | null | undefined): Dayjs | null {
  if (!input) return null
  const d = dayjs(input)
  return d.isValid() ? d : null
}

/**
 * Format วันที่เป็น พ.ศ.
 * default: "DD/MM/BBBB" → 21/05/2569
 * supports custom format tokens (ดู dayjs docs)
 */
export function fmtBE(
  input: Date | string | Dayjs | null | undefined,
  format = "DD/MM/BBBB",
): string {
  const d = toDayjs(input)
  return d ? d.format(format) : ""
}

/**
 * Format แบบไทยยาว: "21 พฤษภาคม 2569"
 */
const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
]

const THAI_MONTHS_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
]

export function fmtThaiLong(input: Date | string | Dayjs | null | undefined): string {
  const d = toDayjs(input)
  if (!d) return ""
  const day = d.date()
  const month = THAI_MONTHS[d.month()]
  const yearBE = d.year() + 543
  return `${day} ${month} ${yearBE}`
}

export function fmtThaiShort(input: Date | string | Dayjs | null | undefined): string {
  const d = toDayjs(input)
  if (!d) return ""
  const day = d.date()
  const month = THAI_MONTHS_SHORT[d.month()]
  const yearBE = (d.year() + 543) % 100
  return `${day} ${month} ${String(yearBE).padStart(2, "0")}`
}

/**
 * Parse input string จาก user ("21/05/2569" หรือ "21/05/69")
 * คืน Dayjs (ค.ศ.) · null ถ้า invalid
 */
export function parseBE(input: string): Dayjs | null {
  if (!input) return null
  const trimmed = input.trim()

  // try DD/MM/BBBB (full BE year)
  const fullMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  if (fullMatch?.[3]) {
    const [, dd, mm, bbbb] = fullMatch
    const yearCE = Number.parseInt(bbbb, 10) - 543
    const d = dayjs(
      `${yearCE}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`,
      "YYYY-MM-DD",
      true,
    )
    return d.isValid() ? d : null
  }

  // try DD/MM/BB (2-digit BE year · 2-digit assumed 2500-2599)
  const shortMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})$/)
  if (shortMatch?.[3]) {
    const [, dd, mm, bb] = shortMatch
    const yearBE = 2500 + Number.parseInt(bb, 10)
    const yearCE = yearBE - 543
    const d = dayjs(
      `${yearCE}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`,
      "YYYY-MM-DD",
      true,
    )
    return d.isValid() ? d : null
  }

  return null
}

/**
 * Today helpers
 */
export function todayBE(): string {
  return fmtBE(dayjs())
}

/**
 * Calc diff in days (positive = future, negative = past)
 */
export function daysUntil(input: Date | string | Dayjs): number {
  const d = toDayjs(input)
  if (!d) return Number.NaN
  return d.startOf("day").diff(dayjs().startOf("day"), "day")
}
