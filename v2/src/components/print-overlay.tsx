/**
 * PrintOverlay — fullscreen dark overlay with iframe srcdoc preview
 *
 * Ported UX from v1 RentalManagement.html #printOverlay:
 * - Dark navy backdrop (#1e3a5f header, blurred slate-900 backdrop)
 * - iframe srcdoc renders the print HTML with @media print baked in
 * - Print button calls iframe.contentWindow.print() — browser native
 * - ESC key closes
 *
 * Usage:
 *   const [html, setHtml] = useState<string | null>(null)
 *   <PrintOverlay open={!!html} html={html} title="..." onClose={() => setHtml(null)} />
 */

import { Printer, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  html: string | null
  title?: string
  /** Used by browser as suggested filename for "Save as PDF" — also reflected in iframe <title>. */
  fileName?: string
  onClose: () => void
}

export function PrintOverlay({ open, html, title, onClose }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  // ESC to close
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open || !html) return null

  function handlePrint() {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow) return
    iframe.contentWindow.focus()
    iframe.contentWindow.print()
  }

  const node = (
    <div
      className='fixed inset-0 z-[100] flex flex-col'
      style={{
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(4px)',
      }}
      role='dialog'
      aria-modal='true'
      aria-label={title ?? 'ตัวอย่างก่อนพิมพ์'}
    >
      {/* Navy header */}
      <header
        className='flex items-center gap-3 px-5 py-3 shadow-lg'
        style={{ background: '#1e3a5f' }}
      >
        <div className='flex flex-col leading-tight text-white'>
          <span className='text-[10px] font-medium tracking-[0.2em] text-slate-300 uppercase'>
            ตัวอย่างก่อนพิมพ์ · Print Preview
          </span>
          <span className='text-sm font-semibold'>{title ?? 'สัญญาเช่า'}</span>
        </div>

        <div className='ml-auto flex items-center gap-2'>
          <button
            type='button'
            onClick={handlePrint}
            className='inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors'
            style={{ background: '#3b82f6' }}
          >
            <Printer className='size-4' />
            พิมพ์ / บันทึก PDF
          </button>
          <button
            type='button'
            onClick={onClose}
            className='inline-flex items-center gap-2 rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-700/50'
            aria-label='ปิด'
          >
            <X className='size-4' />
            ปิด (ESC)
          </button>
        </div>
      </header>

      {/* Iframe area */}
      <div className='flex-1 overflow-hidden'>
        <iframe
          ref={iframeRef}
          title={title ?? 'ตัวอย่างสัญญา'}
          srcDoc={html}
          className='size-full border-0 bg-slate-200'
        />
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
