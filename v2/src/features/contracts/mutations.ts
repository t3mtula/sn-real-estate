import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
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
    madeAt: values.madeAt.trim(),
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
      return { id, pid }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      qc.invalidateQueries({ queryKey: ['contracts-match-keys'] })
    },
  })
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
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      qc.invalidateQueries({ queryKey: ['contracts', id] })
      qc.invalidateQueries({ queryKey: ['contracts-match-keys'] })
    },
  })
}
