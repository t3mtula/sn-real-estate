/**
 * WYSIWYG editor — Phase 0 spike (Plate).
 *
 * Left: rich-text editing on an A4 canvas (Plate + full toolbar, data chips).
 * Right: live A4 page-break preview — the editor value is serialized to HTML
 * (serialize.ts), chips are filled with sample data, then paged.js paginates
 * it into real A4 sheets so you see where the document breaks across pages.
 *
 * Throwaway scaffolding — Phase 1 extracts the reusable "paper editor" into
 * @/components/yonghua.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Value } from 'platejs'
import { Plate, usePlateEditor } from 'platejs/react'
import { Previewer } from 'pagedjs'
import { Loader2 } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Editor, EditorContainer } from '@/components/ui/editor'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DocToolbar } from './doc-toolbar'
import { DocPlateKit } from './plate-kit'
import { SAMPLE_VALUES } from './doc-fields'
import { fillChips, serializeDocToHtml } from './serialize'

const INITIAL_VALUE: Value = [
  { type: 'h1', align: 'center', children: [{ text: 'สัญญาเช่าอาคารพาณิชย์' }] },
  {
    type: 'p',
    children: [
      {
        text: 'สัญญาฉบับนี้ทำขึ้นระหว่าง บริษัท สมบัตินภา จำกัด ซึ่งต่อไปนี้เรียกว่า "ผู้ให้เช่า" ฝ่ายหนึ่ง กับ นายสมชาย ใจดี ซึ่งต่อไปนี้เรียกว่า "ผู้เช่า" อีกฝ่ายหนึ่ง ทั้งสองฝ่ายตกลงทำสัญญากันโดยมีข้อความดังต่อไปนี้',
      },
    ],
  },
  { type: 'h2', children: [{ text: 'ข้อ 1. ทรัพย์สินที่เช่า' }] },
  {
    type: 'p',
    children: [
      {
        text: 'ผู้ให้เช่าตกลงให้เช่า และผู้เช่าตกลงเช่าอาคารพาณิชย์ โดยคิดค่าเช่าเดือนละ 10,000 บาท มีกำหนดระยะเวลาเช่าตั้งแต่วันที่ 1 มกราคม 2569 ถึงวันที่ 31 ธันวาคม 2570',
      },
    ],
  },
  {
    type: 'p',
    children: [
      {
        text: 'ลองพิมพ์/แก้ข้อความ + กดปุ่มบนแถบเครื่องมือ แล้วดูแผงขวาว่าเอกสารตัดหน้า A4 ตรงไหน · กด "แทรกข้อมูล" เพื่อใส่ช่องที่เติมค่าจริงให้อัตโนมัติ (ดูฝั่งขวา)',
      },
    ],
  },
]

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

export function WysiwygSpike() {
  const editor = usePlateEditor({ plugins: DocPlateKit, value: INITIAL_VALUE })
  const previewRef = useRef<HTMLDivElement>(null)
  const [building, setBuilding] = useState(false)
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runningRef = useRef(false)
  const pendingRef = useRef<Value | null>(null)

  /** Serialize → fill chips → paginate with paged.js. Serialized so rapid
   * edits can't run two paged.js passes at once. */
  const rebuild = useCallback(async (value: Value) => {
    if (runningRef.current) {
      pendingRef.current = value
      return
    }
    const container = previewRef.current
    if (!container) return
    runningRef.current = true
    setBuilding(true)
    setErr(null)
    try {
      const html = fillChips(await serializeDocToHtml(value), SAMPLE_VALUES)
      document
        .querySelectorAll('style[data-pagedjs-inserted-styles]')
        .forEach((s) => s.remove())
      container.innerHTML = ''
      const previewer = new Previewer()
      const result = await previewer.preview(
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
  }, [])

  const schedule = useCallback(
    (value: Value) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => void rebuild(value), 600)
    },
    [rebuild]
  )

  // Initial render.
  useEffect(() => {
    void rebuild(editor.children as Value)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [editor, rebuild])

  return (
    <>
      <Header>
        <h1 className='text-lg font-semibold'>WYSIWYG Spike — Plate</h1>
      </Header>
      <Main>
        <p className='mb-3 text-xs text-muted-foreground'>
          แก้สดบนผืน A4 (ซ้าย) · แผงขวาแสดงการตัดหน้า A4 จริง + เติมข้อมูลในชิปให้เห็นผล
        </p>

        <TooltipProvider>
          <Plate editor={editor} onChange={({ value }) => schedule(value as Value)}>
            <div className='mb-3'>
              <DocToolbar />
            </div>

            <div className='grid gap-4 lg:grid-cols-2'>
              {/* A4 editing canvas */}
              <div className='overflow-auto rounded-md border bg-muted/30 p-4'>
                <div className='doc-canvas mx-auto bg-white shadow-sm'>
                  <EditorContainer>
                    <Editor variant='none' placeholder='พิมพ์ที่นี่…' />
                  </EditorContainer>
                </div>
              </div>

              {/* paged.js A4 page-break preview */}
              <div className='relative overflow-auto rounded-md border bg-muted/30 p-4'>
                <div className='mb-2 flex items-center gap-2 text-xs text-muted-foreground'>
                  <span>พรีวิวแบ่งหน้า A4 (ข้อมูลตัวอย่าง)</span>
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
            </div>
          </Plate>
        </TooltipProvider>
      </Main>

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
    </>
  )
}
