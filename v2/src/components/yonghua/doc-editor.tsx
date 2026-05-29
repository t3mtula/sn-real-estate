/**
 * <DocEditor> — reusable Word-like A4 document editor (Yonghua shared).
 *
 * Wraps Plate (rich-text on an A4 canvas) + the full formatting toolbar +
 * auto-fill data chips, with an optional live A4 page-break preview (paged.js)
 * that fills the chips with real/sample values.
 *
 * Engine pieces live in features/doc-editor (plate-kit, doc-toolbar, serialize,
 * doc-fields). This component is the integration surface every app/page uses.
 *
 * Props:
 *   - value:       initial Slate document
 *   - onChange:    fires with the latest value on every edit (for saving)
 *   - previewData: when provided, shows the right-hand A4 preview with chips
 *                  filled from this map (keyed by field label). Omit to hide it.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Value } from 'platejs'
import { Plate, usePlateEditor } from 'platejs/react'
import { Previewer } from 'pagedjs'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Editor, EditorContainer } from '@/components/ui/editor'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DocToolbar } from '@/features/doc-editor/doc-toolbar'
import { DocPlateKit } from '@/features/doc-editor/plate-kit'
import { fillChips, serializeDocToHtml } from '@/features/doc-editor/serialize'

const PREVIEW_CSS = `
  @page { size: A4; margin: 20mm; }
  .doc-body { font-family: 'Sarabun', sans-serif; font-size: 14px; line-height: 1.7; color: #111; }
  .doc-body h1 { font-size: 20px; font-weight: 700; text-align: center; margin: 0 0 16px; }
  .doc-body h2 { font-size: 16px; font-weight: 700; margin: 16px 0 6px; }
  .doc-body h3 { font-size: 14px; font-weight: 700; margin: 12px 0 6px; }
  .doc-body p { margin: 0 0 8px; }
  .doc-body [data-slate-align='center'] { text-align: center; }
  .doc-body [data-slate-align='right'] { text-align: right; }
`

export type DocEditorProps = {
  value: Value
  onChange?: (value: Value) => void
  /** When set, render the A4 page-break preview with chips filled from this map. */
  previewData?: Record<string, string>
  className?: string
}

export function DocEditor({
  value,
  onChange,
  previewData,
  className,
}: DocEditorProps) {
  const editor = usePlateEditor({ plugins: DocPlateKit, value })
  const previewRef = useRef<HTMLDivElement>(null)
  const [building, setBuilding] = useState(false)
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runningRef = useRef(false)
  const pendingRef = useRef<Value | null>(null)
  const showPreview = previewData != null

  /** Serialize → fill chips → paginate with paged.js (serialized, one at a time). */
  const rebuild = useCallback(
    async (val: Value) => {
      if (!showPreview) return
      if (runningRef.current) {
        pendingRef.current = val
        return
      }
      const container = previewRef.current
      if (!container) return
      runningRef.current = true
      setBuilding(true)
      setErr(null)
      try {
        const html = fillChips(await serializeDocToHtml(val), previewData ?? {})
        document
          .querySelectorAll('style[data-pagedjs-inserted-styles]')
          .forEach((s) => s.remove())
        container.innerHTML = ''
        const result = await new Previewer().preview(
          `<div class="doc-body">${html}</div>`,
          [{ 'inline.css': PREVIEW_CSS }],
          container
        )
        setPageCount(result?.total ?? null)
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      } finally {
        setBuilding(false)
        runningRef.current = false
        if (pendingRef.current) {
          const next = pendingRef.current
          pendingRef.current = null
          void rebuild(next)
        }
      }
    },
    [showPreview, previewData]
  )

  const handleChange = useCallback(
    (val: Value) => {
      onChange?.(val)
      if (!showPreview) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => void rebuild(val), 600)
    },
    [onChange, rebuild, showPreview]
  )

  useEffect(() => {
    if (showPreview) void rebuild(editor.children as Value)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [editor, rebuild, showPreview])

  return (
    <TooltipProvider>
      <Plate editor={editor} onChange={({ value: v }) => handleChange(v as Value)}>
        <div className={cn('flex flex-col gap-3', className)}>
          <DocToolbar />

          <div className={cn('grid gap-4', showPreview && 'lg:grid-cols-2')}>
            {/* A4 editing canvas */}
            <div className='overflow-auto rounded-md border bg-muted/30 p-4'>
              <div className='doc-canvas mx-auto bg-white shadow-sm'>
                <EditorContainer>
                  <Editor variant='none' placeholder='พิมพ์ที่นี่…' />
                </EditorContainer>
              </div>
            </div>

            {/* A4 page-break preview */}
            {showPreview && (
              <div className='relative overflow-auto rounded-md border bg-muted/30 p-4'>
                <div className='mb-2 flex items-center gap-2 text-xs text-muted-foreground'>
                  <span>พรีวิวแบ่งหน้า A4</span>
                  {building && <Loader2 className='size-3 animate-spin' />}
                  {pageCount != null && !building && <span>· {pageCount} หน้า</span>}
                </div>
                {err && (
                  <div className='m-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive'>
                    <p className='font-medium'>แบ่งหน้าไม่สำเร็จ</p>
                    <p className='mt-1'>{err}</p>
                  </div>
                )}
                <div ref={previewRef} className='paged-preview origin-top' />
              </div>
            )}
          </div>
        </div>
      </Plate>

      <style>{`
        .doc-canvas {
          width: 210mm;
          min-height: 297mm;
          padding: 20mm;
          box-sizing: border-box;
          font-family: 'Sarabun', sans-serif;
          color: #111;
        }
        .doc-canvas [data-slate-editor] { outline: none; }
        .paged-preview { transform: scale(0.6); transform-origin: top left; }
        .paged-preview .pagedjs_page {
          background: #fff;
          box-shadow: 0 1px 6px rgba(0,0,0,0.15);
          margin: 0 auto 16px;
        }
      `}</style>
    </TooltipProvider>
  )
}
