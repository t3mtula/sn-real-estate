/**
 * useRangeSelection — เลือกหลายรายการ + Shift-click เลือกเป็นช่วง (ของกลางทั้งแอป)
 *
 * ไม่ผูกกับ TanStack Table → ใช้กับ list / การ์ด อะไรก็ได้
 * - state shape = `RowSelectionState` (Record<id, boolean>) → ต่อกับ table ได้ตรงๆ
 *   ผ่าน `state={{ rowSelection }}` + `onRowSelectionChange={setRowSelection}`
 *   (ต้องตั้ง `getRowId: (row) => getId(row)` ให้ key ตรงกับ entity id)
 * - `rangeTo(id, ordered)` รับ "ลำดับรายการที่เห็นบนจอจริง" (หลัง sort/filter) เข้ามา
 *   → เลือกช่วงถูกเสมอ ไม่ต้องพึ่ง table (การ์ดส่ง filter.filtered เข้ามาได้)
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import { type RowSelectionState } from '@tanstack/react-table'

export type RangeSelection<T> = {
  rowSelection: RowSelectionState
  setRowSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>
  selectedIds: string[]
  selectedCount: number
  /** id ปัจจุบันถูกเลือกอยู่ไหม */
  isSelected: (id: string) => boolean
  /** ล้างการเลือกทั้งหมด + ล้าง anchor */
  clear: () => void
  /** ติ๊ก/เอาติ๊กออก 1 รายการ + ตั้ง anchor เป็นรายการนี้ */
  toggle: (id: string) => void
  /**
   * เลือกทุกรายการระหว่าง anchor → id (อิงลำดับ `ordered` ที่ส่งเข้ามา)
   * คืน false ถ้ายังไม่มี anchor → ให้ caller fallback ไป toggle เดี่ยว
   */
  rangeTo: (id: string, ordered: T[]) => boolean
}

export function useRangeSelection<T>(getId: (item: T) => string): RangeSelection<T> {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  // anchor สำหรับ Shift-click เลือกช่วง
  const lastSelectedId = useRef<string | null>(null)

  const selectedIds = useMemo(
    () => Object.keys(rowSelection).filter((k) => rowSelection[k]),
    [rowSelection],
  )

  const isSelected = useCallback((id: string) => !!rowSelection[id], [rowSelection])

  const clear = useCallback(() => {
    setRowSelection({})
    lastSelectedId.current = null
  }, [])

  const toggle = useCallback((id: string) => {
    setRowSelection((prev) => {
      const next = { ...prev }
      if (next[id]) delete next[id]
      else next[id] = true
      return next
    })
    lastSelectedId.current = id
  }, [])

  const rangeTo = useCallback(
    (id: string, ordered: T[]): boolean => {
      const anchorId = lastSelectedId.current
      if (!anchorId || anchorId === id) return false
      const ids = ordered.map(getId)
      const ai = ids.indexOf(anchorId)
      const ti = ids.indexOf(id)
      if (ai < 0 || ti < 0) return false
      const [lo, hi] = ai < ti ? [ai, ti] : [ti, ai]
      setRowSelection((prev) => {
        const next = { ...prev }
        for (let i = lo; i <= hi; i++) next[ids[i]] = true
        return next
      })
      // anchor ไม่ขยับตอนเลือกช่วง — ให้ลากช่วงต่อจากจุดเดิมได้
      return true
    },
    [getId],
  )

  return {
    rowSelection,
    setRowSelection,
    selectedIds,
    selectedCount: selectedIds.length,
    isSelected,
    clear,
    toggle,
    rangeTo,
  }
}
