import { zodResolver } from '@hookform/resolvers/zod'
import { Info, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { DateInputBE } from '@/components/date-input-be'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useConfirm } from '@/hooks/use-confirm'
import { useBankAccounts } from '@/features/bank-accounts/queries'
import { useBankAccountsForLandlord } from '@/features/landlord-banks/queries'
import {
  CONTRACT_FORM_DEFAULTS,
  PAYMENT_PRESETS,
  PURPOSE_PRESETS,
  type ContractFormValues,
  contractFormSchema,
} from '@/features/contracts/schema'
import { useContracts } from '@/features/contracts/queries'
import { useContractTemplates } from '@/features/templates/queries'
import { useLandlords } from '@/features/landlords/queries'
import { useProperties } from '@/features/properties/queries'
import { ThaiAddressInput } from '@/features/properties/components/thai-address-input'
import { useTenants } from '@/features/tenants/queries'
import { cn } from '@/lib/utils'

type ContractFormProps = {
  mode: 'create' | 'edit'
  /** Existing contract ID — required in edit mode for parent_contract self-exclude */
  contractId?: string
  defaultValues?: ContractFormValues
  /**
   * Submit handler — passes form values + resolved inline strings
   * (tenant name, landlord name, taxId) for v1 backward compat
   */
  onSubmit: (values: ContractFormValues, inline: InlineStrings) => Promise<void> | void
  submitting?: boolean
  onCancel: () => void
}

export type InlineStrings = {
  tenantName?: string
  landlordName?: string
  taxId?: string
}

export function ContractForm({
  mode,
  contractId,
  defaultValues,
  onSubmit,
  submitting = false,
  onCancel,
}: ContractFormProps) {
  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: defaultValues ?? CONTRACT_FORM_DEFAULTS,
    mode: 'onBlur',
  })
  const confirm = useConfirm()

  // Local UI state: ระยะสัญญาแสดงเป็น ปี หรือ เดือน
  // form.dur เก็บเป็นเดือนเสมอ — durUnit กำหนดแค่การแสดงผล + การแปลง input
  const initDurUnit = (() => {
    const d = (defaultValues ?? CONTRACT_FORM_DEFAULTS).dur
    return d > 0 && d % 12 === 0 ? 'years' : 'months'
  })()
  const [durUnit, setDurUnit] = useState<'months' | 'years'>(initDurUnit)

  const { data: properties } = useProperties()
  const { data: tenants } = useTenants()
  const { data: landlords } = useLandlords()
  const { data: bankAccounts } = useBankAccounts()
  const { data: allContracts } = useContracts()
  const { data: templates } = useContractTemplates()

  const pidProperty = form.watch('pid_property')
  const landlordId = form.watch('landlord_id')
  const durMonths = form.watch('dur')
  const madeAtLine = form.watch('madeAtLine')
  const madeAtSubdistrict = form.watch('madeAtSubdistrict')
  const madeAtDistrict = form.watch('madeAtDistrict')
  const madeAtProvince = form.watch('madeAtProvince')
  const madeAtPostal = form.watch('madeAtPostal')

  // Auto-suggest landlord จาก property.ownerLandlordId — เฉพาะตอน create + ยังไม่ระบุ landlord
  useEffect(() => {
    if (mode !== 'create') return
    if (!pidProperty) return
    if (form.getValues('landlord_id')) return
    const prop = properties?.find(
      (p) => String(p.data?.pid ?? '') === pidProperty,
    )
    const owner = prop?.data?.ownerLandlordId
    if (owner) {
      form.setValue('landlord_id', owner, { shouldDirty: false })
    }
  }, [pidProperty, properties, mode, form])

  // Auto-fill wit1 จากพยานประจำของ landlord (ถ้า field ว่าง)
  const tenantId = form.watch('tenant_id')
  useEffect(() => {
    if (!landlordId) return
    const landlord = landlords?.find((l) => l.id === landlordId)
    const defaultWit = landlord?.data?.witnesses?.[0]?.trim()
    if (defaultWit && !form.getValues('wit1')?.trim()) {
      form.setValue('wit1', defaultWit, { shouldDirty: false })
    }
  }, [landlordId, landlords, form])

  // Auto-fill wit2 จากพยานประจำของ tenant (ถ้า field ว่าง)
  useEffect(() => {
    if (!tenantId) return
    const tenant = tenants?.find((t) => t.id === tenantId)
    const defaultWit = tenant?.data?.witnesses?.[0]?.trim()
    if (defaultWit && !form.getValues('wit2')?.trim()) {
      form.setValue('wit2', defaultWit, { shouldDirty: false })
    }
  }, [tenantId, tenants, form])

  // Filter bank accounts by landlord (via landlord_banks junction) — but allow free choice
  const { data: landlordBanks } = useBankAccountsForLandlord(landlordId)
  const filteredBanks = useMemo(() => {
    if (!bankAccounts) return []
    if (!landlordId) return bankAccounts
    return landlordBanks && landlordBanks.length > 0 ? landlordBanks : bankAccounts
  }, [bankAccounts, landlordBanks, landlordId])

  // Filter parent contracts by same property + not cancelled + not self
  const parentCandidates = useMemo(() => {
    if (!allContracts || !pidProperty) return []
    const targetPid = Number.parseInt(pidProperty, 10)
    return allContracts.filter((c) => {
      if (c.id === contractId) return false
      if (c.data?.cancelled) return false
      const cpid = c.data?.pid_property ?? c.data?.pid
      return cpid === targetPid
    })
  }, [allContracts, pidProperty, contractId])

  async function handleSubmit(values: ContractFormValues) {
    // Resolve inline strings for v1 backward compat
    const tenant = tenants?.find((t) => t.id === values.tenant_id)
    const landlord = landlords?.find((l) => l.id === values.landlord_id)
    const inline: InlineStrings = {
      tenantName: tenant?.data?.name ?? '',
      landlordName: landlord?.data?.name ?? '',
      taxId: tenant?.data?.taxId ?? '',
    }
    try {
      await onSubmit(values, inline)
      toast.success(mode === 'create' ? 'สร้างสัญญาสำเร็จ' : 'บันทึกการแก้ไขแล้ว')
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
    <TooltipProvider delayDuration={300}>
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      className='flex flex-col gap-6'
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
          e.preventDefault()
        }
      }}
    >
      {/* Section 1: เลขสัญญา + คู่สัญญา */}
      <section className='grid gap-4 sm:grid-cols-2'>
        <div className='sm:col-span-2'>
          <Label htmlFor='no'>
            เลขสัญญา <span className='text-destructive'>*</span>
          </Label>
          <Input
            id='no'
            {...form.register('no')}
            placeholder='เช่น SN.005-2569'
            aria-invalid={!!errors.no}
            className={cn(errors.no && 'border-destructive')}
          />
          {errors.no && <FieldError>{errors.no.message}</FieldError>}
        </div>

        <div className='sm:col-span-2'>
          <Label htmlFor='pid_property'>
            ทรัพย์สิน <span className='text-destructive'>*</span>
          </Label>
          <Select
            value={pidProperty || ''}
            onValueChange={(v) =>
              form.setValue('pid_property', v, { shouldDirty: true })
            }
          >
            <SelectTrigger
              id='pid_property'
              className={cn(errors.pid_property && 'border-destructive')}
            >
              <SelectValue placeholder='— เลือกทรัพย์สิน —' />
            </SelectTrigger>
            <SelectContent>
              {(properties ?? []).map((p) => {
                const pid = String(p.data?.pid ?? '')
                if (!pid) return null
                return (
                  <SelectItem key={p.id} value={pid}>
                    {p.data?.name ?? '(ไม่มีชื่อ)'}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          {errors.pid_property && (
            <FieldError>{errors.pid_property.message}</FieldError>
          )}
        </div>

        <div>
          <Label htmlFor='tenant_id'>
            ผู้เช่า <span className='text-destructive'>*</span>
          </Label>
          <Select
            value={form.watch('tenant_id') || ''}
            onValueChange={(v) =>
              form.setValue('tenant_id', v, { shouldDirty: true })
            }
          >
            <SelectTrigger
              id='tenant_id'
              className={cn(errors.tenant_id && 'border-destructive')}
            >
              <SelectValue placeholder='— เลือกผู้เช่า —' />
            </SelectTrigger>
            <SelectContent>
              {(tenants ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.data?.name ?? '(ไม่มีชื่อ)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.tenant_id && <FieldError>{errors.tenant_id.message}</FieldError>}
        </div>

        <div>
          <Label htmlFor='landlord_id'>
            ผู้ให้เช่า <span className='text-destructive'>*</span>
          </Label>
          <Select
            value={landlordId || ''}
            onValueChange={(v) =>
              form.setValue('landlord_id', v, { shouldDirty: true })
            }
          >
            <SelectTrigger
              id='landlord_id'
              className={cn(errors.landlord_id && 'border-destructive')}
            >
              <SelectValue placeholder='— เลือกผู้ให้เช่า —' />
            </SelectTrigger>
            <SelectContent>
              {(landlords ?? []).map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.data?.name ?? '(ไม่มีชื่อ)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className='mt-1 text-xs text-muted-foreground'>
            กรณีเช่าช่วง: ผู้ให้เช่า ≠ เจ้าของทรัพย์สิน
          </p>
        </div>

        <div>
          <Label htmlFor='bankAccountId'>บัญชีรับเงิน</Label>
          <Select
            value={form.watch('bankAccountId') || 'none'}
            onValueChange={(v) =>
              form.setValue('bankAccountId', v === 'none' ? '' : v, {
                shouldDirty: true,
              })
            }
          >
            <SelectTrigger id='bankAccountId'>
              <SelectValue placeholder='— ไม่ระบุ —' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='none'>— ไม่ระบุ —</SelectItem>
              {filteredBanks.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.data?.bank} · {b.data?.acctNo} · {b.data?.accountName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className='mt-1 text-xs text-muted-foreground'>
            กรอง: บัญชีของผู้ให้เช่า · เลือกอิสระเพื่อปรับใช้ทางภาษีได้
          </p>
        </div>

        <div className='sm:col-span-2'>
          <Label htmlFor='parent_contract_id'>สัญญาแม่ (เช่าช่วง)</Label>
          <Select
            value={form.watch('parent_contract_id') || 'none'}
            onValueChange={(v) =>
              form.setValue('parent_contract_id', v === 'none' ? '' : v, {
                shouldDirty: true,
              })
            }
          >
            <SelectTrigger id='parent_contract_id'>
              <SelectValue placeholder='— ไม่ใช่เช่าช่วง —' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='none'>— ไม่ใช่เช่าช่วง —</SelectItem>
              {parentCandidates.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {(c.data?.no ?? `#${c.id}`)} · {c.data?.tenant ?? ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className='mt-1 text-xs text-muted-foreground'>
            กรณี ข เช่าจาก ก แล้ว ข ปล่อยเช่าให้ ค บนทรัพย์เดียวกัน · ระบุสัญญาของ ก ที่นี่
          </p>
        </div>

        <div className='sm:col-span-2'>
          <Label htmlFor='templateId'>ฟอร์มสัญญา (master)</Label>
          <Select
            value={form.watch('templateId') || 'active'}
            onValueChange={(v) =>
              form.setValue('templateId', v === 'active' ? '' : v, {
                shouldDirty: true,
              })
            }
          >
            <SelectTrigger id='templateId'>
              <SelectValue placeholder='— ใช้ฟอร์มที่ active อยู่ —' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='active'>— ใช้ฟอร์มที่ active อยู่ —</SelectItem>
              {(templates ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.data?.name || '(ไม่ระบุชื่อ)'}
                  {t.data?.version ? ` · ${t.data.version}` : ''}
                  {t.is_active ? ' ✓' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className='mt-1 text-xs text-muted-foreground'>
            เลือกฟอร์มที่ต้องการใช้กับสัญญานี้ · ถ้าไม่เลือกจะใช้ฟอร์มที่ active อยู่ในขณะพิมพ์
          </p>
        </div>
      </section>

      {/* Section 2: เวลาและเงิน */}
      <section className='grid gap-4 sm:grid-cols-2'>
        <div>
          <Label htmlFor='start'>
            วันเริ่มต้น <span className='text-destructive'>*</span>
          </Label>
          <DateInputBE
            id='start'
            value={form.watch('start')}
            onChange={(v) => form.setValue('start', v, { shouldDirty: true, shouldValidate: true })}
            hasError={!!errors.start}
          />
          {errors.start && <FieldError>{errors.start.message}</FieldError>}
        </div>

        <div>
          <Label htmlFor='end'>
            วันสิ้นสุด <span className='text-destructive'>*</span>
          </Label>
          <DateInputBE
            id='end'
            value={form.watch('end')}
            onChange={(v) => form.setValue('end', v, { shouldDirty: true, shouldValidate: true })}
            hasError={!!errors.end}
          />
          {errors.end && <FieldError>{errors.end.message}</FieldError>}
        </div>

        <div>
          <Label htmlFor='dur'>ระยะสัญญา</Label>
          <div className='flex gap-2'>
            <Input
              id='dur'
              type='number'
              inputMode='numeric'
              min={0}
              step={durUnit === 'years' ? 0.5 : 1}
              value={
                durUnit === 'years'
                  ? durMonths > 0 ? String(durMonths / 12) : ''
                  : durMonths > 0 ? String(durMonths) : ''
              }
              onChange={(e) => {
                const raw = parseFloat(e.target.value) || 0
                form.setValue(
                  'dur',
                  durUnit === 'years' ? Math.round(raw * 12) : Math.round(raw),
                  { shouldDirty: true, shouldValidate: true },
                )
              }}
              placeholder={durUnit === 'years' ? '3' : '36'}
              className={cn(errors.dur && 'border-destructive', 'flex-1')}
            />
            <Select value={durUnit} onValueChange={(v) => setDurUnit(v as 'months' | 'years')}>
              <SelectTrigger className='w-24'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='months'>เดือน</SelectItem>
                <SelectItem value='years'>ปี</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {errors.dur && <FieldError>{errors.dur.message}</FieldError>}
        </div>

        <div>
          <Label htmlFor='purpose'>วัตถุประสงค์</Label>
          <Select
            value={form.watch('purpose') || ''}
            onValueChange={(v) =>
              form.setValue('purpose', v, { shouldDirty: true })
            }
          >
            <SelectTrigger id='purpose'>
              <SelectValue placeholder='เลือกวัตถุประสงค์' />
            </SelectTrigger>
            <SelectContent>
              {PURPOSE_PRESETS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='sm:col-span-2'>
          <Label htmlFor='rate' className='flex items-center gap-1.5'>
            ค่าเช่า (ข้อความในสัญญา)
            <FieldInfo tip='ข้อความนี้ปรากฏในสัญญาเช่าฉบับจริง เช่น "ปีละ 201,000 บาท" หรือ "เดือนละ 25,000 บาท (สองหมื่นห้าพันบาทถ้วน)"' />
          </Label>
          <Input
            id='rate'
            {...form.register('rate')}
            placeholder='เช่น เดือนละ 25,000 บาท หรือ ปีละ 201,000 บาท'
            className={cn(errors.rate && 'border-destructive')}
          />
          {errors.rate && <FieldError>{errors.rate.message}</FieldError>}
        </div>

        <div>
          <Label htmlFor='rateAmount' className='flex items-center gap-1.5'>
            จำนวนเงิน (คำนวณ)
            <FieldInfo tip='ตัวเลขสำหรับคำนวณ invoice และรายงาน — ไม่ปรากฏในสัญญา' />
          </Label>
          <Input
            id='rateAmount'
            type='number'
            inputMode='decimal'
            step='0.01'
            {...form.register('rateAmount', { valueAsNumber: true })}
            placeholder='25000'
            className={cn(errors.rateAmount && 'border-destructive')}
          />
          {errors.rateAmount && <FieldError>{errors.rateAmount.message}</FieldError>}
        </div>

        <div>
          <Label htmlFor='rateIntervalMonths' className='flex items-center gap-1.5'>
            รอบเรียกเก็บ (เดือน)
            <FieldInfo tip='เรียกเก็บทุกกี่เดือน — 1=รายเดือน · 3=รายไตรมาส · 12=รายปี — ใช้คำนวณ invoice ไม่ปรากฏในสัญญา' />
          </Label>
          <Input
            id='rateIntervalMonths'
            type='number'
            inputMode='numeric'
            min={1}
            max={120}
            {...form.register('rateIntervalMonths', { valueAsNumber: true })}
            placeholder='1'
            className={cn(errors.rateIntervalMonths && 'border-destructive')}
          />
          {errors.rateIntervalMonths && <FieldError>{errors.rateIntervalMonths.message}</FieldError>}
        </div>

        <div>
          <Label htmlFor='deposit'>เงินมัดจำ (บาท)</Label>
          <Input
            id='deposit'
            type='number'
            inputMode='decimal'
            step='0.01'
            {...form.register('deposit', { valueAsNumber: true })}
            placeholder='5000'
            className={cn(errors.deposit && 'border-destructive')}
          />
          {errors.deposit && <FieldError>{errors.deposit.message}</FieldError>}
        </div>

        <div>
          <Label htmlFor='billingStart' className='flex items-center gap-1.5'>
            วันเริ่มเก็บค่าเช่า
            <FieldInfo tip='กรณีให้ rent-free ช่วงแรก — วันที่เริ่มออก invoice จริง ถ้าตรงกับวันเริ่มสัญญาไม่ต้องกรอก' />
          </Label>
          <DateInputBE
            id='billingStart'
            value={form.watch('billingStart')}
            onChange={(v) => form.setValue('billingStart', v, { shouldDirty: true })}
            hasError={!!errors.billingStart}
          />
          {errors.billingStart && <FieldError>{errors.billingStart.message}</FieldError>}
        </div>

        <div className='sm:col-span-2'>
          <Label htmlFor='payment'>การชำระเงิน</Label>
          <Input
            id='payment'
            {...form.register('payment')}
            list='dl_payments'
            placeholder='เช่น รายเดือน · ภายในวันที่ 5'
          />
          <datalist id='dl_payments'>
            {PAYMENT_PRESETS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
      </section>

      {/* Section 3: การลงนาม */}
      <section className='grid gap-4 sm:grid-cols-2'>
        <div className='sm:col-span-2'>
          <Label htmlFor='madeDate'>วันที่ทำสัญญา</Label>
          <div className='max-w-[280px]'>
            <DateInputBE
              id='madeDate'
              value={form.watch('madeDate')}
              onChange={(v) => form.setValue('madeDate', v, { shouldDirty: true, shouldValidate: true })}
              hasError={!!errors.madeDate}
            />
          </div>
          {errors.madeDate && <FieldError>{errors.madeDate.message}</FieldError>}
        </div>

        <div className='sm:col-span-2'>
          <div className='mb-3 flex items-baseline justify-between gap-2'>
            <Label className='text-sm'>สถานที่ทำสัญญา</Label>
            <span className='text-xs text-muted-foreground'>
              ค้นตำบลหรือรหัสไปรษณีย์ → ระบบ auto-fill ที่เหลือ
            </span>
          </div>
          <ThaiAddressInput
            lineValue={madeAtLine}
            onLineChange={(line) =>
              form.setValue('madeAtLine', line, { shouldDirty: true })
            }
            value={{
              subdistrict: madeAtSubdistrict,
              district: madeAtDistrict,
              province: madeAtProvince,
              postal: madeAtPostal,
            }}
            onChange={(addr) => {
              form.setValue('madeAtSubdistrict', addr.subdistrict, { shouldDirty: true })
              form.setValue('madeAtDistrict', addr.district, { shouldDirty: true })
              form.setValue('madeAtProvince', addr.province, { shouldDirty: true })
              form.setValue('madeAtPostal', addr.postal, { shouldDirty: true })
            }}
          />
        </div>

        <div>
          <Label htmlFor='wit1'>พยาน (ฝั่งผู้ให้เช่า)</Label>
          <Input
            id='wit1'
            {...form.register('wit1')}
            placeholder='ดึงจากผู้ให้เช่าอัตโนมัติ — แก้ไขได้'
          />
        </div>

        <div>
          <Label htmlFor='wit2'>พยาน (ฝั่งผู้เช่า)</Label>
          <Input
            id='wit2'
            {...form.register('wit2')}
            placeholder='ดึงจากผู้เช่าอัตโนมัติ — แก้ไขได้'
          />
        </div>
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
          {mode === 'create' ? 'สร้างสัญญา' : 'บันทึก'}
        </Button>
      </div>
    </form>
    </TooltipProvider>
  )
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className='mt-1.5 text-xs text-destructive'>{children}</p>
}

function FieldInfo({ tip }: { tip: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className='size-3.5 cursor-help text-muted-foreground' />
      </TooltipTrigger>
      <TooltipContent side='top' className='max-w-72'>
        <p className='text-xs'>{tip}</p>
      </TooltipContent>
    </Tooltip>
  )
}
