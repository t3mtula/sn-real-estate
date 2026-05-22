import type { TDocumentDefinitions } from 'pdfmake/interfaces'
import { SARABUN_BOLD_VFS } from './sarabun-bold-vfs'

/**
 * pdfMake instance with Thai fonts (Sarabun/Kanit/Prompt) · lazy-loaded
 *
 * Lazy load = ไม่กิน main bundle · เปิด chunk เฉพาะตอนกดปริ้น
 *
 * Usage:
 *   await downloadPdf(doc, 'contract.pdf')
 *   await openPdf(doc)            // เปิดใน tab ใหม่
 *   const blob = await getPdfBlob(doc)  // upload · email · etc.
 *
 * doc definition ตัวอย่างดู src/lib/pdf/examples/
 */

// biome-ignore lint/suspicious/noExplicitAny: pdfmake instance type ไม่ครบใน @types
let pdfMakePromise: Promise<any> | null = null

async function loadPdfMake() {
  if (pdfMakePromise) return pdfMakePromise

  pdfMakePromise = (async () => {
    const [pdfMakeModule, vfsModule] = await Promise.all([
      import('pdfmake/build/pdfmake'),
      // @ts-expect-error · vfs ไม่มี types
      import('addthaifont-pdfmake/build/vfs_fonts'),
    ])
    // biome-ignore lint/suspicious/noExplicitAny: pdfmake's runtime shape differs from typed
    const pdfMake = (pdfMakeModule as any).default ?? pdfMakeModule

    // VFS = virtual file system ที่ pdfmake ใช้อ่าน font files
    // addthaifont-pdfmake@0.1.3-alpha ใช้ CJS `module.exports = vfs` (vfs เป็น
    // font dict ตรงๆ · ไม่ได้ห่อใน `pdfMake.vfs`) → Vite ESM interop แปลงเป็น
    // `{ default: <vfs dict> }`. ลอง shape ทั้ง 3 แบบ + fallback ว่าง.
    //
    // นอกจากนี้ package ตัวนี้ขาด Sarabun-Bold + BoldItalic ดังนั้นต้อง merge
    // SARABUN_BOLD_VFS (base64 จาก cadsondemak SIL OFL) เข้าไปเสมอ.
    // biome-ignore lint/suspicious/noExplicitAny: vfsModule's runtime shape varies
    const m = vfsModule as any
    const rawDefault = m.default
    const isFontDict = (o: unknown): o is Record<string, string> =>
      !!o &&
      typeof o === 'object' &&
      Object.values(o as Record<string, unknown>).every((v) => typeof v === 'string')
    const baseVfs: Record<string, string> =
      // shape A · UMD: { pdfMake: { vfs: {...} } }
      rawDefault?.pdfMake?.vfs ||
      m.pdfMake?.vfs ||
      // shape B · CJS direct: default is the dict
      (isFontDict(rawDefault) ? rawDefault : {}) ||
      // shape C · ESM namespace exports the dict at top level (no .default)
      (isFontDict(m) ? m : {}) ||
      {}
    pdfMake.vfs = { ...baseVfs, ...SARABUN_BOLD_VFS }

    // Register Thai fonts (มีให้ใน addthaifont-pdfmake)
    pdfMake.fonts = {
      Sarabun: {
        normal: 'Sarabun-Regular.ttf',
        bold: 'Sarabun-Bold.ttf',
        italics: 'Sarabun-Italic.ttf',
        bolditalics: 'Sarabun-BoldItalic.ttf',
      },
      Kanit: {
        normal: 'Kanit-Regular.ttf',
        bold: 'Kanit-Bold.ttf',
        italics: 'Kanit-Italic.ttf',
        bolditalics: 'Kanit-BoldItalic.ttf',
      },
      Prompt: {
        normal: 'Prompt-Regular.ttf',
        bold: 'Prompt-Bold.ttf',
        italics: 'Prompt-Italic.ttf',
        bolditalics: 'Prompt-BoldItalic.ttf',
      },
    }

    return pdfMake
  })()

  return pdfMakePromise
}

/**
 * Helper · merge defaults ให้ใช้ Sarabun + A4 + page margin ปกติ
 */
function withDefaults(doc: TDocumentDefinitions): TDocumentDefinitions {
  return {
    pageSize: doc.pageSize ?? 'A4',
    pageMargins: doc.pageMargins ?? [40, 60, 40, 60],
    defaultStyle: {
      font: 'Sarabun',
      fontSize: 12,
      ...doc.defaultStyle,
    },
    ...doc,
  }
}

/**
 * createPdf · low-level · ใช้กับ pdf.download() / open() / getBlob() เอง
 */
export async function createPdf(doc: TDocumentDefinitions) {
  const pdfMake = await loadPdfMake()
  return pdfMake.createPdf(withDefaults(doc))
}

/**
 * Download PDF เป็น file
 */
export async function downloadPdf(doc: TDocumentDefinitions, filename: string) {
  const pdf = await createPdf(doc)
  pdf.download(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
}

/**
 * Open PDF ใน tab ใหม่ (browser PDF viewer)
 */
export async function openPdf(doc: TDocumentDefinitions) {
  const pdf = await createPdf(doc)
  pdf.open()
}

/**
 * Get PDF as Blob · ใช้ upload Supabase Storage · email attach · ฯลฯ
 */
export async function getPdfBlob(doc: TDocumentDefinitions): Promise<Blob> {
  const pdf = await createPdf(doc)
  return new Promise<Blob>((resolve) => {
    // biome-ignore lint/suspicious/noExplicitAny: pdfmake callback type
    pdf.getBlob((blob: Blob) => resolve(blob))
  })
}

/**
 * Get PDF as base64 string · บางครั้งใช้กับ API
 */
export async function getPdfBase64(doc: TDocumentDefinitions): Promise<string> {
  const pdf = await createPdf(doc)
  return new Promise<string>((resolve) => {
    // biome-ignore lint/suspicious/noExplicitAny: pdfmake callback type
    pdf.getBase64((base64: string) => resolve(base64))
  })
}
