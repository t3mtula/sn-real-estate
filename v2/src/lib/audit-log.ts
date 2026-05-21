import { supabase } from '@/lib/supabase'

/**
 * Audit log helper · ทุก mutation บันทึกที่ table `audit_log`
 *
 * Setup:
 *   1. Apply migration `supabase/migrations/20260521000001_audit_log.sql`
 *   2. (option) แต่ละ app เพิ่ม policy ของ role admin ตามต้องการ
 *
 * Usage:
 *   await logActivity({
 *     action: 'update',
 *     entity: 'contracts',
 *     entity_id: contract.id,
 *     description: `แก้สัญญา ${contract.no} · ค่าเช่า ${oldRent} → ${newRent}`,
 *     before: oldContract,
 *     after: newContract,
 *   })
 */

type AuditAction = 'create' | 'update' | 'delete' | 'restore' | 'login' | 'logout' | 'custom'

interface LogActivityInput {
  action: AuditAction
  entity: string
  entity_id?: string | number
  description?: string
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
}

export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error } = await supabase.from('audit_log').insert({
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      action: input.action,
      entity: input.entity,
      entity_id: input.entity_id != null ? String(input.entity_id) : null,
      description: input.description ?? null,
      before: input.before ?? null,
      after: input.after ?? null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    })

    if (error) {
      // ไม่ throw · log failure ไม่ block business logic
      // eslint-disable-next-line no-console
      console.warn('[audit] logActivity failed:', error.message)
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[audit] logActivity error:', err)
  }
}

/**
 * Bulk log (สำหรับ batch import etc.)
 */
export async function logBulkActivity(items: LogActivityInput[]): Promise<void> {
  if (items.length === 0) return
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const rows = items.map((input) => ({
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      action: input.action,
      entity: input.entity,
      entity_id: input.entity_id != null ? String(input.entity_id) : null,
      description: input.description ?? null,
      before: input.before ?? null,
      after: input.after ?? null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    }))

    const { error } = await supabase.from('audit_log').insert(rows)
    if (error) {
      // eslint-disable-next-line no-console
      console.warn('[audit] logBulkActivity failed:', error.message)
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[audit] logBulkActivity error:', err)
  }
}
