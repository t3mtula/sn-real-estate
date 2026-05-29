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

import type { Value } from 'platejs'
import type { ContractClause } from '@/features/contracts/print/default-template'

export type { ContractClause }

/** Single attachment row in the "เอกสารแนบท้าย" checklist */
export type TemplateAttachment = {
  /** Label shown next to the checkbox e.g. "สำเนาบัตรประชาชน ผู้เช่า" */
  label: string
  /** If true the box is pre-ticked on the printed contract */
  checked: boolean
}

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
  /** Signature table on/off · default true */
  showWitnesses?: boolean
  /** Number of witness signature cells · 2 (default) or 4 */
  witnessCount?: 2 | 4
  /** Attachments checklist on/off · default true */
  showAttachments?: boolean
  /** Attachments checklist · falls back to DEFAULT_ATTACHMENTS when empty */
  attachments?: TemplateAttachment[]
  /** Property map placeholder box on/off · default false */
  showMap?: boolean
  /**
   * Word-like document body (Plate/Slate value) edited via <DocEditor>.
   * Additive: when present the new document editor uses it; the structured
   * intro/clauses/closing above stay untouched (reversible). Seeded from the
   * structured fields on first open (structuredToPlate).
   */
  doc?: Value
}

export type ContractTemplate = {
  id: string
  data: TemplateData
  is_active: boolean
  created_at: string | null
  updated_at: string | null
}

/**
 * Default attachments checklist · used when template.attachments is empty/undefined.
 * Mirrors the standard set every contract printed by SN Real Estate carries.
 */
export const DEFAULT_ATTACHMENTS: TemplateAttachment[] = [
  { label: 'สำเนาบัตรประชาชน ผู้ให้เช่า', checked: true },
  { label: 'สำเนาทะเบียนบ้าน ผู้ให้เช่า', checked: true },
  { label: 'สำเนาบัตรประชาชน ผู้เช่า', checked: true },
  { label: 'สำเนาทะเบียนบ้าน ผู้เช่า', checked: true },
  { label: 'สำเนาโฉนดที่ดิน', checked: true },
  { label: 'ผังที่ตั้งทรัพย์สิน', checked: false },
]

/** Resolve attachments — returns the template's list if non-empty, otherwise the defaults */
export function resolveAttachments(t: TemplateData | undefined | null): TemplateAttachment[] {
  const list = t?.attachments
  return list && list.length > 0 ? list : DEFAULT_ATTACHMENTS
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
    showWitnesses: true,
    witnessCount: 2,
    showAttachments: true,
    attachments: [],
    showMap: false,
  }
}
