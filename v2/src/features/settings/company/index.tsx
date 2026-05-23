import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { useCompanySettings } from '../queries'
import { useSaveCompanySettings } from '../mutations'
import type { CompanySettings } from '../queries'

export function CompanySettingsSection() {
  const { data, isLoading } = useCompanySettings()
  const save = useSaveCompanySettings()
  const [form, setForm] = useState<CompanySettings>({})
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  function set<K extends keyof CompanySettings>(k: K, v: CompanySettings[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 300_000) { toast.error('รูปใหญ่เกิน 300 KB'); return }
    const reader = new FileReader()
    reader.onload = () => set('logoUrl', reader.result as string)
    reader.readAsDataURL(file)
  }

  function handleSave() {
    save.mutate(form, {
      onSuccess: () => toast.success('บันทึกข้อมูลบริษัทแล้ว'),
      onError: (e) => toast.error('บันทึกไม่สำเร็จ', { description: String(e) }),
    })
  }

  if (isLoading) return <p className='text-sm text-muted-foreground'>กำลังโหลด…</p>

  return (
    <div className='space-y-6'>
      <div>
        <h3 className='text-lg font-medium'>ข้อมูลบริษัท / ผู้ให้เช่า</h3>
        <p className='text-sm text-muted-foreground'>แสดงบนใบแจ้งหนี้และสัญญาเช่า</p>
      </div>
      <Separator />

      {/* Logo */}
      <div className='space-y-2'>
        <Label>โลโก้</Label>
        <div className='flex items-center gap-4'>
          {form.logoUrl
            ? <img src={form.logoUrl} alt='logo' className='h-16 w-16 rounded-md border object-contain' />
            : <div className='flex h-16 w-16 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground'>ไม่มี</div>
          }
          <div className='space-y-1'>
            <Button variant='outline' size='sm' onClick={() => logoInputRef.current?.click()}>เลือกรูป</Button>
            {form.logoUrl && <Button variant='ghost' size='sm' className='text-destructive' onClick={() => set('logoUrl', undefined)}>ลบ</Button>}
            <p className='text-xs text-muted-foreground'>PNG/JPG · ไม่เกิน 300 KB</p>
          </div>
          <input ref={logoInputRef} type='file' accept='image/*' className='hidden' onChange={handleLogoChange} />
        </div>
      </div>

      {/* Company info */}
      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='space-y-1 sm:col-span-2'>
          <Label htmlFor='co-name'>ชื่อบริษัท / ชื่อผู้ให้เช่า</Label>
          <Input id='co-name' value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} placeholder='บริษัท สมบัตินภา จำกัด' />
        </div>
        <div className='space-y-1 sm:col-span-2'>
          <Label htmlFor='co-addr'>ที่อยู่</Label>
          <Textarea id='co-addr' rows={2} value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} placeholder='46/1 หมู่ 11 ต.ปากแรด อ.บ้านโป่ง จ.ราชบุรี 70110' />
        </div>
        <div className='space-y-1'>
          <Label htmlFor='co-phone'>เบอร์โทร</Label>
          <Input id='co-phone' value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder='081-942-9875' />
        </div>
        <div className='space-y-1'>
          <Label htmlFor='co-tax'>เลขผู้เสียภาษี</Label>
          <Input id='co-tax' value={form.taxId ?? ''} onChange={(e) => set('taxId', e.target.value)} placeholder='0105555000000' />
        </div>
      </div>

      <Separator />
      <h4 className='font-medium'>บัญชีธนาคาร (สำหรับชำระเงิน)</h4>
      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='space-y-1'>
          <Label htmlFor='co-bank'>ธนาคาร</Label>
          <Input id='co-bank' value={form.bankName ?? ''} onChange={(e) => set('bankName', e.target.value)} placeholder='ธนาคารกรุงไทย' />
        </div>
        <div className='space-y-1'>
          <Label htmlFor='co-acno'>เลขบัญชี</Label>
          <Input id='co-acno' value={form.bankAccountNo ?? ''} onChange={(e) => set('bankAccountNo', e.target.value)} placeholder='xxx-x-xxxxx-x' />
        </div>
        <div className='space-y-1 sm:col-span-2'>
          <Label htmlFor='co-acname'>ชื่อบัญชี</Label>
          <Input id='co-acname' value={form.bankAccountName ?? ''} onChange={(e) => set('bankAccountName', e.target.value)} placeholder='บริษัท สมบัตินภา จำกัด' />
        </div>
      </div>

      <Separator />
      <h4 className='font-medium'>PromptPay</h4>
      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='space-y-1'>
          <Label htmlFor='co-pp'>PromptPay ID (เบอร์ / เลขบัตร / นิติบุคคล)</Label>
          <Input id='co-pp' value={form.promptPayId ?? ''} onChange={(e) => set('promptPayId', e.target.value)} placeholder='0817000000 หรือ 1234567890123' />
        </div>
        <div className='space-y-1'>
          <Label htmlFor='co-ppname'>ชื่อ PromptPay (แสดงใต้ QR)</Label>
          <Input id='co-ppname' value={form.promptPayName ?? ''} onChange={(e) => set('promptPayName', e.target.value)} placeholder='บริษัท สมบัตินภา จำกัด' />
        </div>
      </div>

      <Separator />
      <h4 className='font-medium'>VAT (ค่าเช่าเริ่มต้น)</h4>
      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='space-y-1'>
          <Label>รูปแบบ VAT</Label>
          <Select value={form.vatMode ?? 'none'} onValueChange={(v) => set('vatMode', v as CompanySettings['vatMode'])}>
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
            <Label htmlFor='co-vat'>อัตรา VAT (%)</Label>
            <Input id='co-vat' type='number' min={0} max={100} value={form.vatRate ?? 7} onChange={(e) => set('vatRate', Number(e.target.value))} />
          </div>
        )}
      </div>

      <Separator />
      <div className='space-y-1'>
        <Label htmlFor='co-note'>หมายเหตุท้ายใบแจ้งหนี้</Label>
        <Textarea id='co-note' rows={2} value={form.invoiceNote ?? ''} onChange={(e) => set('invoiceNote', e.target.value)} placeholder='เช่น กรุณาชำระภายในวันที่กำหนด · ขอบคุณที่ใช้บริการ' />
      </div>

      <div className='flex justify-end'>
        <Button onClick={handleSave} disabled={save.isPending}>บันทึก</Button>
      </div>
    </div>
  )
}
