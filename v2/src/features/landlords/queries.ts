import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  PARTY_TYPES,
  type Landlord,
  type LandlordData,
} from '@/features/landlords/types'

const TABLE = 'landlords'

/**
 * Fetch all landlords · sorted by name (Thai locale)
 */
export function useLandlords() {
  return useQuery({
    queryKey: ['landlords'],
    queryFn: async (): Promise<Landlord[]> => {
      const { data, error } = await supabase
        .from(TABLE)
        .select('id, data, created_at, updated_at')
      if (error) throw error
      const rows = (data ?? []) as Landlord[]
      return [...rows].sort((a, b) =>
        (a.data?.name ?? '').localeCompare(b.data?.name ?? '', 'th'),
      )
    },
  })
}

/**
 * Fetch single landlord by ID
 */
export function useLandlord(id: string | undefined) {
  return useQuery({
    queryKey: ['landlords', id],
    queryFn: async (): Promise<Landlord | null> => {
      if (!id) return null
      const { data, error } = await supabase
        .from(TABLE)
        .select('id, data, created_at, updated_at')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data as Landlord | null
    },
    enabled: !!id,
  })
}

/**
 * Contracts ที่ผูกกับ landlord รายนี้ — derive runtime
 * Strategy:
 *   1. contract.data.landlord_id === landlord.id → v2 native FK
 *   2. contract.data.invHeaderId === landlord.data.invoiceHeaderId → v1 link
 *   3. contract.data.landlord === landlord.data.name → fallback ชื่อตรงกัน
 */
export function useLandlordContracts(landlord: Landlord | null | undefined) {
  return useQuery({
    queryKey: [
      'landlord-contracts',
      landlord?.id,
      landlord?.data.invoiceHeaderId,
      landlord?.data.name,
    ],
    queryFn: async () => {
      if (!landlord)
        return [] as Array<{ id: string; data: Record<string, unknown> }>
      const { data, error } = await supabase
        .from('contracts')
        .select('id, data')
      if (error) throw error
      const all = (data ?? []) as Array<{
        id: string
        data: Record<string, unknown> & {
          landlord_id?: string
          invHeaderId?: string
          landlord?: string
        }
      }>
      const headerId = (landlord.data.invoiceHeaderId ?? '').trim()
      const nm = (landlord.data.name ?? '').trim()
      return all.filter((c) => {
        if (c.data.landlord_id === landlord.id) return true
        if (headerId && c.data.invHeaderId === headerId) return true
        if (c.data.landlord === nm) return true
        return false
      })
    },
    enabled: !!landlord,
  })
}

/* ---------- helpers ---------- */

const PARTY_LABEL: Record<string, string> = Object.fromEntries(
  PARTY_TYPES.map((p) => [p.value, p.label]),
)

export function getPartyLabel(value: string | undefined): string {
  if (!value) return '—'
  return PARTY_LABEL[value] ?? value
}

export function getLandlordName(t: LandlordData | undefined): string {
  return t?.name?.trim() || '(ไม่มีชื่อ)'
}

export function getLandlordShortName(t: LandlordData | undefined): string {
  return t?.shortName?.trim() || t?.name?.trim() || '(ไม่มีชื่อ)'
}

/**
 * Format taxId for display (Thai national ID = 13 digits → 1-2345-67890-12-3)
 */
export function fmtTaxId(taxId: string | undefined): string {
  const raw = (taxId ?? '').replace(/[^A-Za-z0-9]/g, '')
  if (!raw) return ''
  if (/^\d{13}$/.test(raw)) {
    return `${raw[0]}-${raw.slice(1, 5)}-${raw.slice(5, 10)}-${raw.slice(10, 12)}-${raw[12]}`
  }
  return raw
}

export function getLandlordAddrShort(t: LandlordData | undefined): string {
  if (!t) return ''
  const parts = [
    t.addrLine,
    t.addrSubdistrict && `ต.${t.addrSubdistrict}`,
    t.addrDistrict && `อ.${t.addrDistrict}`,
    t.addrProvince && `จ.${t.addrProvince}`,
    t.addrPostal,
  ].filter(Boolean)
  return parts.join(' ').trim() || '—'
}

/** Bank count (รวมเฉพาะ rows ที่มีข้อมูลจริง) */
export function getLandlordBankCount(t: LandlordData | undefined): number {
  if (!t?.banks) return 0
  return t.banks.filter((b) => (b.bank ?? '').trim() || (b.acctNo ?? '').trim())
    .length
}
