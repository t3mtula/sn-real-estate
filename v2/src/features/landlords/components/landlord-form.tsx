import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Upload, X } from 'lucide-react'
import { useRef } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ThaiAddressInput } from '@/features/properties/components/thai-address-input'
import { useConfirm } from '@/hooks/use-confirm'
import {
  LANDLORD_FORM_DEFAULTS,
  type LandlordFormValues,
  landlordFormSchema,
} from '@/features/landlords/schema'
import { fmtTaxId } from '@/features/landlords/queries'
import { PARTY_TYPES } from '@/features/landlords/types'
import { cn } from '@/lib/utils'

type LandlordFormProps = {
  mode: 'create' | 'edit'
  defaultValues?: LandlordFormValues
  onSubmit: (values: LandlordFormValues) => Promise<void> | void
  submitting?: boolean
  onCancel: () => void
}

export function LandlordForm({
  mode,
  defaultValues,
  onSubmit,
  submitting = false,
  onCancel,
}: LandlordFormProps) {
  const form = useForm<LandlordFormValues>({
    resolver: zodResolver(landlordFormSchema),
    defaultValues: defaultValues ?? LANDLORD_FORM_DEFAULTS,
    mode: 'onBlur',
  })
  const confirm = useConfirm()
  const logoInputRef = useRef<HTMLInputElement>(null)

  const partyType = form.watch('partyType')
  const isCompany = partyType === 'company'
  const logo = form.watch('logo') ?? ''
  const vatRegistered = form.watch('vatRegistered')
  const taxIdValue = form.watch('taxId') ?? ''
  const taxIdFormatted = fmtTaxId(taxIdValue)
  const showTaxIdPreview =
    taxIdValue.trim().length > 0 && taxIdFormatted !== taxIdValue.trim()

  const addrLine = form.watch('addrLine')
  const addrSubdistrict = form.watch('addrSubdistrict')
  const addrDistrict = form.watch('addrDistrict')
  const addrProvince = form.watch('addrProvince')
  const addrPostal = form.watch('addrPostal')

  async function handleSubmit(values: LandlordFormValues) {
    try {
      await onSubmit(values)
      toast.success(mode === 'create' ? 'เพิ่มผู้ให้เช่าสำเร็จ' : 'บันทึกการแก้ไขแล้ว')
    } catch (err) {
      toast.error('บันทึกไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  async function handleCancel() {
    if (form.formState.isDirty) {
      const ok = await confirm({
        title: 'ยังไม่ได้บันทึก',
        description: 'ออกจะเสียข้อมูลที่กรอกไว้ · ออกจริงไหม?',
        confirmLabel: 'ออก',
        destructive: true,
      })
      if (!ok) return
    }
    onCancel()
  }

  async function handleLogoFile(file: File) {
    if (file.size > 1_500_000) {
      toast.error('ไฟล์ใหญ่เกิน 1.5 MB · ลดขนาดก่อน')
      return
    }
    if (!file.type.startsWith('image/')) {
      toast.error('ไฟล์ต้องเป็นรูปภาพ')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      form.setValue('logo', String(reader.result ?? ''), { shouldDirty: true })
    }
    reader.readAsDataURL(file)
  }

  const errors = form.formState.errors

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      className='flex flex-col gap-6'
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
          e.preventDefault()
        }
      }}
    >
      {/* Party type toggle */}
      <section>
        <Label className='mb-2 block text-sm'>
          ประเภท <span className='text-destructive'>*</span>
        </Label>
        <RadioGroup
          value={partyType}
          onValueChange={(v) =>
            form.setValue('partyType', v as LandlordFormValues['partyType'], {
              shouldDirty: true,
            })
          }
          className='flex gap-2'
        >
          {PARTY_TYPES.map((p) => (
            <label
              key={p.value}
              htmlFor={`party-${p.value}`}
              className={cn(
                'flex flex-1 cursor-pointer items-center gap-2 rounded-md border bg-card p-3 text-sm hover:bg-muted/40',
                partyType === p.value &&
                  'border-primary bg-primary/5 ring-1 ring-primary/30',
              )}
            >
              <RadioGroupItem id={`party-${p.value}`} value={p.value} />
              <span>{p.label}</span>
            </label>
          ))}
        </RadioGroup>
      </section>

      {/* Logo + Basic info */}
      <section className='grid gap-4 sm:grid-cols-[140px_1fr]'>
        <div>
          <Label className='mb-2 block text-sm'>โลโก้</Label>
          <div className='flex flex-col items-center gap-2'>
            <div
              className={cn(
                'flex size-32 items-center justify-center overflow-hidden rounded-md border-2 border-dashed bg-muted/30',
                logo && 'border-solid bg-card',
              )}
            >
              {logo ? (
                <img
                  src={logo}
                  alt='โลโก้'
                  className='size-full object-contain'
                />
              ) : (
                <span className='text-center text-[10px] text-muted-foreground'>
                  ยังไม่มี
                  <br />
                  โลโก้
                </span>
              )}
            </div>
            <div className='flex w-full gap-1'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='flex-1'
                onClick={() => logoInputRef.current?.click()}
              >
                <Upload className='size-3' />
                อัพโหลด
              </Button>
              {logo && (
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() =>
                    form.setValue('logo', '', { shouldDirty: true })
                  }
                  aria-label='ลบโลโก้'
                >
                  <X className='size-3' />
                </Button>
              )}
            </div>
            <input
              ref={logoInputRef}
              type='file'
              accept='image/*'
              className='hidden'
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleLogoFile(file)
                e.target.value = ''
              }}
            />
          </div>
        </div>

        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='sm:col-span-2'>
            <Label htmlFor='name'>
              ชื่อ {isCompany ? '(เต็มตามทะเบียน)' : '(พร้อมคำนำหน้า)'}{' '}
              <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='name'
              {...form.register('name')}
              placeholder={
                isCompany
                  ? 'เช่น บริษัท สมบัตินภา จำกัด'
                  : 'เช่น นายอยุทธ์ พิษณุไวศยวาท'
              }
              aria-invalid={!!errors.name}
            />
            {errors.name && <FieldError>{errors.name.message}</FieldError>}
          </div>

          <div>
            <Label htmlFor='shortName'>ชื่อย่อ (สำหรับหน้า list)</Label>
            <Input
              id='shortName'
              {...form.register('shortName')}
              placeholder={isCompany ? 'บจก.สมบัตินภา' : 'นายอยุทธ์'}
            />
            <p className='mt-1 text-xs text-muted-foreground'>
              ใช้ในการ์ด KPI / รายการ · ว่างได้ ระบบจะใช้ชื่อเต็ม
            </p>
          </div>

          <div>
            <Label htmlFor='phone'>เบอร์โทร</Label>
            <Input
              id='phone'
              {...form.register('phone')}
              placeholder='เช่น 081-234-5678'
            />
          </div>

          <div>
            <Label htmlFor='taxId'>เลขผู้เสียภาษี / Passport</Label>
            <Input
              id='taxId'
              {...form.register('taxId')}
              placeholder='13 หลัก หรือ passport'
              aria-invalid={!!errors.taxId}
              className='font-mono'
            />
            {showTaxIdPreview && (
              <p className='mt-1 text-xs text-muted-foreground'>
                จะแสดงเป็น{' '}
                <span className='font-mono text-foreground'>{taxIdFormatted}</span>
              </p>
            )}
            {errors.taxId && <FieldError>{errors.taxId.message}</FieldError>}
          </div>

          {isCompany && (
            <div>
              <Label htmlFor='branch'>สาขา</Label>
              <Input
                id='branch'
                {...form.register('branch')}
                placeholder='00000 = สำนักงานใหญ่'
              />
            </div>
          )}
        </div>
      </section>

      {/* Company signer (เฉพาะนิติบุคคล) */}
      {isCompany && (
        <section className='grid gap-4 rounded-md border bg-muted/30 p-4 sm:grid-cols-2'>
          <div className='sm:col-span-2'>
            <p className='text-sm font-medium'>กรรมการผู้ลงนาม</p>
            <p className='text-xs text-muted-foreground'>
              ชื่อ + ตำแหน่ง ที่ใช้พิมพ์ลงสัญญา (เซ็นในนามบริษัท)
            </p>
          </div>
          <div>
            <Label htmlFor='signerName'>ชื่อกรรมการ</Label>
            <Input
              id='signerName'
              {...form.register('signerName')}
              placeholder='เช่น นายสมบัติ พิษณุไวศยวาท'
            />
          </div>
          <div>
            <Label htmlFor='signerTitle'>ตำแหน่ง</Label>
            <Input
              id='signerTitle'
              {...form.register('signerTitle')}
              placeholder='เช่น กรรมการ'
            />
          </div>
        </section>
      )}

      {/* Address */}
      <section>
        <div className='mb-3 flex items-baseline justify-between gap-2'>
          <Label className='text-sm'>ที่อยู่</Label>
          <span className='text-xs text-muted-foreground'>
            ค้นตำบลหรือรหัสไปรษณีย์ → ระบบ auto-fill ที่เหลือ
          </span>
        </div>
        <ThaiAddressInput
          lineValue={addrLine}
          onLineChange={(line) =>
            form.setValue('addrLine', line, { shouldDirty: true })
          }
          value={{
            subdistrict: addrSubdistrict,
            district: addrDistrict,
            province: addrProvince,
            postal: addrPostal,
          }}
          onChange={(addr) => {
            form.setValue('addrSubdistrict', addr.subdistrict, {
              shouldDirty: true,
            })
            form.setValue('addrDistrict', addr.district, {
              shouldDirty: true,
            })
            form.setValue('addrProvince', addr.province, {
              shouldDirty: true,
            })
            form.setValue('addrPostal', addr.postal, { shouldDirty: true })
          }}
        />
      </section>

      {/* VAT */}
      <section className='rounded-md border bg-card p-4'>
        <div className='flex items-center justify-between gap-3'>
          <div>
            <p className='text-sm font-medium'>จด VAT</p>
            <p className='text-xs text-muted-foreground'>
              ผู้ให้เช่าจดทะเบียนภาษีมูลค่าเพิ่มหรือไม่
            </p>
          </div>
          <Switch
            checked={vatRegistered}
            onCheckedChange={(v) =>
              form.setValue('vatRegistered', v, { shouldDirty: true })
            }
          />
        </div>
        {vatRegistered && (
          <div className='mt-3 grid gap-2 sm:max-w-[200px]'>
            <Label htmlFor='vatRate'>อัตรา VAT (%)</Label>
            <Input
              id='vatRate'
              type='number'
              step='0.01'
              min='0'
              max='100'
              {...form.register('vatRate', { valueAsNumber: true })}
            />
          </div>
        )}
      </section>

      {/* PromptPay */}
      <section className='rounded-md border bg-card p-4'>
        <p className='mb-2 text-sm font-medium'>PromptPay (ถ้ามี)</p>
        <p className='mb-3 text-xs text-muted-foreground'>
          ใส่ได้ทั้งเบอร์โทร / เลขประจำตัวประชาชน / เลขผู้เสียภาษีนิติบุคคล
        </p>
        <div className='grid gap-4 sm:grid-cols-3'>
          <div>
            <Label htmlFor='promptPayId'>เลข PromptPay</Label>
            <Input
              id='promptPayId'
              {...form.register('promptPayId')}
              placeholder='เช่น 081-234-5678 หรือ 13 หลัก'
            />
          </div>
          <div>
            <Label htmlFor='promptPayBank'>ธนาคารที่ผูก</Label>
            <Input
              id='promptPayBank'
              {...form.register('promptPayBank')}
              placeholder='เช่น ธ.กรุงเทพ'
            />
          </div>
          <div>
            <Label htmlFor='promptPayName'>ชื่อผู้รับ</Label>
            <Input
              id='promptPayName'
              {...form.register('promptPayName')}
              placeholder='ชื่อที่แสดงตอนสแกน'
            />
          </div>
        </div>
      </section>

      {/* Notes */}
      <section>
        <Label htmlFor='notes'>หมายเหตุภายใน</Label>
        <Textarea
          id='notes'
          {...form.register('notes')}
          rows={3}
          placeholder='บันทึกภายใน · ไม่แสดงใน contract/invoice'
        />
      </section>

      {/* Actions */}
      <div className='flex items-center justify-end gap-2 border-t pt-4'>
        <Button
          type='button'
          variant='ghost'
          onClick={handleCancel}
          disabled={submitting}
        >
          ยกเลิก
        </Button>
        <Button type='submit' disabled={submitting}>
          {submitting && <Loader2 className='size-4 animate-spin' />}
          {mode === 'create' ? 'เพิ่มผู้ให้เช่า' : 'บันทึก'}
        </Button>
      </div>
    </form>
  )
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className='mt-1.5 text-xs text-destructive'>{children}</p>
}
