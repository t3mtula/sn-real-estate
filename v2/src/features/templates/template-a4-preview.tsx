import { useState } from 'react'
import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { renderTemplateText } from '@/features/contracts/print/default-template'
import type { TemplateData } from './types'

interface Props {
  draft: TemplateData
}

const SAMPLE = { landlord: 'บริษัท สมบัตินภา จำกัด', tenant: 'นายสมชาย ใจดี' }

function renderHtml(text: string, ctx: { landlord: string; tenant: string }) {
  return renderTemplateText(text, ctx)
    .replace(/<strong>(.*?)<\/strong>/g, '<strong>$1</strong>')
}

export function TemplateA4Preview({ draft }: Props) {
  const [showPlaceholders, setShowPlaceholders] = useState(false)

  const ctx = showPlaceholders
    ? { landlord: '{{landlord}}', tenant: '{{tenant}}' }
    : SAMPLE

  return (
    <div className='flex h-full flex-col'>
      {/* toolbar */}
      <div className='mb-3 flex items-center gap-2'>
        <span className='text-sm font-medium text-muted-foreground'>A4 Preview</span>
        <Button
          size='sm'
          variant={showPlaceholders ? 'default' : 'outline'}
          className='ml-auto h-7 gap-1 text-xs'
          onClick={() => setShowPlaceholders((v) => !v)}
        >
          <Eye className='size-3' />
          {showPlaceholders ? 'placeholder' : 'ตัวอย่างชื่อ'}
        </Button>
      </div>

      {/* A4 paper */}
      <div className='flex-1 overflow-y-auto rounded-md border bg-muted/30 p-3'>
        <div
          className='mx-auto bg-white text-[#1e293b] shadow-md'
          style={{
            width: '210mm',
            maxWidth: '100%',
            minHeight: '297mm',
            padding: '20mm 18mm',
            fontFamily: "'Sarabun', sans-serif",
            fontSize: '13px',
            lineHeight: '1.7',
            boxSizing: 'border-box',
          }}
        >
          {/* header */}
          <div style={{ borderBottom: '3px solid #0f4c5c', paddingBottom: '6px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f4c5c', letterSpacing: '0.03em' }}>
                  สัญญาเช่า
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '0.1em', marginTop: '1px' }}>
                  TENANCY AGREEMENT
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '11px', color: '#475569' }}>
                <div style={{ fontSize: '9px', color: '#94a3b8', marginBottom: '2px' }}>เลขที่สัญญา</div>
                <div style={{ fontWeight: 600, color: '#0f4c5c' }}>SN.XX.XX-XXXX</div>
              </div>
            </div>
          </div>

          {/* intro */}
          {draft.intro && (
            <p
              style={{ marginBottom: '12px', textIndent: '1.5em', textAlign: 'justify' }}
              dangerouslySetInnerHTML={{ __html: renderHtml(draft.intro, ctx) }}
            />
          )}

          {/* clauses */}
          <div style={{ marginBottom: '12px' }}>
            {draft.clauses.map((c, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: order is identity
              <div key={`p-${i}`} style={{ marginBottom: '10px' }}>
                <p style={{ textAlign: 'justify' }}>
                  <strong>ข้อ {i + 1}.</strong>{' '}
                  <span dangerouslySetInnerHTML={{ __html: renderHtml(c.text, ctx) }} />
                </p>
                {(c.sub ?? []).map((sub, j) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: order is identity
                  <p
                    key={`p-${i}-${j}`}
                    style={{ paddingLeft: '2em', textAlign: 'justify', marginTop: '6px' }}
                  >
                    <strong>{i + 1}.{j + 1}</strong>{' '}
                    <span dangerouslySetInnerHTML={{ __html: renderHtml(sub, ctx) }} />
                  </p>
                ))}
              </div>
            ))}
          </div>

          {/* closing */}
          {draft.closing && (
            <p
              style={{ textIndent: '1.5em', textAlign: 'justify', marginBottom: '20px' }}
              dangerouslySetInnerHTML={{ __html: renderHtml(draft.closing, ctx) }}
            />
          )}

          {/* empty state */}
          {!draft.intro && draft.clauses.length === 0 && !draft.closing && (
            <div style={{ color: '#94a3b8', textAlign: 'center', padding: '40px 0', fontSize: '13px' }}>
              ยังไม่มีเนื้อหา · เริ่มพิมพ์ทางซ้ายเพื่อดู preview
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
