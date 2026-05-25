import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Payment } from './types'

const TABLE = 'payments'

/** All payments — sorted newest first */
export function usePayments() {
  return useQuery({
    queryKey: [TABLE],
    queryFn: async (): Promise<Payment[]> => {
      const { data, error } = await supabase
        .from(TABLE)
        .select('id, data, created_at, updated_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Payment[]
    },
  })
}

/** Single payment */
export function usePayment(id: string | undefined) {
  return useQuery({
    queryKey: [TABLE, id],
    queryFn: async (): Promise<Payment | null> => {
      if (!id) return null
      const { data, error } = await supabase
        .from(TABLE)
        .select('id, data, created_at, updated_at')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data as Payment | null
    },
    enabled: !!id,
  })
}

/** Payments for one contract */
export function usePaymentsByContract(contractId: string | undefined) {
  return useQuery({
    queryKey: [TABLE, 'by-contract', contractId],
    queryFn: async (): Promise<Payment[]> => {
      if (!contractId) return []
      const { data, error } = await supabase
        .from(TABLE)
        .select('id, data, created_at, updated_at')
        .eq("data->>'contract_id'", contractId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Payment[]
    },
    enabled: !!contractId,
  })
}

/** Payments that hit a specific bank account */
export function usePaymentsByBankAccount(bankAccountId: string | undefined) {
  return useQuery({
    queryKey: [TABLE, 'by-bank', bankAccountId],
    queryFn: async (): Promise<Payment[]> => {
      if (!bankAccountId) return []
      const { data, error } = await supabase
        .from(TABLE)
        .select('id, data, created_at, updated_at')
        .eq("data->>'bank_account_id'", bankAccountId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Payment[]
    },
    enabled: !!bankAccountId,
  })
}

/** Total received amount for a contract (from matched/partial payments) */
export function useTotalPaidForContract(contractId: string | undefined) {
  return useQuery({
    queryKey: [TABLE, 'total-paid', contractId],
    queryFn: async (): Promise<number> => {
      if (!contractId) return 0
      const { data, error } = await supabase
        .from(TABLE)
        .select('data')
        .eq("data->>'contract_id'", contractId)
        .in("data->>'status'", ['matched', 'partial'])
      if (error) throw error
      return (data ?? []).reduce((sum, row) => sum + (Number((row.data as Record<string, unknown>)?.amount) || 0), 0)
    },
    enabled: !!contractId,
  })
}
