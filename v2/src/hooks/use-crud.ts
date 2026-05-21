import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { logActivity } from '@/lib/audit-log'
import { supabase } from '@/lib/supabase'

/**
 * useCrud · Generic Supabase + TanStack Query CRUD
 *
 * Features:
 *   ✓ list / save (upsert) / remove (soft) / restore / reorder
 *   ✓ Auto invalidate queryKey
 *   ✓ Auto toast (configurable)
 *   ✓ Auto audit-log every mutation (sends to `audit_log` table)
 *   ✓ Soft delete (deleted_at column) by default · permanent delete optional
 *   ✓ Optimistic locking (updated_at check) — ถ้า DB updated_at ≠ expected → throw
 *
 * Schema requirements:
 *   - `id` column (uuid/int)
 *   - `sort` column (int) — for reorder() · or pass custom sortColumn
 *   - `deleted_at` column (timestamptz nullable) — for soft delete (auto-filter)
 *   - `updated_at` column (timestamptz) — for optimistic locking
 *
 * Usage:
 *   const { list, save, remove, restore, reorder } = useCrud<Customer>('customers', {
 *     orderBy: { column: 'name' },
 *   })
 *
 *   list.data                      // Customer[] (filtered active)
 *   save.mutate(record)            // upsert
 *   save.mutate({ ...record, _expectedUpdatedAt: rec.updated_at })  // optimistic lock
 *   remove.mutate(id)              // soft delete (sets deleted_at)
 *   restore.mutate(id)             // unsets deleted_at
 *   reorder.mutate(orderedIds)     // batch update sort column
 */

interface CrudOptions<T extends { id: string | number }> {
  /** column ใช้เรียง · default 'sort' */
  sortColumn?: keyof T & string
  /** select columns · default '*' */
  select?: string
  /** order by · default sortColumn asc */
  orderBy?: { column: keyof T & string; ascending?: boolean }
  /** filter (e.g., { active: true }) */
  filter?: Partial<Record<keyof T & string, unknown>>
  /** disable soft delete (uses hard delete) · default false */
  hardDelete?: boolean
  /** ห้าม audit log mutation (rare · มี data sensitive จริงๆ) */
  skipAudit?: boolean
  /** human-friendly entity name for audit log · default = table name */
  entityName?: string
  /** custom toast messages · empty string disables toast */
  messages?: { saved?: string; removed?: string; restored?: string; reordered?: string }
}

export class OptimisticLockError extends Error {
  constructor(msg = 'มีคนแก้ข้อมูลนี้ไปก่อน · กรุณาโหลดใหม่') {
    super(msg)
    this.name = 'OptimisticLockError'
  }
}

export function useCrud<T extends { id: string | number; updated_at?: string }>(
  table: string,
  options: CrudOptions<T> = {},
) {
  const queryClient = useQueryClient()
  const {
    sortColumn = 'sort',
    select = '*',
    orderBy,
    filter,
    hardDelete = false,
    skipAudit = false,
    entityName = table,
    messages = {},
  } = options

  const queryKey = [table, filter]

  const list = useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase.from(table).select(select)
      // soft delete filter
      query = query.is('deleted_at' as never, null)
      if (filter) {
        for (const [k, v] of Object.entries(filter)) {
          query = query.eq(k, v as never)
        }
      }
      const orderCol = orderBy?.column ?? sortColumn
      const ascending = orderBy?.ascending ?? true
      query = query.order(orderCol, { ascending })
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as unknown as T[]
    },
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey })

  /**
   * save · upsert · supports optimistic locking via record._expectedUpdatedAt
   */
  const save = useMutation({
    mutationFn: async (record: Partial<T> & { _expectedUpdatedAt?: string }) => {
      const { _expectedUpdatedAt, ...payload } = record

      // Optimistic lock check (เฉพาะ update · มี id และ expected)
      if (_expectedUpdatedAt && (payload as { id?: T['id'] }).id) {
        const { data: current } = await supabase
          .from(table)
          .select('updated_at')
          .eq('id', (payload as { id: T['id'] }).id)
          .single()
        const dbUpdatedAt = (current as { updated_at?: string } | null)?.updated_at
        if (dbUpdatedAt && dbUpdatedAt !== _expectedUpdatedAt) {
          throw new OptimisticLockError()
        }
      }

      // Get "before" for audit
      let before: Record<string, unknown> | null = null
      if (!skipAudit && (payload as { id?: T['id'] }).id) {
        const { data } = await supabase
          .from(table)
          .select(select)
          .eq('id', (payload as { id: T['id'] }).id)
          .maybeSingle()
        before = data as Record<string, unknown> | null
      }

      const { data, error } = await supabase
        .from(table)
        .upsert(payload as never)
        .select()
        .single()
      if (error) throw error
      const after = data as unknown as T

      if (!skipAudit) {
        const isCreate = !before
        void logActivity({
          action: isCreate ? 'create' : 'update',
          entity: entityName,
          entity_id: after.id,
          description: isCreate
            ? `สร้าง ${entityName} ใหม่`
            : `แก้ ${entityName} #${after.id}`,
          before,
          after: data as unknown as Record<string, unknown>,
        })
      }

      return after
    },
    onSuccess: () => {
      invalidate()
      if (messages.saved !== '') toast.success(messages.saved || 'บันทึกแล้ว')
    },
    onError: (error) => {
      if (error instanceof OptimisticLockError) {
        toast.warning('มีคนแก้ไปก่อน · กรุณาโหลดใหม่', {
          description: error.message,
        })
      } else {
        toast.error('บันทึกไม่สำเร็จ', { description: (error as Error).message })
      }
    },
  })

  /**
   * remove · soft delete (sets deleted_at) by default · or hard delete if options.hardDelete
   */
  const remove = useMutation({
    mutationFn: async (id: T['id']) => {
      // get "before" for audit
      let before: Record<string, unknown> | null = null
      if (!skipAudit) {
        const { data } = await supabase
          .from(table)
          .select(select)
          .eq('id', id)
          .maybeSingle()
        before = data as Record<string, unknown> | null
      }

      if (hardDelete) {
        const { error } = await supabase.from(table).delete().eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from(table)
          .update({ deleted_at: new Date().toISOString() } as never)
          .eq('id', id)
        if (error) throw error
      }

      if (!skipAudit) {
        void logActivity({
          action: 'delete',
          entity: entityName,
          entity_id: id,
          description: `${hardDelete ? 'ลบถาวร' : 'ลบ'} ${entityName} #${id}`,
          before,
        })
      }
    },
    onSuccess: () => {
      invalidate()
      if (messages.removed !== '') toast.success(messages.removed || 'ลบแล้ว')
    },
    onError: (error) =>
      toast.error('ลบไม่สำเร็จ', { description: (error as Error).message }),
  })

  /**
   * restore · unset deleted_at (only for soft-deleted records)
   */
  const restore = useMutation({
    mutationFn: async (id: T['id']) => {
      const { error } = await supabase
        .from(table)
        .update({ deleted_at: null } as never)
        .eq('id', id)
      if (error) throw error
      if (!skipAudit) {
        void logActivity({
          action: 'restore',
          entity: entityName,
          entity_id: id,
          description: `กู้คืน ${entityName} #${id}`,
        })
      }
    },
    onSuccess: () => {
      invalidate()
      if (messages.restored !== '') toast.success(messages.restored || 'กู้คืนแล้ว')
    },
    onError: (error) =>
      toast.error('กู้คืนไม่สำเร็จ', { description: (error as Error).message }),
  })

  /**
   * reorder · batch update sort column · index 0 = top
   */
  const reorder = useMutation({
    mutationFn: async (ids: T['id'][]) => {
      const updates = ids.map((id, idx) =>
        supabase
          .from(table)
          .update({ [sortColumn]: idx } as never)
          .eq('id', id),
      )
      const results = await Promise.all(updates)
      const firstError = results.find((r) => r.error)?.error
      if (firstError) throw firstError
      if (!skipAudit) {
        void logActivity({
          action: 'update',
          entity: entityName,
          description: `เรียงลำดับ ${entityName} ใหม่ (${ids.length} รายการ)`,
        })
      }
    },
    onSuccess: () => {
      invalidate()
      if (messages.reordered !== '')
        toast.success(messages.reordered || 'เรียงลำดับใหม่แล้ว')
    },
    onError: (error) =>
      toast.error('เรียงลำดับไม่สำเร็จ', { description: (error as Error).message }),
  })

  return { list, save, remove, restore, reorder, invalidate }
}
