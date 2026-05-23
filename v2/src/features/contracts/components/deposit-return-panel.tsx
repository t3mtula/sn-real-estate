/**
 * DepositReturnPanel — คำนวณและบันทึกการคืนเงินประกัน
 * เก็บใน contract.data.depositReturn (JSONB · ไม่มี table ใหม่)
 * ปิดสัญญา (closed=true) เมื่อบันทึก
 */
import { Printer, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { amt, todayBE } from '@/lib/thai'
import { useInvoicesByContract } from '@/features/invoices/queries'
import { useRecordDepositReturn } from '@/features/contracts/mutations'
import type { Contract, DepositReturn } from '@/features/contracts/types'

const RETURN_METHODS = [
  { value: 'โอนเงิน', label: 'โอนเงิน' },
  { value: 'เงินสด', label: 'เงินสด' },
  { value: 'เช็ค', label: 'เช็ค' },
]

interface Props {
  contract: Contract
}

export function DepositReturnPanel({ contract }: Props) {
  const c = contract.data
  const existing = c.depositReturn as DepositReturn | undefined
  const inspection = c.inspection
  const save = useRecordDepositReturn(contract.id)
  const navigate = useNavigate()

  const { data: invoices = [] } = useInvoicesByContract(contract.id)

  // Unpaid invoices (status != paid, != voided)
  const unpaidInvoices = invoices.filter((inv) => {
    const s = (inv.status ?? inv.data?.status ?? '').toLowerCase()
    return s !== 'paid' && s !== 'voided'
  })
  const unpaidTotal = unpaidInvoices.reduce((sum, inv) => {
    const remaining = inv.data?.remainingAmount ?? (inv.data?.total ?? 0) - (inv.data?.paidAmount ?? 0)
    return sum + Math.max(remaining, 0)
  }, 0)

  const originalDeposit = Number(c.deposit) || 0
  const deductionFromInspection = Number(inspection?.totalDeduction) || 0

  const [editing, setEditing] = useState(!existing)
  const [otherDeductions, setOtherDeductions] = useState(existing?.otherDeductions ?? 0)
  const [otherDeductionsNote, setOtherDeductionsNote] = useState(existing?.otherDeductionsNote ?? '')
  const [returnDate, setReturnDate] = useState(existing?.returnDate ?? todayBE())
  const [returnMethod, setReturnMethod] = useState(existing?.returnMethod ?? 'โอนเงิน')
  const [returnRef, setReturnRef] = useState(existing?.returnRef ?? '')
  const [returnNote, setReturnNote] = useState(existing?.returnNote ?? '')

  // Use unpaidTotal from live query (overrides stored value in form mode)
  const deductionUnpaid = existing && !editing ? existing.deductionUnpaidInvoices : unpaidTotal
  const refundAmount = Math.max(
    originalDeposit - deductionFromInspection - deductionUnpaid - (otherDeductions || 0),
    0,
  )

  async function handleSave() {
    if (!returnDate.trim()) { toast.error('ใส่วันที่คืนเงิน'); return }
    const record: DepositReturn = {
      originalDeposit,
      deductionFromInspection,
      deductionUnpaidInvoices: unpaidTotal,
      otherDeductions: otherDeductions || 0,
      otherDeductionsNote: otherDeductionsNote.trim(),
      refundAmount,
      returnDate: returnDate.trim(),
      returnMethod,
      returnRef: returnRef.trim(),
      returnNote: returnNote.trim(),
      completedAt: new Date().toISOString(),
    }
    try {
      await save.mutateAsync(record)
      toast.success('บันทึกการคืนประกันแล้ว · สัญญาถูกปิด')
      setEditing(false)
    } catch (err) {
      toast.error('บันทึกไม่สำเร็จ', { description: err instanceof Error ? err.message : String(err) })
    }
  }

  function handlePrint() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    navigate({ to: '/contracts/$id/deposit-return' as any, params: { id: contract.id } as any })
  }

  // ─── Summary row component ───
  function SummaryRow({
    label,
    amount,
    sub,
    highlight,
    isDeduction,
  }: {
    label: string
    amount: number
    sub?: string
    highlight?: boolean
    isDeduction?: boolean
  }) {
    return (
      <div className={`flex items-start justify-between gap-3 ${highlight ? 'pt-2' : ''}`}>
        <div>
          <p className={`text-sm ${highlight ? 'font-semibold' : ''}`}>{label}</p>
          {sub && <p className='text-xs text-muted-foreground'>{sub}</p>}
        </div>
        <span
          className={`text-sm tabular-nums shrink-0 ${
            highlight
              ? amount >= 0 ? 'font-bold text-emerald-600' : 'font-bold text-destructive'
              : isDeduction
                ? 'text-destructive'
                : ''
          }`}
        >
          {isDeduction && amount > 0 ? `−${amt(amount)}` : amt(amount)}
        </span>
      </div>
    )
  }

  // ─── Display mode ───
  if (existing && !editing) {
    return (
      <Card>
        <CardHeader className='flex-row items-center justify-between gap-2 pb-3'>
          <div className='flex items-center gap-2'>
            <Wallet className='size-4 text-muted-foreground' />
            <CardTitle className='text-sm'>การคืนเงินประกัน</CardTitle>
          </div>
          <div className='flex items-center gap-2'>
            <Badge variant='outline' className='bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300'>
              คืนแล้ว {existing.returnDate}
            </Badge>
            <Button size='sm' variant='outline' className='h-7 gap-1 text-xs' onClick={handlePrint}>
              <Printer className='size-3' />
              ใบคืนเงิน
            </Button>
            <Button size='sm' variant='ghost' className='h-7 text-xs' onClick={() => setEditing(true)}>
              แก้ไข
            </Button>
          </div>
        </CardHeader>
        <CardContent className='space-y-2'>
          <SummaryRow label='เงินประกัน' amount={existing.originalDeposit} />
          {existing.deductionFromInspection > 0 && (
            <SummaryRow
              label='หักค่าเสียหาย (จากการตรวจ)'
              amount={existing.deductionFromInspection}
              isDeduction
            />
          )}
          {existing.deductionUnpaidInvoices > 0 && (
            <SummaryRow
              label='หักค่าเช่าค้างชำระ'
              amount={existing.deductionUnpaidInvoices}
              isDeduction
            />
          )}
          {existing.otherDeductions > 0 && (
            <SummaryRow
              label='หักอื่นๆ'
              amount={existing.otherDeductions}
              sub={existing.otherDeductionsNote}
              isDeduction
            />
          )}
          <Separator />
          <SummaryRow label='ยอดคืนเงินประกัน' amount={existing.refundAmount} highlight />
          <div className='pt-1 text-xs text-muted-foreground space-y-0.5'>
            <p>ช่องทาง: {existing.returnMethod} {existing.returnRef ? `· อ้างอิง ${existing.returnRef}` : ''}</p>
            {existing.returnNote && <p>หมายเหตุ: {existing.returnNote}</p>}
          </div>
        </CardContent>
      </Card>
    )
  }

  // ─── Form mode ───
  return (
    <Card>
      <CardHeader className='flex-row items-center justify-between gap-2 pb-3'>
        <div className='flex items-center gap-2'>
          <Wallet className='size-4 text-muted-foreground' />
          <CardTitle className='text-sm'>บันทึกการคืนเงินประกัน</CardTitle>
        </div>
        {existing && (
          <Button size='sm' variant='ghost' className='h-7 text-xs' onClick={() => setEditing(false)}>
            ยกเลิก
          </Button>
        )}
      </CardHeader>
      <CardContent className='space-y-4'>
        {/* Calculation summary */}
        <div className='rounded-md border bg-muted/20 p-3 space-y-2'>
          <SummaryRow label='เงินประกัน' amount={originalDeposit} />
          {deductionFromInspection > 0 && (
            <SummaryRow
              label='หักค่าเสียหาย (จากการตรวจ)'
              amount={deductionFromInspection}
              isDeduction
            />
          )}
          {!inspection && (
            <p className='text-xs text-amber-700 dark:text-amber-300'>
              ยังไม่มีผลตรวจรับคืน · ค่าเสียหายจะเป็น 0
            </p>
          )}
          {unpaidTotal > 0 && (
            <SummaryRow
              label='หักค่าเช่าค้างชำระ'
              amount={unpaidTotal}
              sub={`${unpaidInvoices.length} ใบ`}
              isDeduction
            />
          )}

          {/* Other deductions input inline */}
          <div className='flex items-center gap-2'>
            <div className='flex-1 space-y-1'>
              <Label className='text-xs'>หักอื่นๆ (บาท)</Label>
              <Input
                type='number'
                min={0}
                value={otherDeductions || ''}
                onChange={(e) => setOtherDeductions(Number(e.target.value) || 0)}
                className='h-7 text-sm'
                placeholder='0'
              />
            </div>
            <div className='flex-1 space-y-1'>
              <Label className='text-xs'>เหตุผล</Label>
              <Input
                value={otherDeductionsNote}
                onChange={(e) => setOtherDeductionsNote(e.target.value)}
                className='h-7 text-sm'
                placeholder='ระบุเหตุผล'
              />
            </div>
          </div>

          <Separator />
          <SummaryRow label='ยอดคืนเงินประกัน' amount={refundAmount} highlight />
        </div>

        {/* Return details */}
        <div className='grid gap-3 sm:grid-cols-2'>
          <div className='space-y-1'>
            <Label className='text-xs'>วันที่คืนเงิน (วว/ดด/ปปปป พ.ศ.)</Label>
            <Input
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              placeholder='05/06/2568'
              className='h-8 text-sm font-mono'
            />
          </div>
          <div className='space-y-1'>
            <Label className='text-xs'>ช่องทางคืนเงิน</Label>
            <Select value={returnMethod} onValueChange={setReturnMethod}>
              <SelectTrigger className='h-8 text-sm'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RETURN_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-1'>
            <Label className='text-xs'>เลขอ้างอิง</Label>
            <Input
              value={returnRef}
              onChange={(e) => setReturnRef(e.target.value)}
              placeholder='เลข slip / เช็ค'
              className='h-8 text-sm'
            />
          </div>
          <div className='space-y-1'>
            <Label className='text-xs'>หมายเหตุ</Label>
            <Input
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
              placeholder='บันทึกเพิ่มเติม'
              className='h-8 text-sm'
            />
          </div>
        </div>

        <div className='rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-100'>
          การบันทึกนี้จะ <strong>ปิดสัญญา</strong> · สถานะจะเปลี่ยนเป็น "ปิด" และไม่สามารถออกใบแจ้งหนี้ได้อีก
        </div>

        <div className='flex justify-end gap-2'>
          <Button onClick={handleSave} disabled={save.isPending}>
            {save.isPending ? 'กำลังบันทึก...' : 'บันทึกการคืนประกัน'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
