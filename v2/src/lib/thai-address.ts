import { THAI_ADDRESS_DATA, type ThaiAddressEntry } from '@/lib/thai-address-data'

export type ThaiAddress = {
  subdistrict: string
  district: string
  province: string
  postal: string
}

export const EMPTY_THAI_ADDRESS: ThaiAddress = {
  subdistrict: '',
  district: '',
  province: '',
  postal: '',
}

/**
 * Search by free-text query · matches against subdistrict/district/province/postal
 * Returns up to `limit` entries, most-relevant first (prefix matches > contains)
 */
export function searchThaiAddress(
  query: string,
  limit = 40
): ThaiAddressEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  // Numeric query (likely postal code) — match postal first
  if (/^\d+$/.test(q)) {
    return THAI_ADDRESS_DATA.filter((e) => e[3].startsWith(q)).slice(0, limit)
  }

  const prefix: ThaiAddressEntry[] = []
  const contains: ThaiAddressEntry[] = []

  for (const e of THAI_ADDRESS_DATA) {
    const [s, d, p] = e
    const sL = s.toLowerCase()
    const dL = d.toLowerCase()
    const pL = p.toLowerCase()

    if (sL.startsWith(q) || dL.startsWith(q) || pL.startsWith(q)) {
      prefix.push(e)
    } else if (sL.includes(q) || dL.includes(q) || pL.includes(q)) {
      contains.push(e)
    }
    if (prefix.length >= limit) break
  }

  return [...prefix, ...contains].slice(0, limit)
}

/**
 * Format entry as display label · "ตำบล, อำเภอ, จังหวัด 12345"
 */
export function formatAddressEntry(entry: ThaiAddressEntry): string {
  const [s, d, p, z] = entry
  return `${s}, ${d}, ${p} ${z}`
}

/**
 * Convert entry → ThaiAddress
 */
export function entryToAddress(entry: ThaiAddressEntry): ThaiAddress {
  const [subdistrict, district, province, postal] = entry
  return { subdistrict, district, province, postal }
}

/**
 * Assemble full address line from structured parts
 * e.g. "123 หมู่ 5 ถ.ลาดพร้าว ตำบลพระโขนง อำเภอวัฒนา จังหวัดกรุงเทพมหานคร 10110"
 */
export function assembleAddress(parts: {
  line?: string
  subdistrict?: string
  district?: string
  province?: string
  postal?: string
}): string {
  const segments: string[] = []
  if (parts.line) segments.push(parts.line.trim())

  const isBangkok = (parts.province ?? '').includes('กรุงเทพ')

  if (parts.subdistrict) {
    segments.push(`${isBangkok ? 'แขวง' : 'ตำบล'}${parts.subdistrict}`)
  }
  if (parts.district) {
    segments.push(`${isBangkok ? 'เขต' : 'อำเภอ'}${parts.district.replace(/^เขต/, '')}`)
  }
  if (parts.province) {
    segments.push(`${isBangkok ? '' : 'จังหวัด'}${parts.province}`.trim())
  }
  if (parts.postal) segments.push(parts.postal)

  return segments.filter(Boolean).join(' ')
}
