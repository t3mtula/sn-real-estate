import { useState } from 'react'
import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { renderTemplateText } from '@/features/contracts/print/default-template'
import { resolveAttachments, type TemplateData } from './types'

interface Props {
  draft: TemplateData
}

const SAMPLE = {
  landlord: 'บริษัท สมบัตินภา จำกัด',
  tenant: 'นายสมชาย ใจดี',
  date: '1 มกราคม 2569',
  contractNo: 'SN.XX-XX-XXXX',
  madeAt: 'จังหวัดราชบุรี',
}

const PLACEHOLDERS = {
  landlord: '{{landlord}}',
  tenant: '{{tenant}}',
  date: '{{date}}',
  contractNo: '{{contractNo}}',
  madeAt: '{{madeAt}}',
}

function renderHtml(text: string, ctx: { landlord: string; tenant: string }) {
  return renderTemplateText(text, ctx)
    .replace(/<strong>(.*?)<\/strong>/g, '<strong>$1</strong>')
}

/* ─────────── small primitives ─────────── */

function SignatureCell({ label }: { label: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 4px' }}>
      <div style={{ height: '36px' }} />
      <div
        style={{
          borderTop: '1px solid #0f4c5c',
          margin: '0 12px',
          paddingTop: '6px',
          fontSize: '11px',
          color: '#475569',
        }}
      >
        ({label})
      </div>
      <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
        วันที่ ......./......./........
      </div>
    </div>
  )
}

function AttachmentRow({
  index,
  label,
  checked,
}: { index: number; label: string; checked: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        padding: '3px 0',
        fontSize: '12px',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '14px',
          height: '14px',
          border: '1px solid #475569',
          borderRadius: '2px',
          flexShrink: 0,
          marginTop: '2px',
          fontSize: '10px',
          lineHeight: 1,
          color: '#0f4c5c',
        }}
      >
        {checked ? '✓' : ''}
      </span>
      <span style={{ minWidth: '24px', color: '#475569' }}>{index}.</span>
      <span style={{ color: '#1e293b' }}>{label}</span>
    </div>
  )
}

/* ─────────── main component ─────────── */

export function TemplateA4Preview({ draft }: Props) {
  const [showPlaceholders, setShowPlaceholders] = useState(false)

  const ctx = showPlaceholders ? PLACEHOLDERS : SAMPLE

  const showWitnesses = draft.showWitnesses !== false
  const witnessCount = draft.witnessCount === 4 ? 4 : 2
  const showAttachments = draft.showAttachments !== false
  const attachments = resolveAttachments(draft)
  const showMap = draft.showMap === true

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
          {showPlaceholders ? 'ดู placeholder' : 'ดูตัวอย่างค่า'}
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
          <div
            style={{
              borderBottom: '3px solid #0f4c5c',
              paddingBottom: '6px',
              marginBottom: '14px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: 700,
                    color: '#0f4c5c',
                    letterSpacing: '0.03em',
                  }}
                >
                  สัญญาเช่า
                </div>
                <div
                  style={{
                    fontSize: '10px',
                    color: '#94a3b8',
                    letterSpacing: '0.1em',
                    marginTop: '1px',
                  }}
                >
                  TENANCY AGREEMENT
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '11px', color: '#475569' }}>
                <div style={{ fontSize: '9px', color: '#94a3b8', marginBottom: '2px' }}>
                  เลขที่สัญญา
                </div>
                <div style={{ fontWeight: 600, color: '#0f4c5c' }}>{ctx.contractNo}</div>
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
                    <strong>
                      {i + 1}.{j + 1}
                    </strong>{' '}
                    <span dangerouslySetInnerHTML={{ __html: renderHtml(sub, ctx) }} />
                  </p>
                ))}
              </div>
            ))}
          </div>

          {/* closing */}
          {draft.closing && (
            <p
              style={{ textIndent: '1.5em', textAlign: 'justify', marginBottom: '18px' }}
              dangerouslySetInnerHTML={{ __html: renderHtml(draft.closing, ctx) }}
            />
          )}

          {/* ─── "ทำที่ ... เมื่อวันที่ ..." (always shown) ─── */}
          <div
            style={{
              marginTop: '20px',
              marginBottom: '14px',
              padding: '8px 12px',
              borderLeft: '2.5px solid #0f4c5c',
              background: '#f8fafc',
              fontSize: '12px',
              color: '#1e293b',
            }}
          >
            <div>
              <span style={{ color: '#475569' }}>ทำสัญญา ณ </span>
              <strong>{ctx.madeAt}</strong>
            </div>
            <div style={{ marginTop: '2px' }}>
              <span style={{ color: '#475569' }}>เมื่อวันที่ </span>
              <strong>{ctx.date}</strong>
            </div>
          </div>

          {/* ─── signatures ─── */}
          {showWitnesses && (
            <div style={{ marginTop: '8px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#0f4c5c',
                  letterSpacing: '0.5px',
                  borderBottom: '1px solid #cbd5e1',
                  paddingBottom: '4px',
                  marginBottom: '8px',
                }}
              >
                ลายมือชื่อคู่สัญญาและพยาน
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '4px 12px',
                }}
              >
                <SignatureCell label='ผู้ให้เช่า · LESSOR' />
                <SignatureCell label='ผู้เช่า · LESSEE' />
                {witnessCount >= 2 && <SignatureCell label='พยาน 1 · WITNESS 1' />}
                {witnessCount >= 2 && <SignatureCell label='พยาน 2 · WITNESS 2' />}
                {witnessCount === 4 && <SignatureCell label='พยาน 3 · WITNESS 3' />}
                {witnessCount === 4 && <SignatureCell label='พยาน 4 · WITNESS 4' />}
              </div>
            </div>
          )}

          {/* ─── attachments checklist ─── */}
          {showAttachments && attachments.length > 0 && (
            <div
              style={{
                marginTop: '20px',
                padding: '10px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                background: '#f8fafc',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#0f4c5c',
                  marginBottom: '6px',
                }}
              >
                เอกสารแนบท้ายสัญญา
              </div>
              <div>
                {attachments.map((a, i) => (
                  <AttachmentRow
                    // biome-ignore lint/suspicious/noArrayIndexKey: order is identity
                    key={`att-${i}`}
                    index={i + 1}
                    label={a.label}
                    checked={a.checked}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ─── map placeholder ─── */}
          {showMap && (
            <div
              style={{
                marginTop: '16px',
                border: '1.5px dashed #94a3b8',
                borderRadius: '4px',
                padding: '40px 16px',
                textAlign: 'center',
                color: '#64748b',
                fontSize: '12px',
                background: '#f8fafc',
              }}
            >
              <div style={{ fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                ผังที่ตั้งทรัพย์สิน
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                (พื้นที่สำหรับติดผังที่ตั้ง / Property Location Map)
              </div>
            </div>
          )}

          {/* empty state */}
          {!draft.intro && draft.clauses.length === 0 && !draft.closing && (
            <div
              style={{
                color: '#94a3b8',
                textAlign: 'center',
                padding: '40px 0',
                fontSize: '13px',
              }}
            >
              ยังไม่มีเนื้อหา · เริ่มพิมพ์ทางซ้ายเพื่อดู preview
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
