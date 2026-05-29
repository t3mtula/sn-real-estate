/**
 * Placeholder (data-chip) extension for TipTap — Phase 0 spike.
 *
 * Renders an inline, atomic "chip" inside the rich-text body that stands in
 * for an auto-filled contract value (tenant name, rent, dates, …). The chip
 * carries two attributes:
 *   - token: the merge key e.g. "tenant" / "rate"  (data-placeholder attr)
 *   - label: the Thai label shown to the user e.g. "ชื่อผู้เช่า"
 *
 * In the editor the chip is non-editable (atom) so it can't be half-deleted.
 * At print/preview time the chip's data-placeholder token is swapped for the
 * real contract value (see fillPlaceholders in wysiwyg-spike.tsx).
 */
import { mergeAttributes, Node } from '@tiptap/core'

export type PlaceholderDef = { token: string; label: string }

/** The data tokens available to insert in the spike. Phase 1 will derive these
 * from the real contract field map. */
export const PLACEHOLDER_DEFS: PlaceholderDef[] = [
  { token: 'tenant', label: 'ชื่อผู้เช่า' },
  { token: 'landlord', label: 'ชื่อผู้ให้เช่า' },
  { token: 'rate', label: 'ค่าเช่า' },
  { token: 'start', label: 'วันเริ่ม' },
  { token: 'end', label: 'วันสิ้นสุด' },
]

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    placeholder: {
      /** Insert a data chip at the cursor */
      insertPlaceholder: (def: PlaceholderDef) => ReturnType
    }
  }
}

export const Placeholder = Node.create({
  name: 'placeholder',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      token: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-placeholder') ?? '',
        renderHTML: (attrs: { token: string }) => ({
          'data-placeholder': attrs.token,
        }),
      },
      label: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-label') ?? '',
        renderHTML: (attrs: { label: string }) => ({ 'data-label': attrs.label }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-placeholder]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const label = (node.attrs.label as string) || (node.attrs.token as string)
    return [
      'span',
      mergeAttributes(HTMLAttributes, { class: 'doc-chip' }),
      `{${label}}`,
    ]
  },

  addCommands() {
    return {
      insertPlaceholder:
        (def: PlaceholderDef) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { token: def.token, label: def.label },
          }),
    }
  },
})
