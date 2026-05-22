import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
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
import { useConfirm } from '@/hooks/use-confirm'
import { useBankAccounts } from '@/features/bank-accounts/queries'
import {
  CONTRACT_FORM_DEFAULTS,
  PAYMENT_PRESETS,
  PURPOSE_PRESETS,
  type ContractFormValues,
  contractFormSchema,
} from '@/features/contracts/schema'
import { useContracts } from '@/features/contracts/queries'
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

  const { data: properties } = useProperties()
  const { data: tenants } = useTenants()
  const { data: landlords } = useLandlords()
  const { data: bankAccounts } = useBankAccounts()
  const { data: allContracts } = useContracts()

  const pidProperty = form.watch('pid_property')
  const landlordId = form.watch('landlord_id')
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

  // Filter bank accounts by landlord (ownerLandlordId === landlord_id) — แต่อนุญาตเลือกอิสระ
  const filteredBanks = useMemo(() => {
    if (!bankAccounts) return []
    if (!landlordId) return bankAccounts
    return bankAccounts.filter((b) => b.data?.ownerLandlordId === landlordId)
  }, [bankAccounts, landlordId])

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
            กรอง: บัญชีของผู้ให้เช่า · เลือกอิสระเพื่อ tax optimization ได้
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
      </section>

      {/* Section 2: เวลาและเงิน */}
      <section className='grid gap-4 sm:grid-cols-2'>
        <div>
          <Label htmlFor='start'>
            วันเริ่มต้น <span className='text-destructive'>*</span>
          </Label>
          <Input
            id='start'
            {...form.register('start')}
            placeholder='DD/MM/YYYY (พ.ศ.)'
            className={cn('font-mono', errors.start && 'border-destructive')}
          />
          {errors.start && <FieldError>{errors.start.message}</FieldError>}
        </div>

        <div>
          <Label htmlFor='end'>
            วันสิ้นสุด <span className='text-destructive'>*</span>
          </Label>
          <Input
            id='end'
            {...form.register('end')}
            placeholder='DD/MM/YYYY (พ.ศ.)'
            className={cn('font-mono', errors.end && 'border-destructive')}
          />
          {errors.end && <FieldError>{errors.end.message}</FieldError>}
        </div>

        <div>
          <Label htmlFor='dur'>ระยะสัญญา (เดือน)</Label>
          <Input
            id='dur'
            type='number'
            inputMode='numeric'
            {...form.register('dur', { valueAsNumber: true })}
            placeholder='12'
            className={cn(errors.dur && 'border-destructive')}
          />
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

        <div>
          <Label htmlFor='rate'>
            ค่าเช่า (บาท) <span className='text-destructive'>*</span>
          </Label>
          <Input
            id='rate'
            type='number'
            inputMode='decimal'
            step='0.01'
            {...form.register('rate', { valueAsNumber: true })}
            placeholder='5000'
            className={cn(errors.rate && 'border-destructive')}
          />
          {errors.rate && <FieldError>{errors.rate.message}</FieldError>}
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
        <div>
          <Label htmlFor='madeDate'>วันที่ทำสัญญา</Label>
          <Input
            id='madeDate'
            {...form.register('madeDate')}
            placeholder='DD/MM/YYYY (พ.ศ.)'
            className={cn('font-mono', errors.madeDate && 'border-destructive')}
          />
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
          <Label htmlFor='wit1'>พยานคนที่ 1</Label>
          <Input
            id='wit1'
            {...form.register('wit1')}
            placeholder='ชื่อพยาน'
          />
        </div>

        <div>
          <Label htmlFor='wit2'>พยานคนที่ 2</Label>
          <Input
            id='wit2'
            {...form.register('wit2')}
            placeholder='ชื่อพยาน'
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
  )
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className='mt-1.5 text-xs text-destructive'>{children}</p>
}
