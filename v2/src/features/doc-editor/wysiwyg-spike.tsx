/**
 * WYSIWYG editor — Phase 0 spike (now with the full Word-like toolbar).
 *
 * Proves the chosen architecture before extracting the reusable component:
 *   1. Rich-text editing live on an A4-width canvas (TipTap)
 *   2. Full formatting toolbar — headings, font size, bold/italic/underline/
 *      strike, colour, highlight, align, indent, line spacing, lists, table,
 *      divider, data chips, undo/redo
 *   3. Inline "data chips" that auto-fill in the preview
 *   4. A side preview showing REAL A4 page boundaries (paged.js)
 *   5. Thai font (Sarabun) in both panes
 *
 * Throwaway scaffolding — Phase 1 extracts the reusable "paper editor" into
 * @/components/yonghua. Do not build on it.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { FontSize, TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { Highlight } from '@tiptap/extension-highlight'
import { TextAlign } from '@tiptap/extension-text-align'
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from '@tiptap/extension-table'
import { Previewer } from 'pagedjs'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Placeholder } from './placeholder-extension'
import { Indent, LineHeight } from './editor-extensions'
import { EditorToolbar } from './editor-toolbar'

/* Sample contract values used to "fill" the chips in the preview pane. */
const SAMPLE: Record<string, string> = {
  tenant: 'นายสมชาย ใจดี',
  landlord: 'บริษัท สมบัตินภา จำกัด',
  rate: '10,000 บาท',
  start: '1 มกราคม 2569',
  end: '31 ธันวาคม 2570',
}

const INITIAL_HTML = `
  <h1>สัญญาเช่าอาคารพาณิชย์</h1>
  <p>สัญญาฉบับนี้ทำขึ้นระหว่าง <span data-placeholder="landlord" data-label="ชื่อผู้ให้เช่า" class="doc-chip">{ชื่อผู้ให้เช่า}</span> ซึ่งต่อไปนี้เรียกว่า "ผู้ให้เช่า" ฝ่ายหนึ่ง กับ <span data-placeholder="tenant" data-label="ชื่อผู้เช่า" class="doc-chip">{ชื่อผู้เช่า}</span> ซึ่งต่อไปนี้เรียกว่า "ผู้เช่า" อีกฝ่ายหนึ่ง ทั้งสองฝ่ายตกลงทำสัญญากันโดยมีข้อความดังต่อไปนี้</p>
  <h2>ข้อ 1. ทรัพย์สินที่เช่า</h2>
  <p>ผู้ให้เช่าตกลงให้เช่า และผู้เช่าตกลงเช่าอาคารพาณิชย์ โดยคิดค่าเช่าเดือนละ <span data-placeholder="rate" data-label="ค่าเช่า" class="doc-chip">{ค่าเช่า}</span> มีกำหนดระยะเวลาเช่าตั้งแต่วันที่ <span data-placeholder="start" data-label="วันเริ่ม" class="doc-chip">{วันเริ่ม}</span> ถึงวันที่ <span data-placeholder="end" data-label="วันสิ้นสุด" class="doc-chip">{วันสิ้นสุด}</span></p>
  <p>ลองพิมพ์/แก้ข้อความตรงนี้ได้เลย — ใช้แถบเครื่องมือด้านบนจัดตัวหนา หัวข้อ สี ไฮไลต์ เยื้องย่อหน้า ตาราง ฯลฯ เพื่อทดสอบว่าการแบ่งหน้า A4 ในแผงขวาตรงกับที่พิมพ์จริง</p>
`

/** Swap each data chip for its sample value so the preview shows a "filled" doc. */
function fillPlaceholders(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('span[data-placeholder]').forEach((el) => {
    const tok = el.getAttribute('data-placeholder') ?? ''
    el.replaceWith(doc.createTextNode(SAMPLE[tok] ?? `{${tok}}`))
  })
  return doc.body.innerHTML
}

/** CSS handed to paged.js — defines the A4 page box + Thai typography + tables. */
const PREVIEW_CSS = `
  @page { size: A4; margin: 20mm; }
  .doc-body { font-family: 'Sarabun', sans-serif; font-size: 14px; line-height: 1.7; color: #111; }
  .doc-body h1 { font-size: 20px; font-weight: 700; text-align: center; margin: 0 0 16px; }
  .doc-body h2 { font-size: 16px; font-weight: 700; margin: 16px 0 6px; }
  .doc-body h3 { font-size: 14px; font-weight: 700; margin: 12px 0 6px; }
  .doc-body p { margin: 0 0 8px; text-align: left; }
  .doc-body ul, .doc-body ol { margin: 0 0 8px; padding-inline-start: 24px; }
  .doc-body mark { padding: 0 2px; border-radius: 2px; }
  .doc-body table { border-collapse: collapse; width: 100%; margin: 8px 0; }
  .doc-body td, .doc-body th { border: 1px solid #999; padding: 4px 8px; }
  .doc-body th { background: #f1f5f9; }
  .doc-body hr { border: none; border-top: 1px solid #999; margin: 12px 0; }
`

export function WysiwygSpike() {
  const previewRef = useRef<HTMLDivElement>(null)
  const [building, setBuilding] = useState(false)
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runningRef = useRef(false)
  const pendingRef = useRef<string | null>(null)
  const [, forceRender] = useReducer((x) => x + 1, 0)

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      FontSize,
      LineHeight,
      Indent,
      Placeholder,
    ],
    content: INITIAL_HTML,
  })

  /** Re-paginate the preview with paged.js. Serialized: only one paged.js run
   * at a time — a request arriving mid-run is stashed and run once the current
   * one settles (clearing the DOM under a live previewer throws getBoundingClientRect). */
  const rebuild = useCallback(async (html: string) => {
    if (runningRef.current) {
      pendingRef.current = html
      return
    }
    const container = previewRef.current
    if (!container) return
    runningRef.current = true
    setBuilding(true)
    setErr(null)
    try {
      document
        .querySelectorAll('style[data-pagedjs-inserted-styles]')
        .forEach((s) => s.remove())
      container.innerHTML = ''
      const content = `<div class="doc-body">${fillPlaceholders(html)}</div>`
      const previewer = new Previewer()
      const result = await previewer.preview(
        content,
        [{ 'inline.css': PREVIEW_CSS }],
        container
      )
      setPageCount(result?.total ?? null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBuilding(false)
      runningRef.current = false
      if (pendingRef.current !== null) {
        const next = pendingRef.current
        pendingRef.current = null
        void rebuild(next)
      }
    }
  }, [])

  // Rebuild preview on edits (debounced); re-render toolbar on every transaction.
  useEffect(() => {
    if (!editor) return
    const onUpdate = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => rebuild(editor.getHTML()), 600)
    }
    editor.on('update', onUpdate)
    editor.on('transaction', forceRender)
    rebuild(editor.getHTML())
    return () => {
      editor.off('update', onUpdate)
      editor.off('transaction', forceRender)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [editor, rebuild])

  return (
    <>
      <Header>
        <h1 className='text-lg font-semibold'>WYSIWYG Spike (Phase 0)</h1>
      </Header>
      <Main>
        <p className='mb-3 text-xs text-muted-foreground'>
          แก้ข้อความสดบนผืน A4 (ซ้าย) · แถบเครื่องมือเต็มแบบ Word ·
          พรีวิวแบ่งหน้า A4 จริง (ขวา) · ฟอนต์ไทย Sarabun
        </p>

        {editor && (
          <div className='mb-3 flex items-center gap-2'>
            <div className='flex-1'>
              <EditorToolbar editor={editor} />
            </div>
            <div className='flex shrink-0 items-center gap-2'>
              {pageCount != null && (
                <span className='text-xs text-muted-foreground'>
                  {pageCount} หน้า
                </span>
              )}
              <Button
                size='sm'
                variant='outline'
                className='h-8'
                onClick={() => rebuild(editor.getHTML())}
              >
                <RefreshCw className='size-3.5' />
                รีเฟรชพรีวิว
              </Button>
            </div>
          </div>
        )}

        {/* Split: editor canvas | paged preview */}
        <div className='grid flex-1 gap-4 lg:grid-cols-2'>
          <div className='overflow-auto rounded-md border bg-muted/30 p-4'>
            <div className='doc-canvas mx-auto bg-white shadow-sm'>
              <EditorContent editor={editor} />
            </div>
          </div>

          <div className='relative overflow-auto rounded-md border bg-muted/30 p-4'>
            {building && (
              <div className='absolute right-6 top-6 z-10 flex items-center gap-1.5 rounded bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow'>
                <Loader2 className='size-3 animate-spin' />
                กำลังแบ่งหน้า…
              </div>
            )}
            {err && (
              <div className='m-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive'>
                <p className='font-medium'>แบ่งหน้าไม่สำเร็จ</p>
                <p className='mt-1'>{err}</p>
              </div>
            )}
            <div ref={previewRef} className='paged-preview origin-top' />
          </div>
        </div>
      </Main>

      {/* Spike-local styling for the editable canvas + chips + tables + paged pages */}
      <style>{`
        .doc-canvas {
          width: 210mm;
          min-height: 297mm;
          padding: 20mm;
          box-sizing: border-box;
          font-family: 'Sarabun', sans-serif;
          font-size: 14px;
          line-height: 1.7;
          color: #111;
        }
        .doc-canvas .ProseMirror { outline: none; min-height: 100%; }
        .doc-canvas h1 { font-size: 20px; font-weight: 700; text-align: center; margin: 0 0 16px; }
        .doc-canvas h2 { font-size: 16px; font-weight: 700; margin: 16px 0 6px; }
        .doc-canvas h3 { font-size: 14px; font-weight: 700; margin: 12px 0 6px; }
        .doc-canvas p { margin: 0 0 8px; }
        .doc-canvas ul, .doc-canvas ol { margin: 0 0 8px; padding-inline-start: 24px; }
        .doc-canvas mark { padding: 0 2px; border-radius: 2px; }
        .doc-canvas table { border-collapse: collapse; width: 100%; margin: 8px 0; }
        .doc-canvas td, .doc-canvas th { border: 1px solid #999; padding: 4px 8px; min-width: 2em; }
        .doc-canvas th { background: #f1f5f9; }
        .doc-canvas hr { border: none; border-top: 1px solid #999; margin: 12px 0; }
        .doc-chip {
          display: inline-block;
          padding: 0 6px;
          border-radius: 4px;
          background: #e0f2fe;
          color: #0369a1;
          border: 1px solid #bae6fd;
          font-weight: 500;
          white-space: nowrap;
        }
        .paged-preview { transform: scale(0.62); transform-origin: top left; }
        .paged-preview .pagedjs_page {
          background: #fff;
          box-shadow: 0 1px 6px rgba(0,0,0,0.15);
          margin: 0 auto 16px;
        }
      `}</style>
    </>
  )
}
