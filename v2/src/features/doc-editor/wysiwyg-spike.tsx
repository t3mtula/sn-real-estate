/**
 * WYSIWYG editor — Phase 0 technical spike.
 *
 * Goal: prove the chosen architecture before investing in the real editor —
 *   1. Rich-text editing live on an A4-width canvas (TipTap)        ← Word-like
 *   2. Inline "data chips" that stand in for auto-filled values     ← placeholders
 *   3. A side preview that shows REAL A4 page boundaries (paged.js) ← fixes the
 *      old "one long page" preview, must match the printed output
 *   4. Thai font (Sarabun) renders cleanly in both panes
 *
 * This file is throwaway scaffolding — Phase 1 extracts the reusable
 * "paper editor" component into @/components/yonghua. Do not build on it.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Previewer } from 'pagedjs'
import {
  Bold,
  Heading1,
  Heading2,
  List,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import {
  PLACEHOLDER_DEFS,
  Placeholder,
  type PlaceholderDef,
} from './placeholder-extension'

/* Sample contract values used to "fill" the chips in the preview pane —
 * proves the data-binding concept end-to-end. Phase 1 reads real contract. */
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
  <p>ลองพิมพ์/แก้ข้อความตรงนี้ได้เลย — ตัวหนา หัวข้อ บุลเล็ต และแทรกชิปข้อมูลได้จากแถบเครื่องมือด้านบน เพื่อทดสอบว่าการแบ่งหน้า A4 ในแผงขวาตรงกับที่พิมพ์จริง ลองพิมพ์ข้อความยาว ๆ หลายย่อหน้าเพื่อให้ดันขึ้นหน้าที่สองดู</p>
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

/** CSS handed to paged.js — defines the A4 page box + Thai typography. */
const PREVIEW_CSS = `
  @page { size: A4; margin: 20mm; }
  .doc-body { font-family: 'Sarabun', sans-serif; font-size: 14px; line-height: 1.7; color: #111; }
  .doc-body h1 { font-size: 20px; font-weight: 700; text-align: center; margin: 0 0 16px; }
  .doc-body h2 { font-size: 16px; font-weight: 700; margin: 16px 0 6px; }
  .doc-body p { margin: 0 0 8px; text-align: left; }
  .doc-body ul { margin: 0 0 8px; padding-inline-start: 24px; }
`

export function WysiwygSpike() {
  const previewRef = useRef<HTMLDivElement>(null)
  const [building, setBuilding] = useState(false)
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useEditor({
    extensions: [StarterKit, Placeholder],
    content: INITIAL_HTML,
  })

  /** Re-paginate the preview with paged.js. */
  const rebuild = useCallback(async (html: string) => {
    const container = previewRef.current
    if (!container) return
    setBuilding(true)
    setErr(null)
    try {
      // paged.js injects a global <style> each run — clear prior ones + pages.
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
    }
  }, [])

  // Rebuild on edits (debounced) + once on mount.
  useEffect(() => {
    if (!editor) return
    const trigger = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => rebuild(editor.getHTML()), 600)
    }
    editor.on('update', trigger)
    rebuild(editor.getHTML())
    return () => {
      editor.off('update', trigger)
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
          ทดสอบเทคนิค: แก้ข้อความสดบนผืน A4 (ซ้าย) · ชิปข้อมูลอัตโนมัติ ·
          พรีวิวแบ่งหน้า A4 จริง (ขวา) · ฟอนต์ไทย Sarabun
        </p>

        {/* Toolbar */}
        {editor && (
          <div className='mb-3 flex flex-wrap items-center gap-1 rounded-md border bg-card p-1.5'>
            <ToolbarButton
              active={editor.isActive('bold')}
              onClick={() => editor.chain().focus().toggleBold().run()}
              title='ตัวหนา'
            >
              <Bold className='size-4' />
            </ToolbarButton>
            <ToolbarButton
              active={editor.isActive('heading', { level: 1 })}
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 1 }).run()
              }
              title='หัวข้อใหญ่'
            >
              <Heading1 className='size-4' />
            </ToolbarButton>
            <ToolbarButton
              active={editor.isActive('heading', { level: 2 })}
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 2 }).run()
              }
              title='หัวข้อย่อย'
            >
              <Heading2 className='size-4' />
            </ToolbarButton>
            <ToolbarButton
              active={editor.isActive('bulletList')}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              title='รายการ'
            >
              <List className='size-4' />
            </ToolbarButton>

            <div className='mx-1 h-5 w-px bg-border' />
            <span className='px-1 text-xs text-muted-foreground'>แทรกข้อมูล:</span>
            {PLACEHOLDER_DEFS.map((def: PlaceholderDef) => (
              <Button
                key={def.token}
                size='sm'
                variant='secondary'
                className='h-7 px-2 text-xs'
                onClick={() => editor.chain().focus().insertPlaceholder(def).run()}
              >
                {def.label}
              </Button>
            ))}

            <div className='ml-auto flex items-center gap-2'>
              {pageCount != null && (
                <span className='text-xs text-muted-foreground'>
                  {pageCount} หน้า
                </span>
              )}
              <Button
                size='sm'
                variant='outline'
                className='h-7'
                onClick={() => editor && rebuild(editor.getHTML())}
              >
                <RefreshCw className='size-3.5' />
                รีเฟรชพรีวิว
              </Button>
            </div>
          </div>
        )}

        {/* Split: editor canvas | paged preview */}
        <div className='grid flex-1 gap-4 lg:grid-cols-2'>
          {/* A4 editing canvas */}
          <div className='overflow-auto rounded-md border bg-muted/30 p-4'>
            <div className='doc-canvas mx-auto bg-white shadow-sm'>
              <EditorContent editor={editor} />
            </div>
          </div>

          {/* Paged.js preview */}
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

      {/* Spike-local styling for the editable canvas + chips + paged pages */}
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
        .doc-canvas p { margin: 0 0 8px; }
        .doc-canvas ul { margin: 0 0 8px; padding-inline-start: 24px; }
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
        /* paged.js renders real-size A4 sheets — scale down to fit the pane */
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

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <Button
      type='button'
      size='sm'
      variant={active ? 'default' : 'ghost'}
      className='h-7 w-7 p-0'
      title={title}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
