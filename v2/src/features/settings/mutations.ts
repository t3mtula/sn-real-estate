import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CompanySettings, DisplaySettings, InvoiceSettings, StaffMember } from './queries'

async function upsertSetting(key: string, value: unknown) {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw error
}

export function useSaveCompanySettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: CompanySettings) => upsertSetting('company', v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app_settings', 'company'] }),
  })
}

export function useSaveDisplaySettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: DisplaySettings) => upsertSetting('display', v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app_settings', 'display'] }),
  })
}

export function useSaveInvoiceSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: InvoiceSettings) => upsertSetting('invoice', v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app_settings', 'invoice'] }),
  })
}

// Staff mutations
export function useCreateStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Pick<StaffMember, 'name' | 'role' | 'signature_img'>) => {
      const { error } = await supabase.from('staff').insert(input)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  })
}

export function useUpdateStaff(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<Pick<StaffMember, 'name' | 'role' | 'signature_img'>>) => {
      const { error } = await supabase
        .from('staff')
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  })
}

export function useDeleteStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('staff').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  })
}
