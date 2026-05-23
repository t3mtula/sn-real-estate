import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useInvoiceSettings } from '../queries'
import { useSaveInvoiceSettings } from '../mutations'
import type { InvoiceSettings } from '../queries'

export function InvoiceSettingsSection() {
  const { data, isLoading } = useInvoiceSettings()
  const save = useSaveInvoiceSettings()
  const [form, setForm] = useState<InvoiceSettings>({
    vatMode: 'none',
    vatRate: 7,
    slipOkBranchId: '',
    slipOkApiKey: '',
  })

  useEffect(() => {
    if (data) setForm({ vatMode: 'none', vatRate: 7, slipOkBranchId: '', slipOkApiKey: '', ...data })
  }, [data])

  function set<K extends keyof InvoiceSettings>(k: K, v: InvoiceSettings[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function handleSave() {
    save.mutate(form, {
      onSuccess: () => toast.success('บันทึกการตั้งค่าใบแจ้งหนี้แล้ว'),
      onError: (e) => toast.error('บันทึกไม่สำเร็จ', { description: String(e) }),
    })
  }

  if (isLoading) return <p className='text-sm text-muted-foreground'>กำลังโหลด…</p>

  return (
    <div className='space-y-6'>
      <div>
        <h3 className='text-lg font-medium'>ใบแจ้งหนี้</h3>
        <p className='text-sm text-muted-foreground'>ค่าเริ่มต้น VAT และการเชื่อมต่อ SlipOK</p>
      </div>
      <Separator />

      <h4 className='font-medium'>VAT เริ่มต้น</h4>
      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='space-y-1'>
          <Label>รูปแบบ VAT (ค่าเริ่มต้นเมื่อออกใบใหม่)</Label>
          <Select value={form.vatMode ?? 'none'} onValueChange={(v) => set('vatMode', v as InvoiceSettings['vatMode'])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value='none'>ไม่มี VAT</SelectItem>
              <SelectItem value='inclusive'>ราคารวม VAT แล้ว</SelectItem>
              <SelectItem value='exclusive'>บวก VAT เพิ่ม</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {form.vatMode !== 'none' && (
          <div className='space-y-1'>
            <Label>อัตรา VAT (%)</Label>
            <Input type='number' min={0} max={100} value={form.vatRate ?? 7} onChange={(e) => set('vatRate', Number(e.target.value))} />
          </div>
        )}
      </div>

      <Separator />
      <h4 className='font-medium'>SlipOK API (ตรวจสลิปอัตโนมัติ)</h4>
      <p className='text-xs text-muted-foreground'>ใส่ข้อมูลจาก slipok.com เพื่อเปิดใช้การตรวจสลิปอัตโนมัติ</p>
      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='space-y-1'>
          <Label>Branch ID</Label>
          <Input value={form.slipOkBranchId ?? ''} onChange={(e) => set('slipOkBranchId', e.target.value)} placeholder='BXXXXXXX' />
        </div>
        <div className='space-y-1'>
          <Label>API Key</Label>
          <Input type='password' value={form.slipOkApiKey ?? ''} onChange={(e) => set('slipOkApiKey', e.target.value)} placeholder='sk_...' />
        </div>
      </div>

      <div className='flex justify-end'>
        <Button onClick={handleSave} disabled={save.isPending}>บันทึก</Button>
      </div>
    </div>
  )
}
