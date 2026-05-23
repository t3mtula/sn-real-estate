/**
 * ใบคืนเงินประกัน — A4 print layout
 * Route: /contracts/$id/deposit-return
 */
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Printer } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { amt, fmtBE } from '@/lib/thai'
import { useContract, getContractDisplay } from '@/features/contracts/queries'
import { useProperty } from '@/features/properties/queries'
import { useTenant } from '@/features/tenants/queries'
import { useLandlord } from '@/features/landlords/queries'
import type { DepositReturn, MoveOutInspection } from '@/features/contracts/types'

export function DepositReturnPrint({ id }: { id: string }) {
  const { data: contract, isLoading } = useContract(id)
  const { data: landlord } = useLandlord(contract?.data?.landlord_id)
  const today = useMemo(() => fmtBE(new Date()), [])

  const c = contract?.data
  const propertyId = (c?.pid_property ?? c?.pid)?.toString() ?? ''
  const property = useProperty(propertyId)
  const tenant = useTenant(c?.tenant_id)

  if (isLoading) {
    return (
      <div className='p-8 space-y-4'>
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className='h-8 w-full' />)}
      </div>
    )
  }

  if (!contract) {
    return <div className='p-8 text-center text-muted-foreground'>ไม่พบสัญญา</div>
  }

  const depositReturn = c?.depositReturn as DepositReturn | undefined
  const inspection = c?.inspection as MoveOutInspection | undefined

  const tenantName = tenant.data?.data?.name ?? c?.tenant ?? '—'
  const propertyName = property.data?.data?.name ?? '—'
  const contractDisplay = getContractDisplay(contract)
  const companyName = landlord?.data?.name ?? c?.landlord ?? ''
  const companyAddress = [
    landlord?.data?.addrLine,
    landlord?.data?.addrSubdistrict,
    landlord?.data?.addrDistrict,
    landlord?.data?.addrProvince,
    landlord?.data?.addrPostal,
  ].filter(Boolean).join(' ') || c?.landlordAddr || ''

  const originalDeposit = depositReturn?.originalDeposit ?? Number(c?.deposit) ?? 0
  const deductionInspection = depositReturn?.deductionFromInspection ?? inspection?.totalDeduction ?? 0
  const deductionUnpaid = depositReturn?.deductionUnpaidInvoices ?? 0
  const otherDeductions = depositReturn?.otherDeductions ?? 0
  const refundAmount = depositReturn?.refundAmount ?? Math.max(originalDeposit - deductionInspection - deductionUnpaid - otherDeductions, 0)

  const deductionRows: Array<{ label: string; amount: number; note?: string }> = []
  if (deductionInspection > 0) deductionRows.push({ label: 'ค่าเสียหายจากการตรวจรับคืน', amount: deductionInspection })
  if (deductionUnpaid > 0) deductionRows.push({ label: 'ค่าเช่าค้างชำระ', amount: deductionUnpaid })
  if (otherDeductions > 0) deductionRows.push({ label: 'หักอื่นๆ', amount: otherDeductions, note: depositReturn?.otherDeductionsNote })

  return (
    <>
      {/* Toolbar (no-print) */}
      <div className='no-print flex items-center gap-3 border-b bg-background px-4 py-2'>
        <Button variant='ghost' size='sm' asChild>
          <Link to='/contracts/$id' params={{ id }}>
            <ArrowLeft className='size-4' />
            กลับ
          </Link>
        </Button>
        <span className='flex-1 text-sm font-medium'>ใบคืนเงินประกัน · {contractDisplay}</span>
        <Button size='sm' onClick={() => window.print()}>
          <Printer className='size-4' />
          พิมพ์
        </Button>
      </div>

      {/* A4 content */}
      <div
        className='mx-auto max-w-[190mm] print:max-w-none bg-white text-[#1e293b]'
        style={{ fontFamily: "'Sarabun', sans-serif", padding: '16mm 14mm', fontSize: '13px', lineHeight: '1.7' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f4c5c' }}>ใบคืนเงินประกัน</div>
            <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '0.1em', marginTop: '2px' }}>
              SECURITY DEPOSIT RETURN
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>{companyName}</div>
            {companyAddress && (
              <div style={{ fontSize: '11px', color: '#64748b', maxWidth: '200px' }}>{companyAddress}</div>
            )}
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>วันที่: {depositReturn?.returnDate || today}</div>
          </div>
        </div>

        {/* Contract info */}
        <div
          style={{
            background: '#f8fafc',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '16px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            fontSize: '12px',
          }}
        >
          <div>
            <div style={{ color: '#94a3b8', fontSize: '10px' }}>สัญญาเลขที่</div>
            <div style={{ fontWeight: 600 }}>{contractDisplay}</div>
          </div>
          <div>
            <div style={{ color: '#94a3b8', fontSize: '10px' }}>ทรัพย์สิน</div>
            <div style={{ fontWeight: 600 }}>{propertyName}</div>
          </div>
          <div>
            <div style={{ color: '#94a3b8', fontSize: '10px' }}>ผู้เช่า</div>
            <div style={{ fontWeight: 600 }}>{tenantName}</div>
          </div>
          <div>
            <div style={{ color: '#94a3b8', fontSize: '10px' }}>ช่วงสัญญา</div>
            <div style={{ fontWeight: 600 }}>{c?.start || '—'} — {c?.end || '—'}</div>
          </div>
        </div>

        {/* Calculation table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: '#0f4c5c', color: '#fff' }}>
              <th style={{ textAlign: 'left', padding: '7px 10px', fontWeight: 600 }}>รายการ</th>
              <th style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 600 }}>จำนวน (บาท)</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '7px 10px' }}>เงินประกันตามสัญญา</td>
              <td style={{ padding: '7px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                {amt(originalDeposit)}
              </td>
            </tr>
            {deductionRows.map((row, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: stable
              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: '#fef2f2' }}>
                <td style={{ padding: '7px 10px', color: '#dc2626' }}>
                  หัก: {row.label}
                  {row.note && <span style={{ fontSize: '11px', color: '#94a3b8' }}> ({row.note})</span>}
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: '#dc2626', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  ({amt(row.amount)})
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f0fdf4', borderTop: '2px solid #16a34a' }}>
              <td style={{ padding: '9px 10px', fontWeight: 700, fontSize: '14px' }}>ยอดคืนเงินประกัน</td>
              <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, fontSize: '14px', color: '#16a34a', fontVariantNumeric: 'tabular-nums' }}>
                {amt(refundAmount)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Return method */}
        {depositReturn && (
          <div style={{ fontSize: '12px', marginBottom: '24px', color: '#475569' }}>
            <span style={{ fontWeight: 600 }}>ช่องทางคืนเงิน:</span> {depositReturn.returnMethod}
            {depositReturn.returnRef ? ` · อ้างอิง ${depositReturn.returnRef}` : ''}
            {depositReturn.returnNote ? ` · ${depositReturn.returnNote}` : ''}
          </div>
        )}

        {/* Signatures */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginTop: '40px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderBottom: '1px solid #cbd5e1', height: '40px', marginBottom: '6px' }} />
            <div style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>ผู้รับเงิน (ผู้เช่า)</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{tenantName}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderBottom: '1px solid #cbd5e1', height: '40px', marginBottom: '6px' }} />
            <div style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>ผู้จ่ายเงิน (ผู้ให้เช่า)</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{companyName}</div>
          </div>
        </div>

        <div style={{ marginTop: '20px', fontSize: '10px', color: '#cbd5e1', textAlign: 'center' }}>
          พิมพ์เมื่อ {today}
        </div>
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
