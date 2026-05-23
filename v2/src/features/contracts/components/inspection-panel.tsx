/**
 * InspectionPanel — บันทึก/แสดงผลการตรวจรับคืนห้อง
 * เก็บใน contract.data.inspection (JSONB · ไม่มี table ใหม่)
 */
import { CheckCircle, ClipboardList, XCircle, MinusCircle, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { amt, todayBE } from '@/lib/thai'
import { useRecordInspection } from '@/features/contracts/mutations'
import type { Contract } from '@/features/contracts/types'
import type { MoveOutInspection, MoveOutInspectionItem } from '@/features/contracts/types'

const DEFAULT_ITEMS: MoveOutInspectionItem[] = [
  { label: 'ความสะอาด', status: 'pass', deduction: 0, note: '' },
  { label: 'พื้นและผนัง', status: 'pass', deduction: 0, note: '' },
  { label: 'ประตูหน้าต่าง', status: 'pass', deduction: 0, note: '' },
  { label: 'ระบบไฟฟ้า', status: 'pass', deduction: 0, note: '' },
  { label: 'ระบบประปา', status: 'pass', deduction: 0, note: '' },
  { label: 'เฟอร์นิเจอร์/อุปกรณ์', status: 'pass', deduction: 0, note: '' },
  { label: 'กุญแจ', status: 'pass', deduction: 0, note: '' },
]

type ItemStatus = 'pass' | 'fail' | 'na'

function StatusBtn({
  value,
  current,
  onClick,
}: {
  value: ItemStatus
  current: ItemStatus
  onClick: () => void
}) {
  const active = value === current
  const config: Record<ItemStatus, { label: string; activeClass: string; icon: React.ReactNode }> = {
    pass: {
      label: 'ผ่าน',
      activeClass: 'bg-emerald-600 text-white border-emerald-600',
      icon: <CheckCircle className='size-3' />,
    },
    fail: {
      label: 'ไม่ผ่าน',
      activeClass: 'bg-destructive text-white border-destructive',
      icon: <XCircle className='size-3' />,
    },
    na: {
      label: 'ไม่มี',
      activeClass: 'bg-muted-foreground text-white border-muted-foreground',
      icon: <MinusCircle className='size-3' />,
    },
  }
  const c = config[value]
  return (
    <button
      type='button'
      onClick={onClick}
      className={`flex items-center gap-1 rounded border px-2 py-0.5 text-xs transition-colors ${
        active ? c.activeClass : 'border-border bg-background text-muted-foreground hover:bg-muted'
      }`}
    >
      {c.icon}
      {c.label}
    </button>
  )
}

interface Props {
  contract: Contract
}

export function InspectionPanel({ contract }: Props) {
  const c = contract.data
  const existing = c.inspection as MoveOutInspection | undefined
  const save = useRecordInspection(contract.id)

  const [editing, setEditing] = useState(!existing)
  const [date, setDate] = useState(existing?.date ?? todayBE())
  const [inspector, setInspector] = useState(existing?.inspector ?? '')
  const [items, setItems] = useState<MoveOutInspectionItem[]>(
    existing?.items ?? DEFAULT_ITEMS,
  )
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [newLabel, setNewLabel] = useState('')

  const totalDeduction = items.reduce(
    (sum, it) => sum + (it.status === 'fail' ? (it.deduction || 0) : 0),
    0,
  )

  function updateItem(idx: number, patch: Partial<MoveOutInspectionItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  function addItem() {
    const label = newLabel.trim()
    if (!label) return
    setItems((prev) => [...prev, { label, status: 'pass', deduction: 0, note: '' }])
    setNewLabel('')
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    if (!date.trim()) { toast.error('ใส่วันที่ตรวจ'); return }
    const inspection: MoveOutInspection = {
      date: date.trim(),
      inspector: inspector.trim(),
      items,
      totalDeduction,
      notes: notes.trim(),
      completedAt: new Date().toISOString(),
    }
    try {
      await save.mutateAsync(inspection)
      toast.success('บันทึกผลการตรวจแล้ว')
      setEditing(false)
    } catch (err) {
      toast.error('บันทึกไม่สำเร็จ', { description: err instanceof Error ? err.message : String(err) })
    }
  }

  // ─── Display mode (inspection already done) ───
  if (existing && !editing) {
    return (
      <Card>
        <CardHeader className='flex-row items-center justify-between gap-2 pb-3'>
          <div className='flex items-center gap-2'>
            <ClipboardList className='size-4 text-muted-foreground' />
            <CardTitle className='text-sm'>ผลการตรวจรับคืนห้อง</CardTitle>
          </div>
          <div className='flex items-center gap-2'>
            <Badge variant='outline' className='bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300'>
              ตรวจแล้ว {existing.date}
            </Badge>
            <Button size='sm' variant='ghost' className='h-7 text-xs' onClick={() => setEditing(true)}>
              แก้ไข
            </Button>
          </div>
        </CardHeader>
        <CardContent className='space-y-3'>
          {existing.inspector && (
            <p className='text-xs text-muted-foreground'>ผู้ตรวจ: {existing.inspector}</p>
          )}
          <div className='space-y-1'>
            {existing.items.map((it, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: stable display
              <div key={i} className='flex items-center gap-2 text-sm'>
                {it.status === 'pass' && <CheckCircle className='size-3.5 text-emerald-600 shrink-0' />}
                {it.status === 'fail' && <XCircle className='size-3.5 text-destructive shrink-0' />}
                {it.status === 'na' && <MinusCircle className='size-3.5 text-muted-foreground shrink-0' />}
                <span className={it.status === 'fail' ? 'font-medium' : ''}>{it.label}</span>
                {it.status === 'fail' && it.deduction > 0 && (
                  <span className='ml-auto text-xs text-destructive tabular-nums'>
                    −{amt(it.deduction)} บาท
                  </span>
                )}
                {it.note && (
                  <span className='text-xs text-muted-foreground'>({it.note})</span>
                )}
              </div>
            ))}
          </div>
          {existing.notes && (
            <p className='text-xs text-muted-foreground border-t pt-2'>{existing.notes}</p>
          )}
          <Separator />
          <div className='flex items-center justify-between'>
            <span className='text-sm font-medium'>ยอดหักรวม</span>
            <span className={`text-sm font-bold tabular-nums ${existing.totalDeduction > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
              {existing.totalDeduction > 0 ? `−${amt(existing.totalDeduction)} บาท` : 'ไม่มีการหัก'}
            </span>
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
          <ClipboardList className='size-4 text-muted-foreground' />
          <CardTitle className='text-sm'>บันทึกผลการตรวจรับคืนห้อง</CardTitle>
        </div>
        {existing && (
          <Button size='sm' variant='ghost' className='h-7 text-xs' onClick={() => setEditing(false)}>
            ยกเลิก
          </Button>
        )}
      </CardHeader>
      <CardContent className='space-y-4'>
        {/* Date + Inspector */}
        <div className='grid gap-3 sm:grid-cols-2'>
          <div className='space-y-1'>
            <Label className='text-xs'>วันที่ตรวจ (วว/ดด/ปปปป พ.ศ.)</Label>
            <Input
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder='05/06/2568'
              className='h-8 text-sm font-mono'
            />
          </div>
          <div className='space-y-1'>
            <Label className='text-xs'>ผู้ตรวจ</Label>
            <Input
              value={inspector}
              onChange={(e) => setInspector(e.target.value)}
              placeholder='ชื่อพนักงาน'
              className='h-8 text-sm'
            />
          </div>
        </div>

        {/* Checklist items */}
        <div className='space-y-2'>
          <p className='text-xs font-medium text-muted-foreground'>รายการตรวจ</p>
          {items.map((it, idx) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable during editing session
            <div key={idx} className='rounded-md border bg-muted/20 p-3 space-y-2'>
              <div className='flex items-center gap-2 flex-wrap'>
                <span className='text-sm font-medium flex-1'>{it.label}</span>
                <div className='flex gap-1'>
                  {(['pass', 'fail', 'na'] as ItemStatus[]).map((s) => (
                    <StatusBtn
                      key={s}
                      value={s}
                      current={it.status}
                      onClick={() => updateItem(idx, { status: s, deduction: s === 'fail' ? it.deduction : 0 })}
                    />
                  ))}
                </div>
                <button
                  type='button'
                  onClick={() => removeItem(idx)}
                  className='text-muted-foreground hover:text-destructive transition-colors'
                  aria-label='ลบรายการ'
                >
                  <Trash2 className='size-3.5' />
                </button>
              </div>

              {it.status === 'fail' && (
                <div className='grid gap-2 sm:grid-cols-2'>
                  <div className='space-y-1'>
                    <Label className='text-xs'>ค่าหัก (บาท)</Label>
                    <Input
                      type='number'
                      min={0}
                      value={it.deduction || ''}
                      onChange={(e) => updateItem(idx, { deduction: Number(e.target.value) || 0 })}
                      className='h-7 text-sm'
                      placeholder='0'
                    />
                  </div>
                  <div className='space-y-1'>
                    <Label className='text-xs'>หมายเหตุ</Label>
                    <Input
                      value={it.note}
                      onChange={(e) => updateItem(idx, { note: e.target.value })}
                      className='h-7 text-sm'
                      placeholder='รายละเอียด'
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add custom item */}
          <div className='flex gap-2'>
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addItem()}
              placeholder='เพิ่มรายการตรวจ...'
              className='h-8 text-sm'
            />
            <Button size='sm' variant='outline' className='h-8 shrink-0' onClick={addItem}>
              <Plus className='size-3' />
              เพิ่ม
            </Button>
          </div>
        </div>

        {/* Notes */}
        <div className='space-y-1'>
          <Label className='text-xs'>หมายเหตุเพิ่มเติม</Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder='ข้อสังเกตอื่นๆ'
            className='h-8 text-sm'
          />
        </div>

        {/* Total + Save */}
        <Separator />
        <div className='flex items-center justify-between'>
          <div>
            <p className='text-xs text-muted-foreground'>ยอดหักรวม</p>
            <p className={`text-lg font-bold tabular-nums ${totalDeduction > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
              {totalDeduction > 0 ? `−${amt(totalDeduction)} บาท` : 'ไม่มีการหัก'}
            </p>
          </div>
          <Button onClick={handleSave} disabled={save.isPending}>
            {save.isPending ? 'กำลังบันทึก...' : 'บันทึกผลการตรวจ'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
