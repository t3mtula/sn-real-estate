import type { TDocumentDefinitions } from 'pdfmake/interfaces'

/**
 * pdfMake instance — DEBUG VARIANT
 *
 * Stripped ทุก Thai font registration · ใช้ Helvetica built-in only.
 * เพื่อ confirm ว่า pdfmake pipeline + getBlob callback ทำงาน
 * ถ้าตอนนี้ generate ออก → ปัญหาคือ addthaifont registration
 * ถ้ายัง hang → pdfmake library/Vite chunk เสีย
 */

// biome-ignore lint/suspicious/noExplicitAny: pdfmake instance type ไม่ครบใน @types
let pdfMakePromise: Promise<any> | null = null

async function loadPdfMake() {
  if (pdfMakePromise) return pdfMakePromise

  pdfMakePromise = (async () => {
    const pdfMakeModule = await import('pdfmake/build/pdfmake')
    // biome-ignore lint/suspicious/noExplicitAny: pdfmake's runtime shape differs from typed
    const pdfMake = (pdfMakeModule as any).default ?? pdfMakeModule
    // No vfs, no fonts assignment — pdfmake should fall back to built-in
    // Roboto/Helvetica from its own internal vfs.
    return pdfMake
  })()

  return pdfMakePromise
}

function withDefaults(doc: TDocumentDefinitions): TDocumentDefinitions {
  return {
    pageSize: doc.pageSize ?? 'A4',
    pageMargins: doc.pageMargins ?? [40, 60, 40, 60],
    ...doc,
  }
}

export async function createPdf(doc: TDocumentDefinitions) {
  const pdfMake = await loadPdfMake()
  return pdfMake.createPdf(withDefaults(doc))
}

export async function downloadPdf(doc: TDocumentDefinitions, filename: string) {
  const pdf = await createPdf(doc)
  pdf.download(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
}

export async function openPdf(doc: TDocumentDefinitions) {
  const pdf = await createPdf(doc)
  pdf.open()
}

export async function getPdfBlob(
  doc: TDocumentDefinitions,
  timeoutMs = 30_000,
): Promise<Blob> {
  const pdf = await createPdf(doc)
  return new Promise<Blob>((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error(`PDF generation timed out after ${timeoutMs / 1000}s`))
    }, timeoutMs)
    try {
      // biome-ignore lint/suspicious/noExplicitAny: pdfmake callback type
      pdf.getBlob((blob: Blob) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(blob)
      })
    } catch (err) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(err instanceof Error ? err : new Error(String(err)))
    }
  })
}

export async function getPdfBase64(doc: TDocumentDefinitions): Promise<string> {
  const pdf = await createPdf(doc)
  return new Promise<string>((resolve) => {
    // biome-ignore lint/suspicious/noExplicitAny: pdfmake callback type
    pdf.getBase64((base64: string) => resolve(base64))
  })
}
