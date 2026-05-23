import type { TDocumentDefinitions } from 'pdfmake/interfaces'

/**
 * pdfMake instance with THSarabunNew Thai font
 *
 * Pattern adapted from Zola Sign v1 (Zola-QT-src/js/14-pdfmake-shared.js)
 * — proven · ใช้งานทุกวันใน production
 *
 * Key differences from earlier (broken) attempts:
 * 1. **Don't use addthaifont-pdfmake** — its vfs lacks Bold + has shape
 *    mismatch under Vite ESM interop · caused 30s hangs.
 * 2. **Self-host fonts in /public/fonts/** — fetch at runtime, convert to
 *    base64 (chunked to avoid stack overflow), inject directly into
 *    pdfMake.vfs.
 * 3. **Use `pdfmake.createPdf(doc).getBuffer(cb)`** — NOT `getBlob`.
 *    `getBlob` callback never fires for our docs (pdfmake bug · unclear
 *    root cause). `getBuffer` works fine.
 * 4. **Wrap buffer ⇒ Blob ⇒ object URL ⇒ <a> click** to avoid
 *    `window.open()` popup-block under async chains.
 */

// biome-ignore lint/suspicious/noExplicitAny: pdfmake instance type ไม่ครบใน @types
let pdfMakePromise: Promise<any> | null = null
let vfsPromise: Promise<Record<string, string>> | null = null

/** Chunked ArrayBuffer → base64 — avoids "Maximum call stack" on >300 KB */
function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  const CHUNK = 0x8000 // 32 KB
  let s = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + CHUNK)),
    )
  }
  return btoa(s)
}

/** Fetch + base64-encode the two TTF files once · cache singleton */
async function getVfs(): Promise<Record<string, string>> {
  if (vfsPromise) return vfsPromise
  vfsPromise = (async () => {
    const [reg, bold] = await Promise.all([
      fetch('/fonts/THSarabunNew.ttf').then((r) => {
        if (!r.ok) throw new Error(`THSarabunNew.ttf: ${r.status}`)
        return r.arrayBuffer()
      }),
      fetch('/fonts/THSarabunNew-Bold.ttf').then((r) => {
        if (!r.ok) throw new Error(`THSarabunNew-Bold.ttf: ${r.status}`)
        return r.arrayBuffer()
      }),
    ])
    return {
      'THSarabunNew.ttf': bufferToBase64(reg),
      'THSarabunNew-Bold.ttf': bufferToBase64(bold),
    }
  })()
  return vfsPromise
}

const FONT_DEF = {
  THSarabunNew: {
    normal: 'THSarabunNew.ttf',
    bold: 'THSarabunNew-Bold.ttf',
    italics: 'THSarabunNew.ttf',
    bolditalics: 'THSarabunNew-Bold.ttf',
  },
}

async function loadPdfMake() {
  if (pdfMakePromise) return pdfMakePromise
  pdfMakePromise = (async () => {
    const [pdfMakeModule, vfs] = await Promise.all([
      import('pdfmake/build/pdfmake'),
      getVfs(),
    ])
    // biome-ignore lint/suspicious/noExplicitAny: pdfmake's runtime shape differs from typed
    const pdfMake = (pdfMakeModule as any).default ?? pdfMakeModule
    pdfMake.vfs = Object.assign(pdfMake.vfs ?? {}, vfs)
    pdfMake.fonts = Object.assign(pdfMake.fonts ?? {}, FONT_DEF)
    return pdfMake
  })()
  return pdfMakePromise
}

function withDefaults(doc: TDocumentDefinitions): TDocumentDefinitions {
  return {
    pageSize: doc.pageSize ?? 'A4',
    pageMargins: doc.pageMargins ?? [40, 60, 40, 60],
    defaultStyle: {
      font: 'THSarabunNew',
      fontSize: 14, // THSarabunNew renders slightly smaller than Sarabun · bump default
      lineHeight: 1.6,
      ...doc.defaultStyle,
    },
    ...doc,
  }
}

export async function createPdf(doc: TDocumentDefinitions) {
  const pdfMake = await loadPdfMake()
  return pdfMake.createPdf(withDefaults(doc))
}

/**
 * Build PDF as Blob via getBuffer (NOT getBlob — that one hangs).
 */
export async function getPdfBlob(doc: TDocumentDefinitions): Promise<Blob> {
  const pdf = await createPdf(doc)
  return new Promise<Blob>((resolve, reject) => {
    try {
      pdf.getBuffer((buffer: ArrayBuffer) => {
        resolve(new Blob([buffer], { type: 'application/pdf' }))
      })
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)))
    }
  })
}

/**
 * Open PDF in a new tab via anchor click — popup-block friendly.
 * URL is revoked after 60s.
 */
export async function openPdf(doc: TDocumentDefinitions) {
  const blob = await getPdfBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), {
    href: url,
    target: '_blank',
    rel: 'noopener',
  })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Download PDF as file.
 */
export async function downloadPdf(doc: TDocumentDefinitions, filename: string) {
  const blob = await getPdfBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: filename.endsWith('.pdf') ? filename : `${filename}.pdf`,
  })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function getPdfBase64(doc: TDocumentDefinitions): Promise<string> {
  const pdf = await createPdf(doc)
  return new Promise<string>((resolve) => {
    // biome-ignore lint/suspicious/noExplicitAny: pdfmake callback type
    pdf.getBase64((base64: string) => resolve(base64))
  })
}
