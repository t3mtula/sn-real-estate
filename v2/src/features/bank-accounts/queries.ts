import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { BankAccount } from '@/features/bank-accounts/types'

const TABLE = 'bank_accounts'

/**
 * Fetch all bank accounts · sorted by owner name + bank
 */
export function useBankAccounts() {
  return useQuery({
    queryKey: ['bank_accounts'],
    queryFn: async (): Promise<BankAccount[]> => {
      const { data, error } = await supabase
        .from(TABLE)
        .select('id, data, created_at, updated_at')
      if (error) throw error
      const rows = (data ?? []) as BankAccount[]
      return [...rows].sort((a, b) => {
        const oa = (a.data?.ownerLandlordName ?? '').localeCompare(
          b.data?.ownerLandlordName ?? '',
          'th',
        )
        if (oa !== 0) return oa
        return (a.data?.bank ?? '').localeCompare(b.data?.bank ?? '', 'th')
      })
    },
  })
}

/**
 * Fetch single bank account by ID
 */
export function useBankAccount(id: string | undefined) {
  return useQuery({
    queryKey: ['bank_accounts', id],
    queryFn: async (): Promise<BankAccount | null> => {
      if (!id) return null
      const { data, error } = await supabase
        .from(TABLE)
        .select('id, data, created_at, updated_at')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data as BankAccount | null
    },
    enabled: !!id,
  })
}

/**
 * Fetch all bank accounts linked to a landlord (via junction table `landlord_banks`).
 * (ใช้ใน landlord-detail · เลือกจาก dropdown ใน contract form)
 *
 * Phase 1B-3a → 2026-05-23: M:M refactor — query via landlord_banks instead of
 * data->>ownerLandlordId. Signature kept for backward compat with existing callers;
 * new code should prefer `useBankAccountsForLandlord` from features/landlord-banks.
 */
export function useBankAccountsByOwner(ownerLandlordId: string | undefined) {
  return useQuery({
    queryKey: ['bank_accounts', 'by-owner', ownerLandlordId],
    queryFn: async (): Promise<BankAccount[]> => {
      if (!ownerLandlordId) return []
      const { data, error } = await supabase
        .from('landlord_banks')
        .select('bank_account:bank_accounts!inner(id, data, created_at, updated_at)')
        .eq('landlord_id', ownerLandlordId)
      if (error) throw error
      type Row = { bank_account: BankAccount | BankAccount[] | null }
      const rows = (data ?? []) as unknown as Row[]
      const banks: BankAccount[] = []
      for (const r of rows) {
        const ba = Array.isArray(r.bank_account) ? r.bank_account[0] : r.bank_account
        if (ba) banks.push(ba)
      }
      return banks.sort((a, b) =>
        (a.data?.bank ?? '').localeCompare(b.data?.bank ?? '', 'th'),
      )
    },
    enabled: !!ownerLandlordId,
  })
}

/* ---------- helpers ---------- */

export function getBankLabel(b: BankAccount['data'] | undefined): string {
  if (!b) return '—'
  const parts = [b.bank, b.acctNo].filter(Boolean)
  if (b.label) parts.push(`(${b.label})`)
  return parts.join(' · ') || '—'
}

/** Display bank info as 2-line block */
export function getBankDisplay(b: BankAccount['data'] | undefined): {
  primary: string
  secondary: string
} {
  if (!b) return { primary: '—', secondary: '' }
  const primary = b.accountName?.trim() || b.bank?.trim() || '—'
  const secondary = [b.bank, b.acctNo].filter(Boolean).join(' · ')
  return { primary, secondary }
}
