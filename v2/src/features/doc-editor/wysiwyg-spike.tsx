/**
 * WYSIWYG spike page — now just a thin host for the reusable <DocEditor>
 * (components/yonghua/doc-editor). Kept as a playground / preview route.
 */
import type { Value } from 'platejs'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { DocEditor } from '@/components/yonghua/doc-editor'
import { SAMPLE_VALUES } from './doc-fields'

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
        text: 'ลองพิมพ์/แก้ข้อความ + กดปุ่มบนแถบเครื่องมือ แล้วดูแผงขวาว่าเอกสารตัดหน้า A4 ตรงไหน · กด "แทรกข้อมูล" เพื่อใส่ช่องที่เติมค่าจริงให้อัตโนมัติ',
      },
    ],
  },
]

export function WysiwygSpike() {
  return (
    <>
      <Header>
        <h1 className='text-lg font-semibold'>WYSIWYG Spike — Plate</h1>
      </Header>
      <Main>
        <p className='mb-3 text-xs text-muted-foreground'>
          ตัวแก้เอกสาร A4 ของกลาง (&lt;DocEditor&gt;) · แก้สดซ้าย · พรีวิวแบ่งหน้า + เติมข้อมูลขวา
        </p>
        <DocEditor value={INITIAL_VALUE} previewData={SAMPLE_VALUES} />
      </Main>
    </>
  )
}
