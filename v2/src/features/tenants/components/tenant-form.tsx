import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ThaiAddressInput } from '@/features/properties/components/thai-address-input'
import { useConfirm } from '@/hooks/use-confirm'
import {
  TENANT_FORM_DEFAULTS,
  type TenantFormValues,
  tenantFormSchema,
} from '@/features/tenants/schema'
import { PARTY_TYPES } from '@/features/tenants/types'
import { cn } from '@/lib/utils'

type TenantFormProps = {
  mode: 'create' | 'edit'
  defaultValues?: TenantFormValues
  onSubmit: (values: TenantFormValues) => Promise<void> | void
  submitting?: boolean
  onCancel: () => void
}

export function TenantForm({
  mode,
  defaultValues,
  onSubmit,
  submitting = false,
  onCancel,
}: TenantFormProps) {
  const form = useForm<TenantFormValues>({
    resolver: zodResolver(tenantFormSchema),
    defaultValues: defaultValues ?? TENANT_FORM_DEFAULTS,
    mode: 'onBlur',
  })
  const confirm = useConfirm()

  const partyType = form.watch('partyType')
  const isCompany = partyType === 'company'

  const addrLine = form.watch('addrLine')
  const addrSubdistrict = form.watch('addrSubdistrict')
  const addrDistrict = form.watch('addrDistrict')
  const addrProvince = form.watch('addrProvince')
  const addrPostal = form.watch('addrPostal')

  async function handleSubmit(values: TenantFormValues) {
    try {
      await onSubmit(values)
      toast.success(mode === 'create' ? 'เพิ่มผู้เช่าสำเร็จ' : 'บันทึกการแก้ไขแล้ว')
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
          ประเภทผู้เช่า <span className='text-destructive'>*</span>
        </Label>
        <RadioGroup
          value={partyType}
          onValueChange={(v) =>
            form.setValue('partyType', v as TenantFormValues['partyType'], {
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
                partyType === p.value && 'border-primary bg-primary/5 ring-1 ring-primary/30',
              )}
            >
              <RadioGroupItem id={`party-${p.value}`} value={p.value} />
              <span>{p.label}</span>
            </label>
          ))}
        </RadioGroup>
      </section>

      {/* Basic info */}
      <section className='grid gap-4 sm:grid-cols-2'>
        <div className='sm:col-span-2'>
          <Label htmlFor='name'>
            ชื่อ {isCompany ? '(เต็มตามทะเบียน)' : '(พร้อมคำนำหน้า)'}{' '}
            <span className='text-destructive'>*</span>
          </Label>
          <Input
            id='name'
            {...form.register('name')}
            placeholder={
              isCompany ? 'เช่น บริษัท ทีเอ็มเค กาญจนบุรี เทรดดิ้ง จำกัด' : 'เช่น นายสมชาย ใจดี'
            }
            aria-invalid={!!errors.name}
          />
          {errors.name && <FieldError>{errors.name.message}</FieldError>}
        </div>

        <div>
          <Label htmlFor='taxId'>
            เลขผู้เสียภาษี / Passport
          </Label>
          <Input
            id='taxId'
            {...form.register('taxId')}
            placeholder={isCompany ? '13 หลัก เช่น 0715552000301' : '13 หลัก หรือ Passport'}
            aria-invalid={!!errors.taxId}
          />
          <p className='mt-1 text-xs text-muted-foreground'>
            ใส่ได้ทั้งเลขประจำตัวประชาชน (13 หลัก) หรือเลข passport · เว้นว่างได้ถ้าไม่มี
          </p>
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
            <p className='mt-1 text-xs text-muted-foreground'>
              5 หลัก · ใช้เลขสาขาผู้เสียภาษีที่ออกใบกำกับภาษี
            </p>
          </div>
        )}

        <div className={isCompany ? '' : 'sm:col-span-2'}>
          <Label htmlFor='phone'>เบอร์โทร</Label>
          <Input
            id='phone'
            {...form.register('phone')}
            placeholder='เช่น 081-234-5678'
          />
        </div>
      </section>

      {/* Company signer (เฉพาะนิติบุคคล) */}
      {isCompany && (
        <section className='grid gap-4 rounded-md border bg-muted/30 p-4 sm:grid-cols-2'>
          <div className='sm:col-span-2'>
            <p className='text-sm font-medium'>กรรมการผู้ลงนาม</p>
            <p className='text-xs text-muted-foreground'>
              ชื่อ + ตำแหน่งที่ใช้พิมพ์ลงสัญญา (เซ็นในนามบริษัท)
            </p>
          </div>
          <div>
            <Label htmlFor='signerName'>ชื่อกรรมการ</Label>
            <Input
              id='signerName'
              {...form.register('signerName')}
              placeholder='เช่น นายสมชาย ใจดี'
            />
          </div>
          <div>
            <Label htmlFor='signerTitle'>ตำแหน่ง</Label>
            <Input
              id='signerTitle'
              {...form.register('signerTitle')}
              placeholder='เช่น กรรมการผู้จัดการ'
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
            form.setValue('addrSubdistrict', addr.subdistrict, { shouldDirty: true })
            form.setValue('addrDistrict', addr.district, { shouldDirty: true })
            form.setValue('addrProvince', addr.province, { shouldDirty: true })
            form.setValue('addrPostal', addr.postal, { shouldDirty: true })
          }}
        />
      </section>

      {/* Actions */}
      <div className='flex items-center justify-end gap-2 border-t pt-4'>
        <Button type='button' variant='ghost' onClick={handleCancel} disabled={submitting}>
          ยกเลิก
        </Button>
        <Button type='submit' disabled={submitting}>
          {submitting && <Loader2 className='size-4 animate-spin' />}
          {mode === 'create' ? 'เพิ่มผู้เช่า' : 'บันทึก'}
        </Button>
      </div>
    </form>
  )
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className='mt-1.5 text-xs text-destructive'>{children}</p>
}
