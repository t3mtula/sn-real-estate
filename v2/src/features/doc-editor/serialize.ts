/**
 * Serialize a Plate document to HTML + fill the auto-fill chips with real data.
 * This is the shared pipeline behind BOTH the A4 page-break preview and the
 * eventual real contract print:
 *
 *   editor value (Slate JSON)
 *     → serializeDocToHtml()  → clean HTML (Plate static components)
 *     → fillChips(html, data) → chips replaced with real/sample values
 *     → paged.js / print
 *
 * Uses the *base* (static, non-React) plugin kits, which already wire the
 * `*-node-static` components — mirrors plate-kit.ts but for serialization.
 */
import type { Value } from 'platejs'
import { createSlateEditor } from 'platejs'
import { serializeHtml } from 'platejs/static'
import { BaseAlignKit } from '@/components/editor/plugins/align-base-kit'
import { BaseBasicBlocksKit } from '@/components/editor/plugins/basic-blocks-base-kit'
import { BaseBasicMarksKit } from '@/components/editor/plugins/basic-marks-base-kit'
import { BaseFontKit } from '@/components/editor/plugins/font-base-kit'
import { BaseLineHeightKit } from '@/components/editor/plugins/line-height-base-kit'
import { BaseListKit } from '@/components/editor/plugins/list-base-kit'
import { BaseMentionKit } from '@/components/editor/plugins/mention-base-kit'
import { EditorStatic } from '@/components/ui/editor-static'

const BaseDocKit = [
  ...BaseBasicBlocksKit,
  ...BaseBasicMarksKit,
  ...BaseFontKit,
  ...BaseAlignKit,
  ...BaseLineHeightKit,
  ...BaseListKit, // includes base indent
  ...BaseMentionKit,
]

/** Render the document value to a clean HTML string. */
export async function serializeDocToHtml(value: Value): Promise<string> {
  const editor = createSlateEditor({ plugins: BaseDocKit, value })
  return serializeHtml(editor, {
    editorComponent: EditorStatic,
    props: { variant: 'none' },
  })
}

/**
 * Replace each auto-fill chip with its value. Chips serialize to a span
 * carrying `data-slate-value="<field label>"`; we look the label up in the
 * data map (missing → 〔label〕 so gaps are visible, not silently blank).
 */
export function fillChips(html: string, values: Record<string, string>): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('[data-slate-value]').forEach((el) => {
    const key = el.getAttribute('data-slate-value') ?? ''
    el.replaceWith(doc.createTextNode(values[key] ?? `〔${key}〕`))
  })
  return doc.body.innerHTML
}
