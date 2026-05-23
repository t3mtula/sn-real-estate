import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { BankAccount } from '@/features/bank-accounts/types'
import type { LandlordBank } from '@/features/landlord-banks/types'

const TABLE = 'landlord_banks'

/**
 * Fetch all landlord_banks links for one landlord — returns junction rows.
 * Use `useBankAccountsForLandlord` if you need the resolved BankAccount rows.
 */
export function useLandlordBankLinks(landlordId: string | undefined) {
  return useQuery({
    queryKey: [TABLE, 'by-landlord', landlordId],
    queryFn: async (): Promise<LandlordBank[]> => {
      if (!landlordId) return []
      const { data, error } = await supabase
        .from(TABLE)
        .select('id, landlord_id, bank_account_id, is_default, note, created_at')
        .eq('landlord_id', landlordId)
      if (error) throw error
      return (data ?? []) as LandlordBank[]
    },
    enabled: !!landlordId,
  })
}

/**
 * Fetch all bank accounts linked to a landlord (via junction table).
 * Replaces the legacy `useBankAccountsByOwner` (which used data->>'ownerLandlordId').
 *
 * Sorted: default-first, then by bank name (Thai locale).
 */
export function useBankAccountsForLandlord(landlordId: string | undefined) {
  return useQuery({
    queryKey: ['bank_accounts', 'for-landlord', landlordId],
    queryFn: async (): Promise<Array<BankAccount & { is_default: boolean }>> => {
      if (!landlordId) return []
      const { data, error } = await supabase
        .from(TABLE)
        .select(
          'is_default, bank_account:bank_accounts!inner(id, data, created_at, updated_at)',
        )
        .eq('landlord_id', landlordId)
      if (error) throw error
      type Row = {
        is_default: boolean
        bank_account: BankAccount | BankAccount[] | null
      }
      const rows = (data ?? []) as unknown as Row[]
      const mapped: Array<BankAccount & { is_default: boolean }> = []
      for (const r of rows) {
        const ba = Array.isArray(r.bank_account) ? r.bank_account[0] : r.bank_account
        if (!ba) continue
        mapped.push({ ...ba, is_default: !!r.is_default })
      }
      return mapped.sort((a, b) => {
        if (a.is_default !== b.is_default) return a.is_default ? -1 : 1
        return (a.data?.bank ?? '').localeCompare(b.data?.bank ?? '', 'th')
      })
    },
    enabled: !!landlordId,
  })
}

/**
 * Fetch all landlords linked to a bank account (reverse direction).
 * Returns landlord_id strings — caller can hydrate via useLandlord(id) per row.
 */
export function useLandlordIdsForBank(bankAccountId: string | undefined) {
  return useQuery({
    queryKey: [TABLE, 'by-bank', bankAccountId],
    queryFn: async (): Promise<LandlordBank[]> => {
      if (!bankAccountId) return []
      const { data, error } = await supabase
        .from(TABLE)
        .select('id, landlord_id, bank_account_id, is_default, note, created_at')
        .eq('bank_account_id', bankAccountId)
      if (error) throw error
      return (data ?? []) as LandlordBank[]
    },
    enabled: !!bankAccountId,
  })
}
