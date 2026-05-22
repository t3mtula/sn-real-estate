import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  DEFAULT_CLAUSES,
  DEFAULT_CLOSING,
  DEFAULT_INTRO,
} from '@/features/contracts/print/default-template'
import type { ContractTemplate, TemplateData } from './types'

const TABLE = 'contract_templates'

/** Build a snapshot of the v1 default template — used to seed first row */
function defaultTemplateData(): TemplateData {
  return {
    name: 'แบบมาตรฐาน',
    intro: DEFAULT_INTRO,
    closing: DEFAULT_CLOSING,
    clauses: DEFAULT_CLAUSES.map((c) => ({
      text: c.text,
      sub: c.sub ? [...c.sub] : [],
    })),
    version: 'v1 port',
    notes: '',
  }
}

/** Create new template. If `active=true` it deactivates any other active first. */
export function useCreateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      data: TemplateData
      active?: boolean
    }): Promise<{ id: string }> => {
      const id = String(Date.now())
      if (input.active) {
        // unique partial index allows only one active row — clear any current
        await supabase.from(TABLE).update({ is_active: false }).eq('is_active', true)
      }
      const { error } = await supabase
        .from(TABLE)
        .insert({ id, data: input.data, is_active: !!input.active })
        .select('id')
        .single()
      if (error) throw error
      return { id }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract_templates'] })
    },
  })
}

/** Update template (merge data) · doesn't touch is_active. */
export function useUpdateTemplate(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { data: Partial<TemplateData> }) => {
      const { data: existing, error: readErr } = await supabase
        .from(TABLE)
        .select('data')
        .eq('id', id)
        .single()
      if (readErr) throw readErr
      const merged: TemplateData = {
        ...((existing?.data ?? {}) as TemplateData),
        ...input.data,
      }
      const { error } = await supabase
        .from(TABLE)
        .update({ data: merged, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract_templates'] })
      qc.invalidateQueries({ queryKey: ['contract_templates', id] })
      qc.invalidateQueries({ queryKey: ['contract_templates', 'active'] })
    },
  })
}

/** Toggle a template as active (deactivates others first) */
export function useActivateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // clear current active
      await supabase.from(TABLE).update({ is_active: false }).eq('is_active', true)
      const { error } = await supabase
        .from(TABLE)
        .update({ is_active: true })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract_templates'] })
      qc.invalidateQueries({ queryKey: ['contract_templates', 'active'] })
    },
  })
}

/** Duplicate (copy) a template · new id, name suffix " (สำเนา)", inactive. */
export function useDuplicateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (sourceId: string): Promise<{ id: string }> => {
      const { data: src, error: readErr } = await supabase
        .from(TABLE)
        .select('data')
        .eq('id', sourceId)
        .single()
      if (readErr) throw readErr
      const data = (src?.data ?? {}) as TemplateData
      const copy: TemplateData = {
        ...data,
        name: `${data.name || 'ไม่ระบุชื่อ'} (สำเนา)`,
        clauses: (data.clauses ?? []).map((c) => ({
          text: c.text,
          sub: c.sub ? [...c.sub] : [],
        })),
      }
      const id = String(Date.now())
      const { error } = await supabase
        .from(TABLE)
        .insert({ id, data: copy, is_active: false })
        .select('id')
        .single()
      if (error) throw error
      return { id }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract_templates'] })
    },
  })
}

/** Delete template · cannot delete active */
export function useDeleteTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(TABLE).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract_templates'] })
    },
  })
}

/**
 * Seed the v1 default template if the table is empty. Idempotent: subsequent
 * calls do nothing once there is at least one row.
 *
 * Use this on first visit to the Settings → ฟอร์มสัญญา page.
 */
export function useSeedDefaultTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<ContractTemplate | null> => {
      const { count, error: countErr } = await supabase
        .from(TABLE)
        .select('id', { count: 'exact', head: true })
      if (countErr) throw countErr
      if ((count ?? 0) > 0) return null

      const id = String(Date.now())
      const { error } = await supabase
        .from(TABLE)
        .insert({ id, data: defaultTemplateData(), is_active: true })
      if (error) throw error
      const { data, error: readErr } = await supabase
        .from(TABLE)
        .select('id, data, is_active, created_at, updated_at')
        .eq('id', id)
        .single()
      if (readErr) throw readErr
      return data as ContractTemplate
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract_templates'] })
      qc.invalidateQueries({ queryKey: ['contract_templates', 'active'] })
    },
  })
}
