import { useState } from 'react'
import { CreditCard, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { amt } from '@/lib/thai'
import { useRecordPayment } from './mutations'
import type { Invoice } from './types'

interface Props {
  invoice: Invoice
}

const METHODS = [
  { value: 'transfer', label: 'โอนเงิน' },
  { value: 'cash', label: 'เงินสด' },
  { value: 'check', label: 'เช็ค' },
  { value: 'promptpay', label: 'PromptPay' },
  { value: 'other', label: 'อื่นๆ' },
]

export function PaymentPanel({ invoice }: Props) {
  const data = invoice.data
  const payments = data?.payments ?? []
  const remaining = data?.remainingAmount ?? (data?.total ?? 0) - (data?.paidAmount ?? 0)
  const isFullyPaid = (data?.remainingAmount ?? 1) <= 0

  const [adding, setAdding] = useState(false)
  const [amount, setAmount] = useState(String(Math.max(remaining, 0) || ''))
  const [method, setMethod] = useState('transfer')
  const [date, setDate] = useState(() => {
    const now = new Date()
    const d = String(now.getDate()).padStart(2, '0')
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const y = now.getFullYear() + 543
    return `${d}/${m}/${y}`
  })
  const [ref, setRef] = useState('')
  const [note, setNote] = useState('')

  const record = useRecordPayment(invoice.id)

  function handleSave() {
    const n = Number.parseFloat(amount)
    if (!n || n <= 0) { toast.error('ใส่ยอดที่ถูกต้อง'); return }
    if (!date.trim()) { toast.error('ใส่วันที่'); return }
    record.mutate(
      { amount: n, method, date: date.trim(), ref: ref.trim(), note: note.trim() },
      {
        onSuccess: () => {
          toast.success('บันทึกการชำระเงินแล้ว')
          setAdding(false)
          setRef('')
          setNote('')
        },
        onError: (e) => toast.error('บันทึกไม่สำเร็จ', { description: String(e) }),
      },
    )
  }

  return (
    <div className='rounded-md border bg-card p-4 space-y-3'>
      <div className='flex items-center gap-2'>
        <CreditCard className='size-4 text-emerald-500' />
        <span className='text-sm font-medium'>การชำระเงิน</span>
        {isFullyPaid
          ? <Badge className='ml-auto bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'>ชำระครบแล้ว</Badge>
          : <span className='ml-auto text-xs text-muted-foreground'>คงค้าง {amt(remaining)} ฿</span>
        }
        {!isFullyPaid && !adding && (
          <Button size='sm' variant='outline' className='h-7 gap-1 text-xs' onClick={() => setAdding(true)}>
            <Plus className='size-3' />บันทึกรับเงิน
          </Button>
        )}
      </div>

      {adding && (
        <div className='rounded-md border bg-muted/30 p-3 space-y-3'>
          <p className='text-xs font-semibold text-muted-foreground'>รายการรับเงินใหม่</p>
          <div className='grid gap-3 sm:grid-cols-2'>
            <div className='space-y-1'>
              <Label className='text-xs'>ยอดรับ (บาท)</Label>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} type='number' min={0} className='h-8 text-sm' />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>ช่องทาง</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className='h-8 text-sm'><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>วันที่รับเงิน (วว/ดด/ปปปป)</Label>
              <Input value={date} onChange={(e) => setDate(e.target.value)} placeholder='05/06/2568' className='h-8 text-sm' />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>เลขอ้างอิง / เลข slip</Label>
              <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder='xxxxxxxx' className='h-8 text-sm' />
            </div>
            <div className='space-y-1 sm:col-span-2'>
              <Label className='text-xs'>หมายเหตุ</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder='บันทึกเพิ่มเติม' className='h-8 text-sm' />
            </div>
          </div>
          <div className='flex gap-2'>
            <Button size='sm' onClick={handleSave} disabled={record.isPending} className='h-8'>บันทึก</Button>
            <Button size='sm' variant='ghost' onClick={() => setAdding(false)} className='h-8'>ยกเลิก</Button>
          </div>
        </div>
      )}

      {payments.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='text-xs'>วันที่</TableHead>
              <TableHead className='text-xs'>ช่องทาง</TableHead>
              <TableHead className='text-xs'>อ้างอิง</TableHead>
              <TableHead className='text-right text-xs'>ยอด</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: stable
              <TableRow key={i}>
                <TableCell className='text-xs tabular-nums'>{p.date || '—'}</TableCell>
                <TableCell className='text-xs'>{METHODS.find((m) => m.value === p.method)?.label ?? p.method ?? '—'}</TableCell>
                <TableCell className='text-xs tabular-nums'>{p.ref || '—'}</TableCell>
                <TableCell className='text-right text-xs font-medium tabular-nums text-emerald-700 dark:text-emerald-400'>+{amt(p.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        !adding && <p className='text-xs text-muted-foreground'>ยังไม่มีการชำระ</p>
      )}
    </div>
  )
}
