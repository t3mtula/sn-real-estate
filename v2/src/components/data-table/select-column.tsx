/**
 * createSelectColumn — คอลัมน์ช่องติ๊ก "เลือก" กลาง (ของกลางทั้งแอป)
 *
 * แทนการ copy column 'select' ไปทุกหน้า · header = เลือกทั้งหน้า · cell = แสดงสถานะ
 * cell เป็น display-only (pointer-events-none) เพราะการคลิก/Shift-คลิก จัดการที่ระดับ
 * TableCell ของหน้า (รองรับเลือกช่วง) — column นี้แค่โชว์ว่าติ๊กอยู่ไหม
 *
 * ต้องใช้คู่กับ `getRowId: (row) => <entity id>` บน useReactTable เพื่อให้
 * toggleAllPageRowsSelected ติ๊ก key ตรงกับ entity id
 */
import { type ColumnDef } from '@tanstack/react-table'
import { Checkbox } from '@/components/ui/checkbox'

export function createSelectColumn<T>(): ColumnDef<T> {
  return {
    id: 'select',
    size: 28,
    enableSorting: false,
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected()
            ? true
            : table.getIsSomePageRowsSelected()
              ? 'indeterminate'
              : false
        }
        onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        aria-label='เลือกทั้งหมดในหน้า'
        onClick={(e) => e.stopPropagation()}
      />
    ),
    cell: ({ row }) => (
      // คลิกถูกจัดการที่ TableCell (รองรับ Shift+คลิกเลือกช่วง) — checkbox แค่โชว์สถานะ
      <Checkbox
        checked={row.getIsSelected()}
        aria-label='เลือก'
        tabIndex={-1}
        className='pointer-events-none'
      />
    ),
  }
}
