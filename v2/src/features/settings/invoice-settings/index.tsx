import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { useInvoiceSettings } from '../queries'
import { useSaveInvoiceSettings } from '../mutations'
import type { InvoiceSettings } from '../queries'

const DEFAULT_FORM: InvoiceSettings = {
  dueDay: 5,
  vatMode: 'none',
  vatRate: 7,
  invoiceNote: '',
  receiptNote: '',
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
    // Strip deprecated fields (SlipOK moved to system settings; prefix moved to system)
    const payload: InvoiceSettings = {
      dueDay: form.dueDay,
      vatMode: form.vatMode,
      vatRate: form.vatRate,
      invoiceNote: form.invoiceNote,
      receiptNote: form.receiptNote,
    }
    save.mutate(payload, {
      onSuccess: () => toast.success('บันทึกการตั้งค่าเอกสารแล้ว'),
      onError: (e) => toast.error('บันทึกไม่สำเร็จ', { description: String(e) }),
    })
  }

  if (isLoading) return <p className='text-sm text-muted-foreground'>กำลังโหลด…</p>

  return (
    <div className='space-y-6 w-full max-w-2xl'>
      <div>
        <h3 className='text-lg font-medium'>ใบแจ้งหนี้ / ใบเสร็จ</h3>
        <p className='text-sm text-muted-foreground'>
          ค่าเริ่มต้นเมื่อออกใบ · VAT · ข้อความท้ายเอกสาร
        </p>
      </div>
      <Separator />

      {/* วันครบกำหนด */}
      <section className='space-y-3'>
        <h4 className='font-medium'>วันครบกำหนดเริ่มต้น</h4>
        <div className='grid gap-4 sm:grid-cols-2'>
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
        <p className='text-xs text-muted-foreground'>
          รูปแบบเลขที่ใบแจ้งหนี้ตั้งใน <strong>การตั้งค่าทั่วไป</strong>
        </p>
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

      {/* หมายเหตุท้ายใบแจ้งหนี้ */}
      <section className='space-y-3'>
        <h4 className='font-medium'>ข้อความท้ายใบแจ้งหนี้</h4>
        <div className='space-y-1'>
          <Label htmlFor='inv-note'>แสดงท้ายใบแจ้งหนี้ทุกใบ (ถ้าไม่ใส่ = ไม่แสดง)</Label>
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

      {/* หมายเหตุท้ายใบเสร็จ */}
      <section className='space-y-3'>
        <h4 className='font-medium'>ข้อความท้ายใบเสร็จ</h4>
        <div className='space-y-1'>
          <Label htmlFor='rec-note'>แสดงท้ายใบเสร็จทุกใบ (ถ้าไม่ใส่ = ไม่แสดง)</Label>
          <Textarea
            id='rec-note'
            rows={3}
            value={form.receiptNote ?? ''}
            onChange={(e) => set('receiptNote', e.target.value)}
            placeholder='เช่น ขอบคุณที่ใช้บริการ'
          />
        </div>
      </section>

      <div className='flex justify-end'>
        <Button onClick={handleSave} disabled={save.isPending}>บันทึก</Button>
      </div>
    </div>
  )
}
