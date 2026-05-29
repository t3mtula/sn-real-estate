/**
 * Custom TipTap extensions — only the controls the official packages don't
 * cover well:
 *   - LineHeight : BLOCK-level paragraph/heading line spacing. (The official
 *     LineHeight in @tiptap/extension-text-style rides a textStyle *mark*,
 *     which sets line-height on an inline <span> and doesn't reliably control
 *     a whole paragraph's spacing — so we keep a block-attribute version.)
 *   - Indent     : paragraph/heading left indent (เยื้องย่อหน้า) with in/out.
 *
 * Everything else comes from the official packages:
 *   StarterKit → bold/italic/underline/strike/headings/lists/blockquote/
 *     horizontal-rule/link/undo-redo
 *   @tiptap/extension-text-style → TextStyle + Color + FontSize
 *   @tiptap/extension-highlight  → Highlight
 *   @tiptap/extension-text-align → TextAlign
 *   @tiptap/extension-table      → Table/Row/Header/Cell
 */
import { Extension } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType
      outdent: () => ReturnType
    }
  }
}

/* ─────────── Line height (block attribute on paragraph + heading) ─────────── */

export const LineHeight = Extension.create({
  name: 'lineHeight',
  addOptions() {
    return { types: ['paragraph', 'heading'], default: null as string | null }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: this.options.default,
            parseHTML: (el: HTMLElement) =>
              el.style.lineHeight || this.options.default,
            renderHTML: (attrs: { lineHeight?: string }) =>
              attrs.lineHeight
                ? { style: `line-height: ${attrs.lineHeight}` }
                : {},
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setLineHeight:
        (value: string) =>
        ({ commands }) =>
          this.options.types.every((type: string) =>
            commands.updateAttributes(type, { lineHeight: value })
          ),
      unsetLineHeight:
        () =>
        ({ commands }) =>
          this.options.types.every((type: string) =>
            commands.resetAttributes(type, 'lineHeight')
          ),
    }
  },
})

/* ─────────── Indent (เยื้องย่อหน้า) — numeric level → margin ─────────── */

const INDENT_EM_PER_LEVEL = 2.5

export const Indent = Extension.create({
  name: 'indent',
  addOptions() {
    return { types: ['paragraph', 'heading'], min: 0, max: 8 }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el: HTMLElement) =>
              Number(el.getAttribute('data-indent')) || 0,
            renderHTML: (attrs: { indent?: number }) =>
              attrs.indent
                ? {
                    'data-indent': String(attrs.indent),
                    style: `margin-inline-start: ${attrs.indent * INDENT_EM_PER_LEVEL}em`,
                  }
                : {},
          },
        },
      },
    ]
  },
  addCommands() {
    const shift =
      (delta: number) =>
      ({
        state,
        dispatch,
      }: {
        state: import('@tiptap/pm/state').EditorState
        dispatch?: (tr: import('@tiptap/pm/state').Transaction) => void
      }) => {
        const { from, to } = state.selection
        const tr = state.tr
        let changed = false
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (!this.options.types.includes(node.type.name)) return
          const cur: number = node.attrs.indent || 0
          const next = Math.min(
            this.options.max,
            Math.max(this.options.min, cur + delta)
          )
          if (next !== cur) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next })
            changed = true
          }
        })
        if (changed && dispatch) dispatch(tr)
        return changed
      }
    return {
      indent: () => shift(1),
      outdent: () => shift(-1),
    }
  },
})
