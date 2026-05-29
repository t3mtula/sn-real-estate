/**
 * WYSIWYG editor — Phase 0 spike, rebuilt on Plate (was bare TipTap).
 *
 * Why Plate: it ships the editor PLUS tested shadcn/ui toolbar components, so
 * lists / tables / indent / alignment / fonts all work out of the box instead
 * of being hand-wired and buggy. See plate-kit.ts for the plugin set and
 * doc-toolbar.tsx for the toolbar.
 *
 * Still on the to-do list (next iteration): paged.js A4 page-break preview and
 * the auto-fill data chips — both proven earlier; re-wiring them onto Plate.
 *
 * Throwaway scaffolding — Phase 1 extracts the reusable "paper editor" into
 * @/components/yonghua.
 */
import type { Value } from 'platejs'
import { Plate, usePlateEditor } from 'platejs/react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Editor, EditorContainer } from '@/components/ui/editor'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DocToolbar } from './doc-toolbar'
import { DocPlateKit } from './plate-kit'

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
        text: 'ลองพิมพ์/แก้ข้อความตรงนี้ได้เลย แล้วกดปุ่มบนแถบเครื่องมือ — ทำหัวข้อ ตัวหนา สี ไฮไลต์ จัดแนว เยื้องย่อหน้า ระยะบรรทัด และรายการเลข/จุด',
      },
    ],
  },
]

export function WysiwygSpike() {
  const editor = usePlateEditor({ plugins: DocPlateKit, value: INITIAL_VALUE })

  return (
    <>
      <Header>
        <h1 className='text-lg font-semibold'>WYSIWYG Spike — Plate</h1>
      </Header>
      <Main>
        <p className='mb-3 text-xs text-muted-foreground'>
          ตัวแก้เอกสารบนของสำเร็จรูป (Plate) · ลิสต์/ตาราง/เยื้องย่อหน้า/สี ใช้ได้จริง
          ไม่ต้องไล่แก้เอง · พรีวิวแบ่งหน้า A4 + ชิปข้อมูล จะต่อกลับมาขั้นถัดไป
        </p>

        <TooltipProvider>
          <Plate editor={editor}>
            <div className='sticky top-0 z-10 mb-3'>
              <DocToolbar />
            </div>
            <div className='overflow-auto rounded-md border bg-muted/30 p-4'>
              <div className='doc-canvas mx-auto bg-white shadow-sm'>
                <EditorContainer>
                  <Editor variant='none' placeholder='พิมพ์ที่นี่…' />
                </EditorContainer>
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
      `}</style>
    </>
  )
}
