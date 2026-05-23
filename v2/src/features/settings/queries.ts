import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type CompanySettings = {
  name?: string
  address?: string
  phone?: string
  taxId?: string
  logoUrl?: string        // base64 data URL
  bankName?: string
  bankAccountNo?: string
  bankAccountName?: string
  promptPayId?: string
  promptPayName?: string
  vatMode?: 'none' | 'inclusive' | 'exclusive'
  vatRate?: number
  invoiceNote?: string
}

export type DisplaySettings = {
  expiryWarningDays?: number
  overdueWarningDays?: number
  witness1?: string
  witness2?: string
}

export type InvoiceSettings = {
  prefix?: string
  dueDay?: number
  vatMode?: 'none' | 'inclusive' | 'exclusive'
  vatRate?: number
  invoiceNote?: string
  receiptNote?: string
  /** @deprecated moved to SystemSettings.slipOkBranchId */
  slipOkBranchId?: string
  /** @deprecated moved to SystemSettings.slipOkApiKey */
  slipOkApiKey?: string
}

export type SystemSettings = {
  contractPrefix?: string
  invoicePrefix?: string
  receiptPrefix?: string
  expiryWarningDays?: number
  overdueWarningDays?: number
  lineNotifyToken?: string
  slipOkBranchId?: string
  slipOkApiKey?: string
}

async function fetchSetting<T>(key: string): Promise<T> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return (data?.value ?? {}) as T
}

export function useCompanySettings() {
  return useQuery({
    queryKey: ['app_settings', 'company'],
    queryFn: () => fetchSetting<CompanySettings>('company'),
    staleTime: 60_000,
  })
}

export function useDisplaySettings() {
  return useQuery({
    queryKey: ['app_settings', 'display'],
    queryFn: () => fetchSetting<DisplaySettings>('display'),
    staleTime: 60_000,
  })
}

export function useInvoiceSettings() {
  return useQuery({
    queryKey: ['app_settings', 'invoice'],
    queryFn: () => fetchSetting<InvoiceSettings>('invoice'),
    staleTime: 60_000,
  })
}

export function useSystemSettings() {
  return useQuery({
    queryKey: ['app_settings', 'system'],
    queryFn: () => fetchSetting<SystemSettings>('system'),
    staleTime: 60_000,
  })
}

// Staff
export type StaffMember = {
  id: string
  name: string
  role: 'admin' | 'manager' | 'staff'
  signature_img?: string | null
  created_at: string | null
  updated_at: string | null
}

export function useStaff() {
  return useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as StaffMember[]
    },
  })
}
