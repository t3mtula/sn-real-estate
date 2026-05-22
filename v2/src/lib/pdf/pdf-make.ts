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
      import('addthaifont-pdfmake/build/vfs_fonts') as Promise<{
        default?: { pdfMake?: { vfs: Record<string, string> } }
        pdfMake?: { vfs: Record<string, string> }
      }>,
    ])
    // biome-ignore lint/suspicious/noExplicitAny: pdfmake's runtime shape differs from typed
    const pdfMake = (pdfMakeModule as any).default ?? pdfMakeModule

    // VFS = virtual file system ที่ pdfmake ใช้อ่าน font files
    // addthaifont-pdfmake ขาด Sarabun-Bold + BoldItalic — merge มาจาก local base64
    const baseVfs = vfsModule.default?.pdfMake?.vfs ?? vfsModule.pdfMake?.vfs ?? {}
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
