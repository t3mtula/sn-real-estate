import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PARTY_TYPES, type Tenant, type TenantData } from '@/features/tenants/types'

const TABLE = 'tenants'

/**
 * Fetch all tenants · sorted by name (Thai locale)
 */
export function useTenants() {
  return useQuery({
    queryKey: ['tenants'],
    queryFn: async (): Promise<Tenant[]> => {
      const { data, error } = await supabase
        .from(TABLE)
        .select('id, data, created_at, updated_at')
      if (error) throw error
      const rows = (data ?? []) as Tenant[]
      // Sort client-side (Thai collation in Postgres ไม่ guaranteed)
      return [...rows].sort((a, b) =>
        (a.data?.name ?? '').localeCompare(b.data?.name ?? '', 'th'),
      )
    },
  })
}

/**
 * Fetch single tenant by ID
 */
export function useTenant(id: string | undefined) {
  return useQuery({
    queryKey: ['tenants', id],
    queryFn: async (): Promise<Tenant | null> => {
      if (!id) return null
      const { data, error } = await supabase
        .from(TABLE)
        .select('id, data, created_at, updated_at')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data as Tenant | null
    },
    enabled: !!id,
  })
}

/**
 * Contracts ที่ผูกกับ tenant รายนี้ — derive ตอน runtime
 * Strategy:
 *   1. ถ้า contract.data.tenant_id === tenant.id → match ตรง (สัญญาใหม่ที่ v2 สร้าง)
 *   2. ถ้า contract.data.taxId === tenant.data.taxId (และไม่ว่าง) → match
 *   3. ถ้า contract.data.tenant === tenant.data.name → match (fallback v1 data)
 *
 * Return: contracts ทั้งหมดที่ match (อาจซ้อนกัน)
 */
export function useTenantContracts(tenant: Tenant | null | undefined) {
  return useQuery({
    queryKey: ['tenant-contracts', tenant?.id],
    queryFn: async () => {
      if (!tenant) return [] as Array<{ id: string; data: Record<string, unknown> }>
      const { data, error } = await supabase
        .from('contracts')
        .select('id, data')
      if (error) throw error
      const all = (data ?? []) as Array<{
        id: string
        data: Record<string, unknown> & {
          tenant_id?: string
          taxId?: string
          tenant?: string
        }
      }>
      const tax = (tenant.data.taxId ?? '').trim()
      const nm = (tenant.data.name ?? '').trim()
      return all.filter((c) => {
        if (c.data.tenant_id === tenant.id) return true
        if (tax && c.data.taxId === tax) return true
        if (!tax && c.data.tenant === nm) return true
        return false
      })
    },
    enabled: !!tenant,
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

export function getTenantName(t: TenantData | undefined): string {
  return t?.name?.trim() || '(ไม่มีชื่อ)'
}

/**
 * Format taxId for display (Thai national ID = 13 digits → 1-2345-67890-12-3)
 * passport ปล่อย raw
 */
export function fmtTaxId(taxId: string | undefined): string {
  const raw = (taxId ?? '').replace(/[^A-Za-z0-9]/g, '')
  if (!raw) return ''
  if (/^\d{13}$/.test(raw)) {
    return `${raw[0]}-${raw.slice(1, 5)}-${raw.slice(5, 10)}-${raw.slice(10, 12)}-${raw[12]}`
  }
  return raw
}

export function getTenantAddrShort(t: TenantData | undefined): string {
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
