import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'restore'
  | 'login'
  | 'logout'
  | 'custom'

export type AuditLog = {
  id: string
  created_at: string
  user_id: string | null
  user_email: string | null
  action: AuditAction
  entity: string
  entity_id: string | null
  description: string | null
  before: unknown
  after: unknown
  ip_address: string | null
  user_agent: string | null
}

export type AuditFilter = {
  entity?: string
  entityId?: string
  action?: AuditAction
  limit?: number
}

/**
 * Fetch audit log entries · most recent first
 *
 * RLS: user sees own entries only (per migration 20260521000001).
 */
export function useAuditLog(filter: AuditFilter = {}) {
  return useQuery({
    queryKey: ['audit_log', filter],
    queryFn: async (): Promise<AuditLog[]> => {
      let q = supabase
        .from('audit_log')
        .select('id, created_at, user_id, user_email, action, entity, entity_id, description, before, after, ip_address, user_agent')
        .order('created_at', { ascending: false })
        .limit(filter.limit ?? 200)
      if (filter.entity) q = q.eq('entity', filter.entity)
      if (filter.entityId) q = q.eq('entity_id', filter.entityId)
      if (filter.action) q = q.eq('action', filter.action)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as AuditLog[]
    },
  })
}

/**
 * Audit log for a specific entity row · used inside detail pages.
 */
export function useEntityAuditLog(
  entity: string,
  entityId: string | undefined,
) {
  return useAuditLog({
    entity,
    entityId: entityId ?? '__none__',
    limit: 50,
  })
}

/* ---------- presentation helpers ---------- */

const ACTION_LABEL: Record<AuditAction, string> = {
  create: 'สร้าง',
  update: 'แก้ไข',
  delete: 'ลบ',
  restore: 'กู้คืน',
  login: 'เข้าสู่ระบบ',
  logout: 'ออกจากระบบ',
  custom: 'อื่นๆ',
}

export function getActionLabel(action: string): string {
  return ACTION_LABEL[action as AuditAction] ?? action
}

const ENTITY_LABEL: Record<string, string> = {
  contracts: 'สัญญา',
  invoices: 'ใบแจ้งหนี้',
  tenants: 'ผู้เช่า',
  landlords: 'ผู้ให้เช่า',
  properties: 'ทรัพย์สิน',
  bank_accounts: 'บัญชีธนาคาร',
  contract_templates: 'แบบฟอร์มสัญญา',
}

export function getEntityLabel(entity: string): string {
  return ENTITY_LABEL[entity] ?? entity
}

const ACTION_TONE: Record<AuditAction, string> = {
  create: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300',
  update: 'bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-300',
  delete: 'bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-300',
  restore: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300',
  login: 'bg-muted text-muted-foreground border-border',
  logout: 'bg-muted text-muted-foreground border-border',
  custom: 'bg-muted text-muted-foreground border-border',
}

export function getActionTone(action: string): string {
  return ACTION_TONE[action as AuditAction] ?? ACTION_TONE.custom
}

/** Distinct entity values seen in the current log set (for filter dropdown) */
export function distinctEntities(rows: AuditLog[]): string[] {
  const set = new Set<string>()
  for (const r of rows) set.add(r.entity)
  return Array.from(set).sort()
}
