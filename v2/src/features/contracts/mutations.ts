import { useMutation, useQueryClient } from '@tanstack/react-query'
import { logActivity } from '@/lib/audit-log'
import { supabase } from '@/lib/supabase'
import { parseBE } from '@/lib/thai'
import { assembleAddress } from '@/lib/thai-address'
import type { ContractFormValues } from '@/features/contracts/schema'
import type { ContractData } from '@/features/contracts/types'

const TABLE = 'contracts'

/**
 * Custom error · duplicate contract number
 */
export class DuplicateContractNoError extends Error {
  conflictId: string
  conflictTenant: string
  constructor(conflictId: string, conflictTenant: string) {
    super(`เลขสัญญาซ้ำ (อยู่ที่ ${conflictTenant})`)
    this.name = 'DuplicateContractNoError'
    this.conflictId = conflictId
    this.conflictTenant = conflictTenant
  }
}

/**
 * Convert form values to ContractData (managed fields)
 *
 * Notes:
 * - pid_property: number (from property.data.pid)
 * - tenant_id / landlord_id / bankAccountId / parent_contract_id: string FK
 * - Dual-write: คงเก็บ inline strings (tenant, landlord) สำหรับ v1 backward
 *   compat · resolved จาก linked entities ใน caller (ไม่ใช่ใน mutation)
 */
function valuesToManagedFields(
  values: ContractFormValues,
  pid: number,
  inline: {
    tenantName?: string
    landlordName?: string
    taxId?: string
  } = {},
): Partial<ContractData> {
  return {
    pid,
    no: values.no.trim(),
    pid_property: values.pid_property
      ? Number.parseInt(values.pid_property, 10) || undefined
      : undefined,
    tenant_id: values.tenant_id || undefined,
    landlord_id: values.landlord_id || undefined,
    bankAccountId: values.bankAccountId || undefined,
    parent_contract_id: values.parent_contract_id || undefined,
    start: values.start.trim(),
    end: values.end.trim(),
    rate: values.rate,
    deposit: values.deposit,
    dur: values.dur,
    payment: values.payment.trim(),
    purpose: values.purpose.trim(),
    // madeAt = ที่อยู่ 5 ช่อง + assembled string (backward compat กับ v1 + PDF)
    // camelCase ตาม Tenant/Landlord convention
    madeAtLine: values.madeAtLine ?? '',
    madeAtSubdistrict: values.madeAtSubdistrict ?? '',
    madeAtDistrict: values.madeAtDistrict ?? '',
    madeAtProvince: values.madeAtProvince ?? '',
    madeAtPostal: values.madeAtPostal ?? '',
    madeAt: assembleAddress({
      line: values.madeAtLine,
      subdistrict: values.madeAtSubdistrict,
      district: values.madeAtDistrict,
      province: values.madeAtProvince,
      postal: values.madeAtPostal,
    }),
    madeDate: values.madeDate.trim(),
    wit1: values.wit1.trim(),
    wit2: values.wit2.trim(),
    // Inline strings for v1 backward compat
    tenant: inline.tenantName,
    landlord: inline.landlordName,
    taxId: inline.taxId,
  }
}

/**
 * Check duplicate contract number (excluding self in edit mode)
 */
async function checkDuplicateContractNo(no: string, excludeId?: string) {
  const trimmed = no.trim()
  if (!trimmed) return null
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, data->>tenant')
    .eq('data->>no', trimmed)
  if (error) throw error
  const conflict = (data ?? []).find((r: { id: string }) => r.id !== excludeId)
  if (!conflict) return null
  return {
    id: (conflict as { id: string }).id,
    tenant: ((conflict as Record<string, unknown>).tenant as string) ?? '',
  }
}

/**
 * Create new contract
 */
export function useCreateContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      values: ContractFormValues
      inline?: { tenantName?: string; landlordName?: string; taxId?: string }
    }) => {
      const { values, inline } = input

      // Duplicate check
      const dup = await checkDuplicateContractNo(values.no)
      if (dup) throw new DuplicateContractNoError(dup.id, dup.tenant)

      const pid = Date.now()
      const id = String(pid)
      const managed = valuesToManagedFields(values, pid, inline)
      const { error } = await supabase
        .from(TABLE)
        .insert({ id, data: managed })
        .select('id')
        .single()
      if (error) throw error
      void logActivity({
        action: 'create',
        entity: 'contracts',
        entity_id: id,
        description: `สร้างสัญญา ${managed.no ?? '#' + id} · ${managed.tenant ?? '—'}`,
        after: { no: managed.no, tenant: managed.tenant, start: managed.start, end: managed.end },
      })
      return { id, pid }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      qc.invalidateQueries({ queryKey: ['contracts-match-keys'] })
    },
  })
}

/**
 * Generic merge-update helper · used by lifecycle mutations
 * (cancel/restore/move-out) ที่แก้แค่บาง field ของ data jsonb
 */
async function mergeUpdateContract(
  id: string,
  patch: Partial<ContractData> & Record<string, unknown>,
) {
  const { data: existing, error: readError } = await supabase
    .from(TABLE)
    .select('data')
    .eq('id', id)
    .single()
  if (readError) throw readError

  const existingData = (existing?.data ?? {}) as ContractData
  const merged: ContractData = { ...existingData, ...patch }
  // Remove undefined keys (allow explicit delete via undefined)
  for (const k of Object.keys(patch)) {
    if (patch[k] === undefined) delete (merged as Record<string, unknown>)[k]
  }

  const { data: updated, error } = await supabase
    .from(TABLE)
    .update({ data: merged, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (!updated || updated.length === 0) {
    throw new Error('ไม่พบสัญญา หรือไม่มีสิทธิ์แก้ไข (RLS)')
  }
}

/**
 * Update existing contract — MERGES with existing JSONB
 * to preserve fields we don't manage (cf, clauseOverrides, notice*, etc.)
 */
export function useUpdateContract(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      values: ContractFormValues
      inline?: { tenantName?: string; landlordName?: string; taxId?: string }
    }) => {
      const { values, inline } = input

      // Duplicate check (excluding self)
      const dup = await checkDuplicateContractNo(values.no, id)
      if (dup) throw new DuplicateContractNoError(dup.id, dup.tenant)

      // Read existing for merge
      const { data: existing, error: readError } = await supabase
        .from(TABLE)
        .select('data')
        .eq('id', id)
        .single()
      if (readError) throw readError

      const existingData = (existing?.data ?? {}) as ContractData
      const pid = existingData.pid ?? Number.parseInt(id, 10) ?? Date.now()
      const managed = valuesToManagedFields(values, pid, inline)
      const merged: ContractData = { ...existingData, ...managed }

      const { data: updated, error } = await supabase
        .from(TABLE)
        .update({ data: merged, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('id')
      if (error) throw error
      if (!updated || updated.length === 0) {
        throw new Error('ไม่พบสัญญา หรือไม่มีสิทธิ์แก้ไข (RLS)')
      }
      void logActivity({
        action: 'update',
        entity: 'contracts',
        entity_id: id,
        description: `แก้สัญญา ${merged.no ?? '#' + id} · ${merged.tenant ?? '—'}`,
        before: { no: existingData.no, rate: existingData.rate, start: existingData.start, end: existingData.end },
        after: { no: merged.no, rate: merged.rate, start: merged.start, end: merged.end },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      qc.invalidateQueries({ queryKey: ['contracts', id] })
      qc.invalidateQueries({ queryKey: ['contracts-match-keys'] })
    },
  })
}

/**
 * Cancel contract · set cancelled=true + dates + reason · save originalEnd
 * so we can restore later
 *
 * Mirror v1 logic (modules/14-contracts.js cancelContract):
 *   c.cancelled = true
 *   c.cancelledDate = cancelDate
 *   c.cancelledReason = reason
 *   c.originalEnd = c.originalEnd || c.end
 *   c.end = cancelDate
 */
export function useCancelContract(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { cancelDate: string; reason: string }) => {
      const { cancelDate, reason } = input
      if (!parseBE(cancelDate)) {
        throw new Error('วันที่ยกเลิกไม่ถูกต้อง (รูปแบบ dd/mm/yyyy พ.ศ.)')
      }
      // Read first so we can preserve originalEnd
      const { data: existing, error } = await supabase
        .from(TABLE)
        .select('data')
        .eq('id', id)
        .single()
      if (error) throw error
      const c = (existing?.data ?? {}) as ContractData
      await mergeUpdateContract(id, {
        cancelled: true,
        cancelledDate: cancelDate,
        cancelledReason: reason,
        originalEnd: c.originalEnd ?? c.end,
        end: cancelDate,
      })
      void logActivity({
        action: 'update',
        entity: 'contracts',
        entity_id: id,
        description: `ยกเลิกสัญญา ${c.no ?? '#' + id} · เหตุผล: ${reason?.trim() || '(ไม่ระบุ)'}`,
        after: { cancelled: true, cancelledDate: cancelDate, cancelledReason: reason },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      qc.invalidateQueries({ queryKey: ['contracts', id] })
      qc.invalidateQueries({ queryKey: ['contracts-match-keys'] })
    },
  })
}

/**
 * Restore cancelled contract · reverse of cancel
 *
 * Mirror v1: restore end from originalEnd · delete cancel fields
 */
export function useRestoreContract(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data: existing, error } = await supabase
        .from(TABLE)
        .select('data')
        .eq('id', id)
        .single()
      if (error) throw error
      const c = (existing?.data ?? {}) as ContractData
      await mergeUpdateContract(id, {
        cancelled: false,
        cancelledDate: undefined,
        cancelledReason: undefined,
        originalEnd: undefined,
        end: c.originalEnd ?? c.end,
      })
      void logActivity({
        action: 'restore',
        entity: 'contracts',
        entity_id: id,
        description: `คืนสภาพสัญญา ${c.no ?? '#' + id}`,
        after: { cancelled: false, end: c.originalEnd ?? c.end },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      qc.invalidateQueries({ queryKey: ['contracts', id] })
      qc.invalidateQueries({ queryKey: ['contracts-match-keys'] })
    },
  })
}

/**
 * Update/set move-out notice · v1: noticeDate + plannedMoveOut + noticeNote
 * Empty noticeDate = clear notice
 */
export function useUpdateMoveOutNotice(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      noticeDate: string
      plannedMoveOut: string
      noticeNote: string
    }) => {
      const trimmedNotice = input.noticeDate.trim()
      const trimmedPlanned = input.plannedMoveOut.trim()
      if (trimmedNotice) {
        if (!parseBE(trimmedNotice)) {
          throw new Error('วันแจ้งย้ายออกไม่ถูกต้อง')
        }
        if (trimmedPlanned && !parseBE(trimmedPlanned)) {
          throw new Error('วันที่จะออกจริงไม่ถูกต้อง')
        }
      }
      await mergeUpdateContract(id, {
        noticeDate: trimmedNotice || undefined,
        plannedMoveOut: trimmedPlanned || undefined,
        noticeNote: input.noticeNote.trim() || undefined,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      qc.invalidateQueries({ queryKey: ['contracts', id] })
    },
  })
}

/** Save per-contract clause overrides */
export function useUpdateContractClauses(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (overrides: Record<string, string>) => {
      await mergeUpdateContract(id, { clauseOverrides: overrides })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      qc.invalidateQueries({ queryKey: ['contracts', id] })
    },
  })
}
