import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { LandlordFormValues } from '@/features/landlords/schema'
import type { LandlordBank, LandlordData } from '@/features/landlords/types'

const TABLE = 'landlords'

/**
 * Filter out empty bank rows + trim
 */
function cleanBanks(banks: LandlordFormValues['banks']): LandlordBank[] {
  return (banks ?? [])
    .map((b) => ({
      bank: (b.bank ?? '').trim(),
      acctNo: (b.acctNo ?? '').trim(),
      accountName: (b.accountName ?? '').trim(),
      label: (b.label ?? '').trim(),
    }))
    .filter((b) => b.bank || b.acctNo || b.accountName)
    .map((b) => {
      // Drop label key when blank to keep JSON clean
      const out: LandlordBank = {
        bank: b.bank,
        acctNo: b.acctNo,
        accountName: b.accountName,
      }
      if (b.label) out.label = b.label
      return out
    })
}

/**
 * Convert form values into the keys we manage in JSONB.
 * NOTE: ค่าจาก form ที่อาจ override field เดิมใน landlord.data — เก็บไว้ใน managed object
 * แล้ว merge กับ existing data ตอน update (เพื่อ preserve v1 fields ที่เรายังไม่ใช้)
 */
function valuesToManagedFields(values: LandlordFormValues, pid: number) {
  return {
    pid,
    name: values.name,
    shortName: values.shortName ?? '',
    partyType: values.partyType,
    taxId: values.taxId ?? '',
    branch: values.branch ?? '',
    phone: values.phone ?? '',
    signerName: values.partyType === 'company' ? (values.signerName ?? '') : '',
    signerTitle: values.partyType === 'company' ? (values.signerTitle ?? '') : '',
    logo: values.logo || null,
    addrLine: values.addrLine ?? '',
    addrSubdistrict: values.addrSubdistrict ?? '',
    addrDistrict: values.addrDistrict ?? '',
    addrProvince: values.addrProvince ?? '',
    addrPostal: values.addrPostal ?? '',
    banks: cleanBanks(values.banks),
    vatRegistered: !!values.vatRegistered,
    vatRate: values.vatRegistered ? (values.vatRate ?? 7) : 0,
    promptPayId: values.promptPayId ?? '',
    promptPayBank: values.promptPayBank ?? '',
    promptPayName: values.promptPayName ?? '',
    notes: values.notes ?? '',
  }
}

/**
 * Pre-flight dup check — ค้น landlord ที่มี taxId เดียวกัน (ยกเว้น self)
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
  const rows = (data ?? []) as Array<{ id: string; data: LandlordData }>
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
 * Create new landlord
 */
export function useCreateLandlord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: LandlordFormValues) => {
      const dup = await findDupByTaxId(values.taxId)
      if (dup) throw new DuplicateTaxIdError(dup.id, dup.name)

      const pid = Date.now()
      const id = String(pid)
      const managed = valuesToManagedFields(values, pid)
      const { error } = await supabase
        .from(TABLE)
        .insert({ id, data: managed })
        .select('id')
        .single()
      if (error) throw error
      return { id, pid }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['landlords'] })
    },
  })
}

/**
 * Update existing landlord — MERGES with existing JSONB to preserve any
 * v1 fields we don't manage explicitly (e.g. invoiceHeaderId backref).
 */
export function useUpdateLandlord(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: LandlordFormValues) => {
      const dup = await findDupByTaxId(values.taxId, id)
      if (dup) throw new DuplicateTaxIdError(dup.id, dup.name)

      const { data: existing, error: readError } = await supabase
        .from(TABLE)
        .select('data')
        .eq('id', id)
        .single()
      if (readError) throw readError

      const existingData = (existing?.data ?? {}) as LandlordData
      const pid = existingData.pid ?? Number.parseInt(id, 10) ?? Date.now()
      const managed = valuesToManagedFields(values, pid)
      const merged: LandlordData = { ...existingData, ...managed }

      const { data: updated, error } = await supabase
        .from(TABLE)
        .update({ data: merged, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('id')
      if (error) throw error
      if (!updated || updated.length === 0) {
        throw new Error('ไม่พบผู้ให้เช่า หรือไม่มีสิทธิ์แก้ไข (RLS)')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['landlords'] })
      qc.invalidateQueries({ queryKey: ['landlords', id] })
    },
  })
}

/**
 * Delete landlord (hard delete)
 * ⚠ ถ้ามีสัญญาผูกอยู่ → caller ควรเตือนก่อน (queries.useLandlordContracts)
 */
export function useDeleteLandlord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(TABLE).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['landlords'] })
    },
  })
}
