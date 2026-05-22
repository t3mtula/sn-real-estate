import { useState } from 'react'
import type { TDocumentDefinitions } from 'pdfmake/interfaces'
import { toast } from 'sonner'
import { downloadPdf, getPdfBlob, openPdf } from './pdf-make'

/**
 * usePdf hook · trigger PDF gen ที่จัด loading state + error toast
 *
 * Usage:
 *   const { download, open, generating } = usePdf()
 *
 *   <Button
 *     onClick={() => download(contractDoc, `สัญญา-${id}`)}
 *     disabled={generating}
 *   >
 *     {generating ? 'กำลังสร้าง PDF...' : 'พิมพ์สัญญา'}
 *   </Button>
 */
export function usePdf() {
  const [generating, setGenerating] = useState(false)

  async function download(doc: TDocumentDefinitions, filename: string) {
    setGenerating(true)
    try {
      await downloadPdf(doc, filename)
    } catch (err) {
      toast.error('สร้าง PDF ไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setGenerating(false)
    }
  }

  async function open(doc: TDocumentDefinitions) {
    setGenerating(true)
    try {
      await openPdf(doc)
    } catch (err) {
      toast.error('สร้าง PDF ไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setGenerating(false)
    }
  }

  async function blob(doc: TDocumentDefinitions): Promise<Blob | null> {
    setGenerating(true)
    try {
      return await getPdfBlob(doc)
    } catch (err) {
      toast.error('สร้าง PDF ไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
      return null
    } finally {
      setGenerating(false)
    }
  }

  return { download, open, blob, generating }
}
