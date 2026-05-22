import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ContractTemplate } from './types'

const TABLE = 'contract_templates'

/** All templates · active first, then by created_at desc */
export function useContractTemplates() {
  return useQuery({
    queryKey: ['contract_templates'],
    queryFn: async (): Promise<ContractTemplate[]> => {
      const { data, error } = await supabase
        .from(TABLE)
        .select('id, data, is_active, created_at, updated_at')
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as ContractTemplate[]
    },
  })
}

/** Single template by id */
export function useContractTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['contract_templates', id],
    queryFn: async (): Promise<ContractTemplate | null> => {
      if (!id) return null
      const { data, error } = await supabase
        .from(TABLE)
        .select('id, data, is_active, created_at, updated_at')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data as ContractTemplate | null
    },
    enabled: !!id,
  })
}

/** Active template · used by PDF builder. Null = no template seeded yet. */
export function useActiveContractTemplate() {
  return useQuery({
    queryKey: ['contract_templates', 'active'],
    queryFn: async (): Promise<ContractTemplate | null> => {
      const { data, error } = await supabase
        .from(TABLE)
        .select('id, data, is_active, created_at, updated_at')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data as ContractTemplate | null
    },
  })
}
