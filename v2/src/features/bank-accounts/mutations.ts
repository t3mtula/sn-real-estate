import { useMutation, useQueryClient } from '@tanstack/react-query'
import { logActivity } from '@/lib/audit-log'
import { supabase } from '@/lib/supabase'
import type { BankAccountFormValues } from '@/features/bank-accounts/schema'
import type { BankAccountData } from '@/features/bank-accounts/types'

const TABLE = 'bank_accounts'

/**
 * Look up owner landlord name (for cache field)
 */
async function lookupOwnerName(landlordId: string): Promise<string> {
  const trimmed = landlordId.trim()
  if (!trimmed) return ''
  const { data, error } = await supabase
    .from('landlords')
    .select('data')
    .eq('id', trimmed)
    .maybeSingle()
  if (error) return ''
  const d = data?.data as { name?: string } | undefined
  return d?.name?.trim() ?? ''
}

function valuesToManagedFields(
  values: BankAccountFormValues,
  pid: number,
  ownerLandlordName: string,
) {
  return {
    pid,
    bank: values.bank,
    branch: values.branch ?? '',
    acctNo: values.acctNo,
    accountName: values.accountName ?? '',
    label: values.label ?? '',
    ownerLandlordId: values.ownerLandlordId ?? '',
    ownerLandlordName,
    active: values.active !== false,
    notes: values.notes ?? '',
  }
}

/**
 * Create new bank account
 */
export function useCreateBankAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: BankAccountFormValues) => {
      const pid = Date.now()
      // id deterministic if owner specified · UUID-ish fallback otherwise
      const id = values.ownerLandlordId
        ? `${values.ownerLandlordId}-b${String(pid).slice(-6)}`
        : `ba-${pid}`
      const ownerName = await lookupOwnerName(values.ownerLandlordId)
      const managed = valuesToManagedFields(values, pid, ownerName)
      const { error } = await supabase
        .from(TABLE)
        .insert({ id, data: managed })
        .select('id')
        .single()
      if (error) throw error

      // 2026-05-23 M:M refactor — also write junction row so reverse lookups work
      if (values.ownerLandlordId) {
        const { error: linkError } = await supabase
          .from('landlord_banks')
          .upsert(
            {
              landlord_id: values.ownerLandlordId,
              bank_account_id: id,
              is_default: true,
            },
            { onConflict: 'landlord_id,bank_account_id', ignoreDuplicates: false },
          )
        if (linkError) throw linkError
      }

      void logActivity({
        action: 'create',
        entity: 'bank_accounts',
        entity_id: id,
        description: `เพิ่มบัญชีธนาคาร ${managed.bank} · ${managed.acctNo}`,
        after: { bank: managed.bank, acctNo: managed.acctNo, ownerLandlordName: managed.ownerLandlordName },
      })
      return { id, pid }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['bank_accounts'] })
      if (vars.ownerLandlordId) {
        qc.invalidateQueries({ queryKey: ['landlord_banks', 'by-landlord', vars.ownerLandlordId] })
      }
    },
  })
}

/**
 * Update existing bank account — MERGES with existing JSONB
 */
export function useUpdateBankAccount(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: BankAccountFormValues) => {
      const { data: existing, error: readError } = await supabase
        .from(TABLE)
        .select('data')
        .eq('id', id)
        .single()
      if (readError) throw readError

      const existingData = (existing?.data ?? {}) as BankAccountData
      const pid = existingData.pid ?? Date.now()
      const ownerName = await lookupOwnerName(values.ownerLandlordId)
      const managed = valuesToManagedFields(values, pid, ownerName)
      const merged: BankAccountData = { ...existingData, ...managed }

      const { data: updated, error } = await supabase
        .from(TABLE)
        .update({ data: merged, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('id')
      if (error) throw error
      if (!updated || updated.length === 0) {
        throw new Error('ไม่พบบัญชีธนาคาร หรือไม่มีสิทธิ์แก้ไข (RLS)')
      }
      void logActivity({
        action: 'update',
        entity: 'bank_accounts',
        entity_id: id,
        description: `แก้บัญชีธนาคาร ${merged.bank} · ${merged.acctNo}`,
        before: { acctNo: existingData.acctNo, bank: existingData.bank },
        after: { acctNo: merged.acctNo, bank: merged.bank },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank_accounts'] })
      qc.invalidateQueries({ queryKey: ['bank_accounts', id] })
    },
  })
}

/**
 * Delete bank account (hard delete)
 * ⚠ ในอนาคต: ถ้ามี contracts ผูก → caller ควรเตือนก่อน
 */
export function useDeleteBankAccount() {
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
      const d = existing?.data as BankAccountData | undefined
      void logActivity({
        action: 'delete',
        entity: 'bank_accounts',
        entity_id: id,
        description: `ลบบัญชีธนาคาร ${d?.bank ?? ''} · ${d?.acctNo ?? '#' + id}`,
        before: (existing?.data ?? null) as Record<string, unknown> | null,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank_accounts'] })
    },
  })
}
