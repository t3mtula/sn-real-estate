/**
 * PDF generation · pdfmake + Thai fonts (Sarabun/Kanit/Prompt)
 *
 * ลำดับเลือก approach:
 * - **PDF จริง** (ส่งทาง LINE/email · ตัดหน้าคุมเอง) → ใช้ที่นี่ (pdfmake)
 * - **Browser print เร็วๆ** (Ctrl+P preview · ลูกน้องพิมพ์เอง) → ใช้ @/components/yonghua/print (CSS-only)
 *
 * Why pdfmake:
 * - addthaifont-pdfmake = Sarabun/Kanit/Prompt built-in · ไม่ต้อง wrangle TTF
 * - Page break คุม 100% (`pageBreak: 'before'` · `dontBreakRows: true`)
 * - Cross-browser PDF identical
 * - ส่งไฟล์ได้จริง
 *
 * Setup:
 * - lazy-loaded · ไม่กิน main bundle จนกว่าจะใช้
 * - Default font = Sarabun · A4 portrait · margin 40/60/40/60 pt
 *
 * Examples: src/lib/pdf/examples/{contract,invoice}.ts
 */

export { createPdf, downloadPdf, getPdfBase64, getPdfBlob, openPdf } from './pdf-make'
export { usePdf } from './use-pdf'
export type { TDocumentDefinitions, Content, Style, TableCell } from 'pdfmake/interfaces'
