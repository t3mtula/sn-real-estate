/**
 * Contract Template types
 *
 * Storage: public.contract_templates (Supabase)
 *   id text PK · data jsonb · is_active boolean · created_at · updated_at
 *
 * Mirrors v1's DB.templates schema (modules/02-state.js + 20-context-menu-cf.js):
 *   { id, name, intro, clauses[], closing, isActive, createdBe }
 *
 * Clause structure ports from v1 normalizeClauses():
 *   { text: string, sub: string[] }  (sub-clauses are plain strings)
 */

import type { ContractClause } from '@/features/contracts/print/default-template'

export type { ContractClause }

export type TemplateData = {
  /** Display name e.g. "แบบมาตรฐาน 2569" */
  name: string
  /** Intro paragraph · supports {{tenant}} {{landlord}} placeholders + <strong> tags */
  intro: string
  /** Numbered clauses (with optional sub-clauses) */
  clauses: ContractClause[]
  /** Closing paragraph */
  closing: string
  /** Free-text version label e.g. "v1", "ปรับ ก.พ. 69" */
  version?: string
  /** Notes shown only in editor · not printed */
  notes?: string
}

export type ContractTemplate = {
  id: string
  data: TemplateData
  is_active: boolean
  created_at: string | null
  updated_at: string | null
}

/** Helper · safely-typed empty template */
export function emptyTemplateData(): TemplateData {
  return {
    name: '',
    intro: '',
    clauses: [],
    closing: '',
    version: '',
    notes: '',
  }
}
