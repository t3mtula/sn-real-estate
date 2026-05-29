/**
 * The data fields that can be inserted as auto-fill chips in the document.
 * Single source of truth — used by:
 *   - the mention combobox list (type "@")            · mention-node.tsx
 *   - the "แทรกข้อมูล" toolbar dropdown                · doc-toolbar.tsx
 *   - the fill step that swaps chips for real values   · serialize/print
 *
 * The chip's stored `value` is the Thai `label`, which doubles as the merge
 * key, so `SAMPLE`/real-contract maps below are keyed by label.
 *
 * Phase 1 (reusable component) will make this list a prop instead of a const.
 */
export type DocField = { key: string; label: string }

export const DOC_FIELDS: DocField[] = [
  { key: 'tenant', label: 'ชื่อผู้เช่า' },
  { key: 'landlord', label: 'ชื่อผู้ให้เช่า' },
  { key: 'rate', label: 'ค่าเช่า' },
  { key: 'deposit', label: 'เงินประกัน' },
  { key: 'start', label: 'วันเริ่มสัญญา' },
  { key: 'end', label: 'วันสิ้นสุดสัญญา' },
  { key: 'property', label: 'ทรัพย์สินที่เช่า' },
  { key: 'contractNo', label: 'เลขที่สัญญา' },
]

/** Sample values for the preview (keyed by field label). */
export const SAMPLE_VALUES: Record<string, string> = {
  ชื่อผู้เช่า: 'นายสมชาย ใจดี',
  ชื่อผู้ให้เช่า: 'บริษัท สมบัตินภา จำกัด',
  ค่าเช่า: '10,000 บาท',
  เงินประกัน: '30,000 บาท',
  วันเริ่มสัญญา: '1 มกราคม 2569',
  วันสิ้นสุดสัญญา: '31 ธันวาคม 2570',
  ทรัพย์สินที่เช่า: 'อาคารพาณิชย์ 3 ชั้น เลขที่ 12/3',
  เลขที่สัญญา: 'SN.69-00001',
}
