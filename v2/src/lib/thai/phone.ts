/**
 * Format เบอร์โทรไทย
 *
 * fmtPhone("0812345678")     → "081-234-5678"
 * fmtPhone("022345678")      → "02-234-5678"
 * fmtPhone("1112")           → "1112" (short code)
 * fmtPhone("+66812345678")   → "+66 81-234-5678"
 */
export function fmtPhone(input: string | null | undefined): string {
  if (!input) return ""
  const cleaned = String(input).replace(/[^\d+]/g, "")

  // International (+66...)
  if (cleaned.startsWith("+66")) {
    const rest = cleaned.slice(3)
    return rest.length === 9 ? `+66 ${rest.slice(0, 2)}-${rest.slice(2, 5)}-${rest.slice(5)}` : input
  }

  // Mobile (10 digits: 08x, 09x, 06x)
  if (cleaned.length === 10 && cleaned.startsWith("0")) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }

  // Landline Bangkok (9 digits: 02-xxx-xxxx)
  if (cleaned.length === 9 && cleaned.startsWith("02")) {
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 5)}-${cleaned.slice(5)}`
  }

  // Landline other (9 digits: 0xx-xxx-xxxx)
  if (cleaned.length === 9 && cleaned.startsWith("0")) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }

  return cleaned
}

/**
 * Strip formatting → raw digits (สำหรับ tel: links, DB save)
 */
export function stripPhone(input: string | null | undefined): string {
  if (!input) return ""
  return String(input).replace(/[^\d+]/g, "")
}

/**
 * Validate Thai phone (loose)
 * - mobile: 10 digits starting 06/08/09
 * - landline: 9 digits starting 0
 */
export function isValidPhone(input: string | null | undefined): boolean {
  if (!input) return false
  const cleaned = stripPhone(input).replace(/^\+66/, "0")
  if (cleaned.length === 10) return /^0[689]\d{8}$/.test(cleaned)
  if (cleaned.length === 9) return /^0\d{8}$/.test(cleaned)
  return false
}
