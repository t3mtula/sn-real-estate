/**
 * BatchPaymentDialog — รับเงินหลายใบพร้อมกัน
 *
 * Port of v1 batchMarkPaid() + submitBatchPayment()
 * แสดง: ยอดรวม · รายการ invoice · form วันที่/วิธี/ref/note
 * Submit → useBatchRecordPayment → REC-YYYY-MM-NNNN ทุกใบ + TIV ถ้า VAT
 */
import { useState } from 'react'
import { Loader2, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { amt, fmtBE } from '@/lib/thai'
import { useBatchRecordPayment } from './mutations'
import { getEffectiveStatus, getInvoiceDisplay } from './queries'
import type { Invoice } from './types'

const PAY_METHODS = ['โอนเงิน', 'เงินสด', 'เช็ค', 'อื่นๆ'] as const
type PayMethod = (typeof PAY_METHODS)[number]

const LS_METHOD_KEY = 'payment.lastMethodTh'

function recallMethod(): PayMethod {
  if (typeof window === 'undefined') return 'โอนเงิน'
  const saved = window.localStorage.getItem(LS_METHOD_KEY)
  return (PAY_METHODS as readonly string[]).includes(saved ?? '') ? (saved as PayMethod) : 'โอนเงิน'
}

function saveMethod(m: PayMethod) {
  if (typeof window !== 'undefined') window.localStorage.setItem(LS_METHOD_KEY, m)
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoices: Invoice[]
  onSuccess?: () => void
}

export function BatchPaymentDialog({ open, onOpenChange, invoices, onSuccess }: Props) {
  const today = fmtBE(new Date())
  const [date, setDate] = useState(today)
  const [method, setMethod] = useState<PayMethod>(recallMethod)
  const [ref, setRef] = useState('')
  const [note, setNote] = useState('')
  const batchPay = useBatchRecordPayment()

  // Only show unpaid/partial invoices
  const payable = invoices.filter((inv) => {
    const s = getEffectiveStatus(inv)
    return s !== 'paid' && s !== 'voided'
  })

  const totalAmt = payable.reduce((sum, inv) => {
    const d = inv.data
    const remaining =
      d?.remainingAmount != null
        ? d.remainingAmount
        : Math.max((d?.total ?? 0) - (d?.paidAmount ?? 0), 0)
    return sum + Math.max(0, remaining)
  }, 0)

  function handleClose() {
    if (batchPay.isPending) return
    setDate(today)
    setMethod('โอนเงิน')
    setRef('')
    setNote('')
    onOpenChange(false)
  }

  async function handleSubmit() {
    if (!date.trim()) {
      toast.error('กรุณาระบุวันที่รับเงิน')
      return
    }
    if (payable.length === 0) {
      toast.warning('ไม่มีใบที่รอรับเงิน')
      return
    }

    try {
      const res = await batchPay.mutateAsync({
        ids: payable.map((inv) => inv.id),
        date: date.trim(),
        method,
        ref: ref.trim() || undefined,
        note: note.trim() || undefined,
      })

      saveMethod(method)
      if (res.errors.length === 0) {
        toast.success(
          `รับเงินแล้ว ${res.done} ใบ · รวม ${amt(res.totalCollected)} บาท`,
        )
      } else {
        toast.warning(
          `สำเร็จ ${res.done} ใบ · ผิดพลาด ${res.errors.length} ใบ`,
          { description: res.errors.map((e) => e.message).join(', ') },
        )
      }
      onSuccess?.()
      handleClose()
    } catch (err) {
      toast.error('บันทึกรับเงินไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Wallet className='size-5 text-emerald-600' />
            รับเงิน {payable.length} ใบ
          </DialogTitle>
          <DialogDescription>
            ชำระครบทั้งหมดโดยอัตโนมัติ · ระบบออกเลขใบเสร็จให้ทุกใบ
          </DialogDescription>
        </DialogHeader>

        {/* ── Summary card ─────────────────────────────────────── */}
        <div className='rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/30'>
          <p className='text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400'>
            ยอดรวมที่จะรับ
          </p>
          <p className='mt-0.5 text-2xl font-extrabold text-emerald-800 dark:text-emerald-300'>
            {amt(totalAmt)}{' '}
            <span className='text-sm font-medium'>บาท</span>
          </p>
          <p className='mt-1 text-xs text-muted-foreground'>
            {payable.length} ใบแจ้งหนี้ · ชำระครบทั้งหมด
          </p>
        </div>

        {/* ── Invoice list ─────────────────────────────────────── */}
        <ScrollArea className='max-h-40 rounded-md border'>
          <div className='divide-y text-sm'>
            {payable.map((inv) => {
              const d = inv.data
              const remaining =
                d?.remainingAmount != null
                  ? d.remainingAmount
                  : Math.max((d?.total ?? 0) - (d?.paidAmount ?? 0), 0)
              return (
                <div key={inv.id} className='flex items-center justify-between px-3 py-2'>
                  <span className='font-medium text-foreground'>
                    {getInvoiceDisplay(inv)}
                  </span>
                  <span className='text-muted-foreground'>
                    {d?.tenant ?? '—'}
                  </span>
                  <span className='font-semibold tabular-nums text-emerald-700'>
                    {amt(Math.max(0, remaining))} ฿
                  </span>
                </div>
              )
            })}
          </div>
        </ScrollArea>

        <Separator />

        {/* ── Payment form ──────────────────────────────────────── */}
        <div className='grid gap-4'>
          {/* วันที่รับเงิน */}
          <div className='space-y-1.5'>
            <Label htmlFor='bp-date'>
              วันที่รับเงิน <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='bp-date'
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder='วว/ดด/ปปปป'
              className='max-w-[180px] font-semibold'
            />
          </div>

          {/* วิธีชำระ */}
          <div className='space-y-1.5'>
            <Label>วิธีชำระเงิน</Label>
            <div className='flex flex-wrap gap-2'>
              {PAY_METHODS.map((m) => (
                <button
                  key={m}
                  type='button'
                  onClick={() => setMethod(m)}
                  className={`rounded-lg border-2 px-4 py-1.5 text-sm font-semibold transition-colors ${
                    method === m
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'border-border bg-background text-foreground hover:border-emerald-300'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* เลขอ้างอิง */}
          <div className='space-y-1.5'>
            <Label htmlFor='bp-ref'>เลขอ้างอิง (ถ้ามี)</Label>
            <Input
              id='bp-ref'
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder='เช่น เลข transaction'
            />
          </div>

          {/* หมายเหตุ */}
          <div className='space-y-1.5'>
            <Label htmlFor='bp-note'>หมายเหตุ</Label>
            <Input
              id='bp-note'
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder='หมายเหตุเพิ่มเติม (ถ้ามี)'
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={handleClose} disabled={batchPay.isPending}>
            ยกเลิก
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={payable.length === 0 || batchPay.isPending}
            className='bg-emerald-600 hover:bg-emerald-700'
          >
            {batchPay.isPending && <Loader2 className='size-4 animate-spin' />}
            บันทึกรับเงิน {payable.length} ใบ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
