/**
 * เลขประจำตัวประชาชน 13 หลัก · validation + format
 *
 * fmtCitizenId("1234567890123")  → "1-2345-67890-12-3"
 * isValidCitizenId("1234567890123") → boolean
 */

export function stripCitizenId(input: string | null | undefined): string {
  if (!input) return ""
  return String(input).replace(/\D/g, "")
}

export function fmtCitizenId(input: string | null | undefined): string {
  const cleaned = stripCitizenId(input)
  if (cleaned.length !== 13) return cleaned
  return `${cleaned[0]}-${cleaned.slice(1, 5)}-${cleaned.slice(5, 10)}-${cleaned.slice(10, 12)}-${cleaned[12]}`
}

/**
 * Validate ใช้ algorithm ของกรมการปกครอง
 * Sum (digit[i] * (13-i)) for i=0..11 · mod 11 · 11 - result · mod 10 = check digit[12]
 */
export function isValidCitizenId(input: string | null | undefined): boolean {
  const cleaned = stripCitizenId(input)
  if (cleaned.length !== 13) return false
  if (!/^\d{13}$/.test(cleaned)) return false

  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = Number(cleaned[i])
    sum += digit * (13 - i)
  }
  const checkDigit = (11 - (sum % 11)) % 10
  return checkDigit === Number(cleaned[12])
}

/**
 * เลขประจำตัวผู้เสียภาษี / เลข VAT (13 หลัก) · share algorithm
 */
export const isValidTaxId = isValidCitizenId
export const fmtTaxId = fmtCitizenId
export const stripTaxId = stripCitizenId
