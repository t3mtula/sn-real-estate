import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useDisplaySettings } from '../queries'
import { useSaveDisplaySettings } from '../mutations'
import type { DisplaySettings } from '../queries'

export function DisplaySettingsSection() {
  const { data, isLoading } = useDisplaySettings()
  const save = useSaveDisplaySettings()
  const [form, setForm] = useState<DisplaySettings>({
    expiryWarningDays: 90,
    overdueWarningDays: 7,
    witness1: '',
    witness2: '',
  })

  useEffect(() => {
    if (data) setForm({ expiryWarningDays: 90, overdueWarningDays: 7, witness1: '', witness2: '', ...data })
  }, [data])

  function set<K extends keyof DisplaySettings>(k: K, v: DisplaySettings[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function handleSave() {
    save.mutate(form, {
      onSuccess: () => toast.success('บันทึกการแสดงผลแล้ว'),
      onError: (e) => toast.error('บันทึกไม่สำเร็จ', { description: String(e) }),
    })
  }

  if (isLoading) return <p className='text-sm text-muted-foreground'>กำลังโหลด…</p>

  return (
    <div className='space-y-6'>
      <div>
        <h3 className='text-lg font-medium'>การแสดงผล</h3>
        <p className='text-sm text-muted-foreground'>ค่าเริ่มต้นสำหรับการแสดงผลและการแจ้งเตือน</p>
      </div>
      <Separator />

      <h4 className='font-medium'>พยานในสัญญา (ค่าเริ่มต้น)</h4>
      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='space-y-1'>
          <Label htmlFor='w1'>พยานคนที่ 1</Label>
          <Input id='w1' value={form.witness1 ?? ''} onChange={(e) => set('witness1', e.target.value)} placeholder='ชื่อ-นามสกุล' />
        </div>
        <div className='space-y-1'>
          <Label htmlFor='w2'>พยานคนที่ 2</Label>
          <Input id='w2' value={form.witness2 ?? ''} onChange={(e) => set('witness2', e.target.value)} placeholder='ชื่อ-นามสกุล' />
        </div>
      </div>

      <Separator />
      <h4 className='font-medium'>เกณฑ์การแจ้งเตือน</h4>
      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='space-y-1'>
          <Label htmlFor='exp-days'>แจ้งเตือนสัญญาใกล้หมด (วันก่อน)</Label>
          <Input id='exp-days' type='number' min={1} max={365} value={form.expiryWarningDays ?? 90} onChange={(e) => set('expiryWarningDays', Number(e.target.value))} />
          <p className='text-xs text-muted-foreground'>แสดงใน Dashboard และหน้าสัญญาใกล้หมด</p>
        </div>
        <div className='space-y-1'>
          <Label htmlFor='ov-days'>แจ้งเตือนใบแจ้งหนี้เกินกำหนด (วัน)</Label>
          <Input id='ov-days' type='number' min={0} max={90} value={form.overdueWarningDays ?? 7} onChange={(e) => set('overdueWarningDays', Number(e.target.value))} />
          <p className='text-xs text-muted-foreground'>0 = แจ้งทันทีที่เกินกำหนด</p>
        </div>
      </div>

      <div className='flex justify-end'>
        <Button onClick={handleSave} disabled={save.isPending}>บันทึก</Button>
      </div>
    </div>
  )
}
