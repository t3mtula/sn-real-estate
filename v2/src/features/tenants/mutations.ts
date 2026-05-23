import { useMutation, useQueryClient } from '@tanstack/react-query'
import { logActivity } from '@/lib/audit-log'
import { supabase } from '@/lib/supabase'
import type { TenantFormValues } from '@/features/tenants/schema'
import type { TenantData } from '@/features/tenants/types'

const TABLE = 'tenants'

/**
 * Convert form values into the keys we manage in JSONB.
 */
function valuesToManagedFields(values: TenantFormValues, pid: number) {
  return {
    pid,
    name: values.name,
    partyType: values.partyType,
    taxId: values.taxId ?? '',
    branch: values.branch ?? '',
    phone: values.phone ?? '',
    // signerName/Title ใช้เฉพาะนิติบุคคล · ถ้าเป็นบุคคลธรรมดา ล้างทิ้ง
    signerName: values.partyType === 'company' ? (values.signerName ?? '') : '',
    signerTitle: values.partyType === 'company' ? (values.signerTitle ?? '') : '',
    addrLine: values.addrLine ?? '',
    addrSubdistrict: values.addrSubdistrict ?? '',
    addrDistrict: values.addrDistrict ?? '',
    addrProvince: values.addrProvince ?? '',
    addrPostal: values.addrPostal ?? '',
    witnesses: (values.witnesses ?? [])
      .map((w) => w.trim())
      .filter((w) => w.length > 0),
  }
}

/**
 * Pre-flight dup check: ค้น tenant ที่มี taxId เดียวกัน (ยกเว้น self)
 * Returns id ของ tenant ที่ชน หรือ null ถ้าไม่ชน
 */
async function findDupByTaxId(
  taxId: string,
  excludeId?: string,
): Promise<{ id: string; name: string } | null> {
  const trimmed = taxId.trim()
  if (!trimmed) return null
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, data')
    .eq('data->>taxId', trimmed)
    .limit(2)
  if (error) throw error
  const rows = (data ?? []) as Array<{ id: string; data: TenantData }>
  const hit = rows.find((r) => r.id !== excludeId)
  if (!hit) return null
  return { id: hit.id, name: hit.data?.name ?? '(ไม่มีชื่อ)' }
}

export class DuplicateTaxIdError extends Error {
  constructor(
    public readonly conflictId: string,
    public readonly conflictName: string,
  ) {
    super(`เลขผู้เสียภาษีนี้มีอยู่แล้วในชื่อ "${conflictName}"`)
    this.name = 'DuplicateTaxIdError'
  }
}

/**
 * Create new tenant
 */
export function useCreateTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: TenantFormValues) => {
      // 1. Dup check (pre-flight — friendly error before hitting unique index)
      const dup = await findDupByTaxId(values.taxId)
      if (dup) throw new DuplicateTaxIdError(dup.id, dup.name)

      // 2. Insert
      const pid = Date.now()
      const id = String(pid)
      const managed = valuesToManagedFields(values, pid)
      const { error } = await supabase
        .from(TABLE)
        .insert({ id, data: managed })
        .select('id')
        .single()
      if (error) throw error
      void logActivity({
        action: 'create',
        entity: 'tenants',
        entity_id: id,
        description: `เพิ่มผู้เช่า ${managed.name}`,
        after: { name: managed.name, taxId: managed.taxId },
      })
      return { id, pid }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] })
    },
  })
}

/**
 * Update existing tenant — MERGES with existing JSONB to preserve any
 * v1 fields we don't manage explicitly.
 */
export function useUpdateTenant(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: TenantFormValues) => {
      // 1. Dup check (allow self)
      const dup = await findDupByTaxId(values.taxId, id)
      if (dup) throw new DuplicateTaxIdError(dup.id, dup.name)

      // 2. Read existing
      const { data: existing, error: readError } = await supabase
        .from(TABLE)
        .select('data')
        .eq('id', id)
        .single()
      if (readError) throw readError

      const existingData = (existing?.data ?? {}) as TenantData
      const pid = existingData.pid ?? Number.parseInt(id, 10) ?? Date.now()
      const managed = valuesToManagedFields(values, pid)
      const merged: TenantData = { ...existingData, ...managed }

      // 3. Update
      const { data: updated, error } = await supabase
        .from(TABLE)
        .update({ data: merged, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('id')
      if (error) throw error
      if (!updated || updated.length === 0) {
        throw new Error('ไม่พบผู้เช่า หรือไม่มีสิทธิ์แก้ไข (RLS)')
      }
      void logActivity({
        action: 'update',
        entity: 'tenants',
        entity_id: id,
        description: `แก้ผู้เช่า ${merged.name}`,
        before: { name: existingData.name, phone: existingData.phone },
        after: { name: merged.name, phone: merged.phone },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] })
      qc.invalidateQueries({ queryKey: ['tenants', id] })
    },
  })
}

/**
 * Delete tenant (hard delete · v2 ไม่มี soft delete column)
 * ⚠ ถ้ามีสัญญาผูกอยู่ → caller ควรเตือนก่อน (queries.useTenantContracts)
 */
export function useDeleteTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: existing } = await supabase
        .from(TABLE)
        .select('data')
        .eq('id', id)
        .maybeSingle()
      const { error } = await supabase.from(TABLE).delete().eq('id', id)
      if (error) throw error
      void logActivity({
        action: 'delete',
        entity: 'tenants',
        entity_id: id,
        description: `ลบผู้เช่า ${(existing?.data as TenantData | undefined)?.name ?? '#' + id}`,
        before: (existing?.data ?? null) as Record<string, unknown> | null,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] })
    },
  })
}
