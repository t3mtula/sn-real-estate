import { useMutation, useQueryClient } from '@tanstack/react-query'
import { logActivity } from '@/lib/audit-log'
import { supabase } from '@/lib/supabase'
import { parseBE } from '@/lib/thai'
import { assembleAddress } from '@/lib/thai-address'
import type { ContractFormValues } from '@/features/contracts/schema'
import type { ContractData, DepositReturn, MoveOutInspection } from '@/features/contracts/types'

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
  // Compute structured dur fields
  const durTotalMonths = values.dur
  const durYears = Math.floor(durTotalMonths / 12)
  const durRemMonths = durTotalMonths % 12
  const durStr =
    durYears > 0 && durRemMonths === 0 ? `${durYears} ปี`
    : durYears > 0 ? `${durYears} ปี ${durRemMonths} เดือน`
    : `${durTotalMonths} เดือน`

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
    templateId: values.templateId || undefined,
    start: values.start.trim(),
    end: values.end.trim(),
    rate: values.rate.trim() || undefined,
    rateAmount: values.rateAmount || undefined,
    rateIntervalMonths: values.rateIntervalMonths,
    billingStart: values.billingStart.trim() || undefined,
    deposit: values.deposit,
    dur: durStr,
    durMonths: durTotalMonths,
    durRaw: durStr,
    payment: values.payment.trim(),
    purpose: values.purpose.trim(),
    // madeAt = ที่อยู่ 5 ช่อง + assembled string (backward compat กับ v1 + PDF).
    // Legacy contracts only had `madeAt` (combined string). When editing, we
    // populate madeAtLine from it but the 4 sub-fields stay empty. If we
    // overwrite blindly we'd wipe the original address. Strategy: only
    // include sub-fields that user actually provided; let merge keep the rest.
    // The `madeAt` reassembly only runs when at least one sub-field exists.
    madeAtLine: values.madeAtLine ?? '',
    ...(values.madeAtSubdistrict ? { madeAtSubdistrict: values.madeAtSubdistrict } : {}),
    ...(values.madeAtDistrict ? { madeAtDistrict: values.madeAtDistrict } : {}),
    ...(values.madeAtProvince ? { madeAtProvince: values.madeAtProvince } : {}),
    ...(values.madeAtPostal ? { madeAtPostal: values.madeAtPostal } : {}),
    ...(values.madeAtSubdistrict || values.madeAtDistrict || values.madeAtProvince
      ? {
          madeAt: assembleAddress({
            line: values.madeAtLine,
            subdistrict: values.madeAtSubdistrict,
            district: values.madeAtDistrict,
            province: values.madeAtProvince,
            postal: values.madeAtPostal,
          }),
        }
      : {}),
    spot: values.spot.trim() || undefined,
    dueDay: values.dueDay || 5,
    rateAdj: values.rateAdj.trim() || undefined,
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
      meta?: {
        renewedFrom?: string
        copiedFrom?: string
        /** ข้อสัญญาที่แก้เฉพาะสัญญาต้นทาง — ติดมาตอนต่อ/คัดลอก */
        contractClauses?: Array<{ text: string; sub?: string[] }>
      }
    }) => {
      const { values, inline, meta } = input

      // Duplicate check
      const dup = await checkDuplicateContractNo(values.no)
      if (dup) throw new DuplicateContractNoError(dup.id, dup.tenant)

      const pid = Date.now()
      const id = String(pid)
      const managed = valuesToManagedFields(values, pid, inline)
      if (meta?.renewedFrom) managed.renewedFrom = meta.renewedFrom
      if (meta?.copiedFrom) managed.copiedFrom = meta.copiedFrom
      if (meta?.contractClauses?.length) managed.contractClauses = meta.contractClauses
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
        before: existingData,
        after: merged,
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

/**
 * Record move-out inspection · saves to contract.data.inspection
 */
export function useRecordInspection(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (inspection: MoveOutInspection) => {
      const { data: existing, error } = await supabase
        .from(TABLE)
        .select('data')
        .eq('id', id)
        .single()
      if (error) throw error
      const c = (existing?.data ?? {}) as ContractData
      await mergeUpdateContract(id, { inspection })
      void logActivity({
        action: 'update',
        entity: 'contracts',
        entity_id: id,
        description: `บันทึกผลตรวจรับคืน ${c.no ?? '#' + id} · หักรวม ${inspection.totalDeduction} บาท`,
        after: { inspection },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      qc.invalidateQueries({ queryKey: ['contracts', id] })
    },
  })
}

/**
 * Record deposit return · saves to contract.data.depositReturn + marks closed
 */
export function useRecordDepositReturn(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (depositReturn: DepositReturn) => {
      const { data: existing, error } = await supabase
        .from(TABLE)
        .select('data')
        .eq('id', id)
        .single()
      if (error) throw error
      const c = (existing?.data ?? {}) as ContractData
      await mergeUpdateContract(id, { depositReturn, closed: true })
      void logActivity({
        action: 'update',
        entity: 'contracts',
        entity_id: id,
        description: `บันทึกคืนเงินประกัน ${c.no ?? '#' + id} · คืน ${depositReturn.refundAmount} บาท · ปิดสัญญา`,
        after: { depositReturn, closed: true },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      qc.invalidateQueries({ queryKey: ['contracts', id] })
      qc.invalidateQueries({ queryKey: ['contracts-match-keys'] })
    },
  })
}

/** Save per-contract clause overrides (legacy · deprecated) */
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

/** Save full per-contract clause snapshot (replaces legacy clauseOverrides) */
export function useUpdateContractClausesFull(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (contractClauses: Array<{ text: string; sub?: string[] }>) => {
      const { data: existing } = await supabase
        .from(TABLE).select('data').eq('id', id).single()
      const prev = ((existing?.data as ContractData | undefined)?.contractClauses ?? []) as Array<{ text: string; sub?: string[] }>
      await mergeUpdateContract(id, { contractClauses })

      // Compute which clause numbers actually changed (1-indexed)
      const maxLen = Math.max(prev.length, contractClauses.length)
      const changedNos: number[] = []
      for (let i = 0; i < maxLen; i++) {
        const p = prev[i]
        const a = contractClauses[i]
        if (!p || !a) { changedNos.push(i + 1); continue }
        const ps = p.sub ?? []
        const as_ = a.sub ?? []
        const textChanged = p.text !== a.text
        const subChanged = ps.length !== as_.length || ps.some((s, j) => s !== as_[j])
        if (textChanged || subChanged) changedNos.push(i + 1)
      }
      const nos = changedNos.slice(0, 4)
      const suffix = changedNos.length > 4 ? ` (+${changedNos.length - 4})` : ''
      const clauseStr = nos.length > 0 ? `ข้อ ${nos.join(', ')}${suffix}` : `(${contractClauses.length} ข้อ ไม่มีการเปลี่ยนแปลง)`

      void logActivity({
        action: 'update',
        entity: 'contracts',
        entity_id: id,
        description: `แก้ข้อสัญญา ${clauseStr}`,
        before: { contractClauses: prev },
        after: { contractClauses },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      qc.invalidateQueries({ queryKey: ['contracts', id] })
    },
  })
}

/**
 * Update renewalStatus on a contract
 */
export function useSetRenewalStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string
      status: ContractData['renewalStatus']
    }) => {
      await mergeUpdateContract(id, { renewalStatus: status })
      void logActivity({
        action: 'update',
        entity: 'contracts',
        entity_id: id,
        description: `อัปเดตสถานะต่อสัญญา → ${status ?? 'pending'}`,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
    },
  })
}

/**
 * Suggest next contract number in SN.NNN-YYYY format
 * Finds max sequential number across all contracts for current BE year
 * If renewedFromNo provided, suggests ORIGINAL_NO-R1 (or R2, R3 etc.)
 */
export function useSuggestContractNo() {
  return useMutation({
    mutationFn: async (opts?: { renewedFromNo?: string }): Promise<string> => {
      const beYear = new Date().getFullYear() + 543
      const { data, error } = await supabase.from('contracts').select('id, data')
      if (error) throw error

      const nos: string[] = ((data ?? []) as Array<{ data: ContractData }>)
        .map((r) => r.data?.no ?? '')
        .filter(Boolean)

      // If renewing, suggest ORIGINAL_NO-R1 (or R2, R3 etc.)
      if (opts?.renewedFromNo) {
        const base = opts.renewedFromNo.replace(/-R\d+$/, '') // strip existing -Rx
        let n = 1
        while (nos.includes(`${base}-R${n}`)) n++
        return `${base}-R${n}`
      }

      // Find max SN.NNN-YYYY number for current year
      let maxNum = 0
      const pattern = new RegExp(`^SN\\.(\\d+)-${beYear}$`)
      nos.forEach((no) => {
        const m = no.match(pattern)
        if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10))
      })
      const next = String(maxNum + 1).padStart(3, '0')
      return `SN.${next}-${beYear}`
    },
  })
}
