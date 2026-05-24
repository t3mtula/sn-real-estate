import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useInvoiceSettings } from '../queries'
import { useSaveInvoiceSettings } from '../mutations'
import type { InvoiceSettings } from '../queries'

const DEFAULT_FORM: InvoiceSettings = {
  prefix: 'INV-',
  dueDay: 5,
  vatMode: 'none',
  vatRate: 7,
  invoiceNote: '',
  draftVoidEnabled: true,
  draftVoidDays: 60,
}

export function InvoiceSettingsSection() {
  const { data, isLoading } = useInvoiceSettings()
  const save = useSaveInvoiceSettings()
  const [form, setForm] = useState<InvoiceSettings>(DEFAULT_FORM)

  useEffect(() => {
    if (data) setForm({ ...DEFAULT_FORM, ...data })
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
    <div className='space-y-6 w-full max-w-2xl'>
      <div>
        <h3 className='text-lg font-medium'>ใบแจ้งหนี้</h3>
        <p className='text-sm text-muted-foreground'>ค่าเริ่มต้นสำหรับใบแจ้งหนี้ · VAT</p>
      </div>
      <Separator />

      {/* เลขที่ใบแจ้งหนี้ */}
      <section className='space-y-3'>
        <h4 className='font-medium'>รูปแบบเลขที่ใบแจ้งหนี้</h4>
        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-1'>
            <Label htmlFor='inv-prefix'>Prefix เลขที่ใบ (เช่น INV-)</Label>
            <Input
              id='inv-prefix'
              value={form.prefix ?? 'INV-'}
              onChange={(e) => set('prefix', e.target.value)}
              placeholder='INV-'
            />
            <p className='text-xs text-muted-foreground'>ตัวอย่าง: {(form.prefix ?? 'INV-')}2025001</p>
          </div>
          <div className='space-y-1'>
            <Label htmlFor='inv-dueday'>วันครบกำหนดชำระ (วันที่ของเดือน)</Label>
            <Input
              id='inv-dueday'
              type='number'
              min={1}
              max={31}
              value={form.dueDay ?? 5}
              onChange={(e) => set('dueDay', Number(e.target.value))}
            />
            <p className='text-xs text-muted-foreground'>วันที่ {form.dueDay ?? 5} ของทุกเดือน</p>
          </div>
        </div>
      </section>

      <Separator />

      {/* VAT */}
      <section className='space-y-3'>
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
              <Input
                type='number'
                min={0}
                max={100}
                value={form.vatRate ?? 7}
                onChange={(e) => set('vatRate', Number(e.target.value))}
              />
            </div>
          )}
        </div>
      </section>

      <Separator />

      {/* หมายเหตุท้ายใบ */}
      <section className='space-y-3'>
        <h4 className='font-medium'>หมายเหตุท้ายใบแจ้งหนี้</h4>
        <div className='space-y-1'>
          <Label htmlFor='inv-note'>ข้อความที่จะแสดงท้ายใบแจ้งหนี้ทุกใบ (ถ้าไม่ใส่ = ไม่แสดง)</Label>
          <Textarea
            id='inv-note'
            rows={3}
            value={form.invoiceNote ?? ''}
            onChange={(e) => set('invoiceNote', e.target.value)}
            placeholder='เช่น กรุณาชำระเงินภายในวันที่กำหนด หากมีข้อสงสัยติดต่อ...'
          />
        </div>
      </section>

      <Separator />

      {/* Auto-void expired drafts */}
      <section className='space-y-3'>
        <h4 className='font-medium'>ยกเลิกร่างอัตโนมัติ</h4>
        <p className='text-xs text-muted-foreground'>
          ระบบจะยกเลิกใบแจ้งหนี้ที่เป็นร่างค้างนานเกินกำหนดโดยอัตโนมัติทุกครั้งที่เปิดแอป
        </p>
        <div className='flex items-center gap-3'>
          <Switch
            id='draft-void-enabled'
            checked={form.draftVoidEnabled ?? true}
            onCheckedChange={(v) => set('draftVoidEnabled', v)}
          />
          <Label htmlFor='draft-void-enabled'>เปิดใช้งาน</Label>
        </div>
        {(form.draftVoidEnabled ?? true) && (
          <div className='space-y-1 max-w-[200px]'>
            <Label htmlFor='draft-void-days'>จำนวนวันก่อนยกเลิก</Label>
            <Input
              id='draft-void-days'
              type='number'
              min={7}
              max={365}
              value={form.draftVoidDays ?? 60}
              onChange={(e) => set('draftVoidDays', Number(e.target.value))}
            />
            <p className='text-xs text-muted-foreground'>ค่าเริ่มต้น: 60 วัน</p>
          </div>
        )}
      </section>

      <div className='flex justify-end'>
        <Button onClick={handleSave} disabled={save.isPending}>บันทึก</Button>
      </div>
    </div>
  )
}
