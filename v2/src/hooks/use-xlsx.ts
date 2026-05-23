import { useCallback } from 'react'
import { toast } from 'sonner'

/**
 * useExportXlsx · real Excel (.xlsx) export ผ่าน exceljs
 *
 * - bold + filled header row · column widths
 * - Thai unicode-safe (UTF-8 native)
 * - lazy-loads exceljs (โหลด chunk เฉพาะตอนกดปุ่ม export)
 *
 * Usage:
 *   const exportXlsx = useExportXlsx()
 *   await exportXlsx('สัญญา_2569-05-23.xlsx', [
 *     { header: 'เลขที่', key: 'no', width: 14 },
 *     { header: 'ผู้เช่า', key: 'tenant', width: 28 },
 *   ], rows, { sheetName: 'สัญญาเช่า' })
 */

export type XlsxColumn = {
  /** ชื่อ column ภาษาไทย (header row) */
  header: string
  /** field key ใน object ของ row */
  key: string
  /** ความกว้าง column (chars) · default 15 */
  width?: number
}

export type ExportXlsxOptions = {
  /** sheet name · default 'Sheet1' */
  sheetName?: string
}

export function useExportXlsx() {
  return useCallback(
    async <T extends Record<string, unknown>>(
      filename: string,
      columns: XlsxColumn[],
      rows: T[],
      options: ExportXlsxOptions = {},
    ) => {
      if (rows.length === 0) {
        toast.warning('ไม่มีข้อมูลให้ export')
        return
      }

      try {
        const ExcelJS = (await import('exceljs')).default
        const wb = new ExcelJS.Workbook()
        const ws = wb.addWorksheet(options.sheetName ?? 'Sheet1')

        ws.columns = columns.map((c) => ({
          header: c.header,
          key: c.key,
          width: c.width ?? 15,
        }))

        rows.forEach((r) => ws.addRow(r))

        // Bold + filled header row
        const headerRow = ws.getRow(1)
        headerRow.font = { bold: true }
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1F5F9' },
        }
        headerRow.alignment = { vertical: 'middle' }

        const buf = await wb.xlsx.writeBuffer()
        const blob = new Blob([buf], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        toast.success(`Export ${rows.length} แถวเรียบร้อย`)
      } catch (err) {
        toast.error('Export ไม่สำเร็จ', {
          description: err instanceof Error ? err.message : String(err),
        })
      }
    },
    [],
  )
}

/**
 * BE-format filename · `{entity}_{YYYY-MM-DD พ.ศ.}.xlsx`
 * เช่น `สัญญา_2569-05-23.xlsx`
 */
export function xlsxFilename(entity: string, date: Date = new Date()): string {
  const beYear = date.getFullYear() + 543
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${entity}_${beYear}-${mm}-${dd}.xlsx`
}
