import { useMutation, useQueryClient } from '@tanstack/react-query'
import { logActivity } from '@/lib/audit-log'
import { supabase } from '@/lib/supabase'

const TABLE = 'landlord_banks'

/**
 * Link a landlord to a bank account (idempotent — ON CONFLICT does nothing).
 */
export function useAddLandlordBank() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      landlordId: string
      bankAccountId: string
      isDefault?: boolean
      note?: string
    }) => {
      const { error } = await supabase
        .from(TABLE)
        .upsert(
          {
            landlord_id: input.landlordId,
            bank_account_id: input.bankAccountId,
            is_default: !!input.isDefault,
            note: input.note ?? null,
          },
          { onConflict: 'landlord_id,bank_account_id', ignoreDuplicates: false },
        )
      if (error) throw error
      void logActivity({
        action: 'create',
        entity: 'landlord_banks',
        entity_id: `${input.landlordId}:${input.bankAccountId}`,
        description: `ผูกบัญชีให้ผู้ให้เช่า`,
        after: {
          landlord_id: input.landlordId,
          bank_account_id: input.bankAccountId,
          is_default: !!input.isDefault,
        },
      })
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [TABLE, 'by-landlord', vars.landlordId] })
      qc.invalidateQueries({ queryKey: ['bank_accounts', 'for-landlord', vars.landlordId] })
      qc.invalidateQueries({ queryKey: [TABLE, 'by-bank', vars.bankAccountId] })
    },
  })
}

/**
 * Remove link between landlord and bank account.
 * Does NOT delete the bank_account row itself (it may be shared).
 */
export function useRemoveLandlordBank() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { landlordId: string; bankAccountId: string }) => {
      const { error } = await supabase
        .from(TABLE)
        .delete()
        .eq('landlord_id', input.landlordId)
        .eq('bank_account_id', input.bankAccountId)
      if (error) throw error
      void logActivity({
        action: 'delete',
        entity: 'landlord_banks',
        entity_id: `${input.landlordId}:${input.bankAccountId}`,
        description: `ยกเลิกผูกบัญชี-ผู้ให้เช่า`,
        before: {
          landlord_id: input.landlordId,
          bank_account_id: input.bankAccountId,
        },
      })
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [TABLE, 'by-landlord', vars.landlordId] })
      qc.invalidateQueries({ queryKey: ['bank_accounts', 'for-landlord', vars.landlordId] })
      qc.invalidateQueries({ queryKey: [TABLE, 'by-bank', vars.bankAccountId] })
    },
  })
}

/**
 * Set one bank as default for a landlord (clears default flag on siblings).
 */
export function useSetDefaultLandlordBank() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { landlordId: string; bankAccountId: string }) => {
      // Clear default on all other rows for this landlord
      const { error: clearError } = await supabase
        .from(TABLE)
        .update({ is_default: false })
        .eq('landlord_id', input.landlordId)
        .neq('bank_account_id', input.bankAccountId)
      if (clearError) throw clearError

      const { error } = await supabase
        .from(TABLE)
        .update({ is_default: true })
        .eq('landlord_id', input.landlordId)
        .eq('bank_account_id', input.bankAccountId)
      if (error) throw error

      void logActivity({
        action: 'update',
        entity: 'landlord_banks',
        entity_id: `${input.landlordId}:${input.bankAccountId}`,
        description: `ตั้งเป็นบัญชีหลัก`,
        after: { is_default: true },
      })
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [TABLE, 'by-landlord', vars.landlordId] })
      qc.invalidateQueries({ queryKey: ['bank_accounts', 'for-landlord', vars.landlordId] })
    },
  })
}
