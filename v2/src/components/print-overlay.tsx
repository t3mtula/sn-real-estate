/**
 * PrintOverlay — centered modal preview, not fullscreen.
 *
 * Layout:
 *   - Dark backdrop with click-to-close (list/page visible around edges)
 *   - Centered window ~85% × 92% of viewport · rounded corners · navy header
 *   - iframe srcdoc renders the print HTML with @media print baked in
 *   - Print button calls iframe.contentWindow.print() — browser native
 *   - ESC closes · click backdrop closes
 */

import { Download, Printer, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  html: string | null
  title?: string
  /** Filename for "ดาวน์โหลด" button (omit to hide it) */
  downloadName?: string
  onClose: () => void
}

export function PrintOverlay({ open, html, title, downloadName, onClose }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

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

  function handleDownload() {
    if (!html || !downloadName) return
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = downloadName
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const node = (
    <div
      className='fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8'
      style={{
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(2px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role='dialog'
      aria-modal='true'
      aria-label={title ?? 'ตัวอย่างก่อนพิมพ์'}
    >
      <div className='flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl ring-1 ring-black/10'>
        {/* Navy header */}
        <header
          className='flex flex-shrink-0 items-center gap-3 px-5 py-3'
          style={{ background: '#1e3a5f' }}
        >
          <div className='flex min-w-0 flex-col leading-tight text-white'>
            <span className='text-[10px] font-medium uppercase tracking-[0.2em] text-slate-300'>
              ตัวอย่างก่อนพิมพ์ · Print Preview
            </span>
            <span className='truncate text-sm font-semibold'>
              {title ?? 'เอกสาร'}
            </span>
          </div>

          <div className='ml-auto flex items-center gap-2'>
            {downloadName && (
              <button
                type='button'
                onClick={handleDownload}
                className='inline-flex items-center gap-1.5 rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-200 transition-colors hover:bg-slate-700/50'
              >
                <Download className='size-3.5' />
                ดาวน์โหลด
              </button>
            )}
            <button
              type='button'
              onClick={handlePrint}
              className='inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-semibold text-white transition-colors'
              style={{ background: '#3b82f6' }}
            >
              <Printer className='size-4' />
              พิมพ์ / บันทึก PDF
            </button>
            <button
              type='button'
              onClick={onClose}
              className='inline-flex items-center gap-1.5 rounded-md border border-slate-600 px-2.5 py-1.5 text-xs text-slate-200 transition-colors hover:bg-slate-700/50'
              aria-label='ปิด'
              title='ESC'
            >
              <X className='size-3.5' />
              ปิด
            </button>
          </div>
        </header>

        {/* Iframe area */}
        <div className='flex-1 overflow-hidden bg-slate-200'>
          <iframe
            ref={iframeRef}
            title={title ?? 'ตัวอย่างเอกสาร'}
            srcDoc={html}
            className='size-full border-0'
          />
        </div>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
