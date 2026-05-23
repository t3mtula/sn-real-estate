import { Calendar, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { DateInputBE } from '@/components/date-input-be'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { parseBE } from '@/lib/thai'
import { useSetFollowUp } from './mutations'
import type { Invoice } from './types'

interface Props {
  invoice: Invoice
}

export function FollowUpPanel({ invoice }: Props) {
  const fu = invoice.data?.followUpDate ?? ''
  const fn_ = invoice.data?.followUpNote ?? ''

  const [date, setDate] = useState(fu)
  const [note, setNote] = useState(fn_)
  const [editing, setEditing] = useState(false)

  const setFollowUp = useSetFollowUp(invoice.id)

  const daysUntil = fu
    ? (() => {
        const d = parseBE(fu)
        if (!d) return null
        return Math.ceil((d.valueOf() - Date.now()) / 86_400_000)
      })()
    : null

  function handleSave() {
    setFollowUp.mutate(
      { followUpDate: date, followUpNote: note },
      {
        onSuccess: () => {
          toast.success(date.trim() ? 'บันทึกนัดชำระแล้ว' : 'ลบนัดชำระแล้ว')
          setEditing(false)
        },
        onError: (e) => toast.error('บันทึกไม่สำเร็จ', { description: String(e) }),
      },
    )
  }

  function handleClear() {
    setDate('')
    setNote('')
    setFollowUp.mutate(
      { followUpDate: '', followUpNote: '' },
      {
        onSuccess: () => {
          toast.success('ลบนัดชำระแล้ว')
          setEditing(false)
        },
        onError: (e) => toast.error('ลบไม่สำเร็จ', { description: String(e) }),
      },
    )
  }

  const overdue = daysUntil !== null && daysUntil < 0

  return (
    <div className='rounded-md border p-4 space-y-3'>
      <div className='flex items-center gap-2'>
        <Calendar className='size-4 text-indigo-500' />
        <span className='text-sm font-semibold'>นัดชำระ</span>
        {fu && (
          <Badge
            className={
              overdue
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                : daysUntil === 0
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
            }
          >
            {fu}
            {daysUntil !== null &&
              (overdue
                ? ` · เกิน ${Math.abs(daysUntil)} วัน`
                : daysUntil === 0
                  ? ' · วันนี้'
                  : ` · อีก ${daysUntil} วัน`)}
          </Badge>
        )}
        {!fu && !editing && (
          <span className='text-xs text-muted-foreground'>ยังไม่ได้ตั้ง</span>
        )}
        <Button
          size='sm'
          variant='ghost'
          className='ml-auto h-7 text-xs'
          onClick={() => {
            setDate(fu)
            setNote(fn_)
            setEditing((v) => !v)
          }}
        >
          {editing ? 'ยกเลิก' : fu ? 'แก้ไข' : '+ ตั้งวัน'}
        </Button>
      </div>

      {!editing && fn_ && (
        <p className='text-xs text-muted-foreground'>💬 {fn_}</p>
      )}

      {editing && (
        <div className='space-y-3'>
          <div className='space-y-1'>
            <Label className='text-xs'>วันที่ผู้เช่านัดชำระ</Label>
            <DateInputBE
              value={date}
              onChange={setDate}
              className='h-8 text-sm'
            />
          </div>
          <div className='space-y-1'>
            <Label className='text-xs'>บันทึก follow-up</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder='เช่น โทรนัดแล้ว · สัญญาจะโอน 5 มิ.ย.'
              className='h-8 text-sm'
            />
          </div>
          <div className='flex gap-2'>
            <Button size='sm' onClick={handleSave} disabled={setFollowUp.isPending} className='h-8'>
              บันทึก
            </Button>
            {fu && (
              <Button
                size='sm'
                variant='ghost'
                className='h-8 text-destructive hover:bg-destructive/10 hover:text-destructive'
                onClick={handleClear}
                disabled={setFollowUp.isPending}
              >
                <Trash2 className='size-3' />
                ลบ
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
