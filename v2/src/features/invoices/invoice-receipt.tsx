/**
 * ใบเสร็จรับเงิน — 2 halves: ต้นฉบับ (ผู้เช่า) + สำเนา (ผู้ให้เช่า)
 * Layout port from v1 receiptHTML()
 */
import { Link, useParams } from '@tanstack/react-router'
import { ArrowLeft, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useMemo } from 'react'
import { amt, fmtBE } from '@/lib/thai'
import { useInvoice } from '@/features/invoices/queries'
import { useContract } from '@/features/contracts/queries'
import { useLandlord } from '@/features/landlords/queries'

function ReceiptHalf({
  title,
  invoice,
  companyName,
  companyAddress,
  today,
}: {
  title: string
  invoice: ReturnType<typeof useInvoice>['data']
  companyName?: string
  companyAddress?: string
  today: string
}) {
  if (!invoice) return null
  const d = invoice.data
  const payments = d?.payments ?? []
  const lastPayment = payments[payments.length - 1]

  return (
    <div
      className='receipt-half bg-white text-[#1e293b]'
      style={{
        fontFamily: "'Sarabun', sans-serif",
        fontSize: '12px',
        lineHeight: '1.6',
        padding: '12mm 14mm',
        borderBottom: '1px dashed #cbd5e1',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f4c5c' }}>ใบเสร็จรับเงิน</div>
          <div style={{ fontSize: '9px', color: '#94a3b8', letterSpacing: '0.1em' }}>RECEIPT · {title}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '9px', color: '#94a3b8' }}>เลขที่ใบแจ้งหนี้</div>
          <div style={{ fontWeight: 600 }}>{d?.invoiceNo || '—'}</div>
          <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>วันที่ {lastPayment?.date || today}</div>
        </div>
      </div>

      {/* Company */}
      <div style={{ background: '#f8fafc', borderRadius: '6px', padding: '8px 10px', marginBottom: '8px', fontSize: '11px' }}>
        <div style={{ fontWeight: 700 }}>{companyName || 'บริษัท สมบัตินภา จำกัด'}</div>
        <div style={{ color: '#64748b', fontSize: '10px' }}>{companyAddress || ''}</div>
      </div>

      {/* Parties */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px', fontSize: '11px' }}>
        <div>
          <div style={{ color: '#94a3b8', fontSize: '9px' }}>ผู้เช่า</div>
          <div style={{ fontWeight: 600 }}>{d?.tenant || '—'}</div>
        </div>
        <div>
          <div style={{ color: '#94a3b8', fontSize: '9px' }}>ทรัพย์สิน</div>
          <div style={{ fontWeight: 600 }}>{d?.property || '—'}</div>
        </div>
      </div>

      {/* Items */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', fontSize: '11px' }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <th style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 600 }}>รายการ</th>
            <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>ยอด</th>
          </tr>
        </thead>
        <tbody>
          {(d?.items ?? []).map((it, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable
            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '4px 6px' }}>{it.desc}</td>
              <td style={{ padding: '4px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{amt(it.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '6px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#64748b' }}>ยอดรวม</span>
          <span style={{ fontWeight: 600 }}>{amt(d?.total)}</span>
        </div>
        {payments.length > 0 && payments.map((p, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
            <span>รับเงิน {p.date}</span>
            <span style={{ fontWeight: 600 }}>+{amt(p.amount)}</span>
          </div>
        ))}
        {(d?.remainingAmount ?? 0) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
            <span>คงค้าง</span>
            <span style={{ fontWeight: 700 }}>{amt(d?.remainingAmount)}</span>
          </div>
        )}
      </div>

      {/* Signature */}
      <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ textAlign: 'center', width: '120px' }}>
          <div style={{ borderBottom: '1px solid #cbd5e1', height: '28px' }} />
          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>ผู้รับเงิน</div>
        </div>
      </div>
    </div>
  )
}

export function InvoiceReceipt() {
  const { id } = useParams({ from: '/_authenticated/invoices/$id/receipt' })
  const { data: invoice, isLoading } = useInvoice(id)
  const { data: contract } = useContract(invoice?.contract_id ?? undefined)
  const { data: landlord } = useLandlord(contract?.data?.landlord_id)
  // computed at render time, not module load
  const today = useMemo(() => fmtBE(new Date()), [])

  // Build landlord address from 5-part address fields
  const landlordName = landlord?.data?.name ?? invoice?.data?.landlord ?? ''
  const landlordAddress = [
    landlord?.data?.addrLine,
    landlord?.data?.addrSubdistrict,
    landlord?.data?.addrDistrict,
    landlord?.data?.addrProvince,
    landlord?.data?.addrPostal,
  ].filter(Boolean).join(' ')

  if (isLoading) return (
    <div className='p-8 space-y-4'>
      {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className='h-8 w-full' />)}
    </div>
  )

  if (!invoice) return <div className='p-8 text-center text-muted-foreground'>ไม่พบใบแจ้งหนี้</div>

  return (
    <>
      <div className='no-print flex items-center gap-3 border-b bg-background px-4 py-2'>
        <Button variant='ghost' size='sm' asChild>
          <Link to='/invoices/$id' params={{ id }}><ArrowLeft className='size-4' />กลับ</Link>
        </Button>
        <span className='flex-1 text-sm font-medium'>ใบเสร็จรับเงิน · {invoice.data?.invoiceNo}</span>
        <Button size='sm' onClick={() => window.print()}>
          <Printer className='size-4' />พิมพ์
        </Button>
      </div>

      <div className='no-print my-4 text-center text-xs text-muted-foreground'>
        ต้นฉบับ (ผู้เช่า) · สำเนา (ผู้ให้เช่า)
      </div>

      <div className='mx-auto max-w-[148mm] print:max-w-none'>
        <ReceiptHalf
          title='ต้นฉบับ (ผู้เช่า)'
          invoice={invoice}
          companyName={landlordName}
          companyAddress={landlordAddress}
          today={today}
        />
        <ReceiptHalf
          title='สำเนา (ผู้ให้เช่า)'
          invoice={invoice}
          companyName={landlordName}
          companyAddress={landlordAddress}
          today={today}
        />
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
        }
      `}</style>
    </>
  )
}
