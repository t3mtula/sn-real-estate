import { useState } from 'react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

/**
 * useExportCSV / useImportCSV · CSV + Excel helpers (SheetJS)
 *
 * Export:
 *   const { exportCSV, exportXLSX } = useExportCSV()
 *   exportCSV(customers, 'customers-2569.csv', {
 *     headers: { name: 'ชื่อ', phone: 'เบอร์', email: 'อีเมล' },
 *   })
 *
 * Import:
 *   const { parseFile, parsing } = useImportCSV<Customer>()
 *   <Input type="file" accept=".csv,.xlsx,.xls" onChange={async (e) => {
 *     const rows = await parseFile(e.target.files[0])
 *     // preview · validate · then save
 *   }} />
 */

interface ExportOptions<T> {
  /** map field key → column header · ถ้าไม่ใส่จะใช้ key เป็น header */
  headers?: Partial<Record<keyof T, string>>
  /** order columns · default order ของ Object.keys() */
  columns?: (keyof T)[]
  /** sheet name (xlsx only) · default 'Sheet1' */
  sheetName?: string
}

export function useExportCSV() {
  function buildSheet<T extends Record<string, unknown>>(
    rows: T[],
    options: ExportOptions<T> = {},
  ): XLSX.WorkSheet {
    const cols = options.columns ?? (rows[0] ? (Object.keys(rows[0]) as (keyof T)[]) : [])
    const headers = (options.headers ?? {}) as Record<string, string>
    const headerRow = cols.map((c) => headers[String(c)] ?? String(c))
    const dataRows = rows.map((r) => cols.map((c) => r[c] ?? ''))
    return XLSX.utils.aoa_to_sheet([headerRow, ...dataRows])
  }

  function exportCSV<T extends Record<string, unknown>>(
    rows: T[],
    filename: string,
    options: ExportOptions<T> = {},
  ) {
    if (rows.length === 0) {
      toast.warning('ไม่มีข้อมูลให้ export')
      return
    }
    const ws = buildSheet(rows, options)
    const csv = XLSX.utils.sheet_to_csv(ws)
    // ﻿ = BOM · Excel เปิดไฟล์ UTF-8 ภาษาไทยไม่เป็น mojibake
    const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
    triggerDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`)
    toast.success(`Export ${rows.length} แถวเรียบร้อย`)
  }

  function exportXLSX<T extends Record<string, unknown>>(
    rows: T[],
    filename: string,
    options: ExportOptions<T> = {},
  ) {
    if (rows.length === 0) {
      toast.warning('ไม่มีข้อมูลให้ export')
      return
    }
    const ws = buildSheet(rows, options)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, options.sheetName ?? 'Sheet1')
    XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
    toast.success(`Export ${rows.length} แถวเรียบร้อย`)
  }

  return { exportCSV, exportXLSX }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function useImportCSV<T extends Record<string, unknown>>() {
  const [parsing, setParsing] = useState(false)

  async function parseFile(file: File): Promise<T[]> {
    setParsing(true)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', cellDates: true })
      const sheetName = wb.SheetNames[0]
      if (!sheetName) throw new Error('ไม่พบ sheet ในไฟล์')
      const ws = wb.Sheets[sheetName]
      if (!ws) throw new Error('Sheet ว่าง')
      const rows = XLSX.utils.sheet_to_json<T>(ws, { defval: null })
      return rows
    } finally {
      setParsing(false)
    }
  }

  return { parseFile, parsing }
}
