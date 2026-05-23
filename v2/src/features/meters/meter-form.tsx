import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useProperties } from '@/features/properties/queries'
import { useContracts } from '@/features/contracts/queries'
import {
  METER_READING_FORM_DEFAULTS,
  METER_TYPES,
  meterReadingFormSchema,
  type MeterReadingFormValues,
} from '@/features/meters/schema'

interface MeterFormProps {
  mode: 'create' | 'edit'
  defaultValues?: Partial<MeterReadingFormValues>
  submitting: boolean
  onSubmit: (values: MeterReadingFormValues) => Promise<void>
  onCancel: () => void
}

export function MeterForm({
  mode,
  defaultValues,
  submitting,
  onSubmit,
  onCancel,
}: MeterFormProps) {
  const { data: properties } = useProperties()
  const { data: allContracts } = useContracts()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<MeterReadingFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolver: zodResolver(meterReadingFormSchema) as any,
    defaultValues: { ...METER_READING_FORM_DEFAULTS, ...defaultValues },
  })

  const selectedPropertyId = watch('property_id')
  const prevReading = watch('prev_reading')
  const currReading = watch('curr_reading')
  const ratePerUnit = watch('rate_per_unit')
  const fixedFee = watch('fixed_fee') ?? 0

  // Auto-calc units and total for display
  const units = Math.max(0, (currReading ?? 0) - (prevReading ?? 0))
  const total = units * (ratePerUnit ?? 0) + (fixedFee ?? 0)

  // Filter contracts by selected property (match via property_id or pid_property numeric)
  const propertyContracts = useMemo(() => {
    if (!selectedPropertyId || !allContracts) return []
    const selectedProperty = properties?.find((p) => p.id === selectedPropertyId)
    const pid = selectedProperty?.data?.pid

    return allContracts.filter((c) => {
      if (!c.data) return false
      // Skip cancelled/closed
      if (c.data.cancelled || c.data.closed) return false
      // v2 FK match or legacy pid_property match
      if (pid != null && c.data.pid_property === pid) return true
      return false
    })
  }, [selectedPropertyId, allContracts, properties])

  // When property changes, reset contract_id
  useEffect(() => {
    setValue('contract_id', '')
    const prop = properties?.find((p) => p.id === selectedPropertyId)
    setValue('property_name', prop?.data?.name ?? '')
  }, [selectedPropertyId, properties, setValue])

  const sortedProperties = useMemo(() => {
    if (!properties) return []
    return [...properties].sort((a, b) =>
      (a.data?.name ?? '').localeCompare(b.data?.name ?? '', 'th'),
    )
  }, [properties])

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        await onSubmit(values)
      })}
      className='space-y-6'
    >
      {/* ทรัพย์สิน */}
      <div className='grid gap-1.5'>
        <Label htmlFor='property_id'>
          ทรัพย์สิน <span className='text-destructive'>*</span>
        </Label>
        <Select
          value={watch('property_id')}
          onValueChange={(v) =>
            setValue('property_id', v, { shouldValidate: true, shouldDirty: true })
          }
          disabled={mode === 'edit'}
        >
          <SelectTrigger
            id='property_id'
            className={errors.property_id ? 'border-destructive' : ''}
          >
            <SelectValue placeholder='เลือกทรัพย์สิน...' />
          </SelectTrigger>
          <SelectContent>
            {sortedProperties.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.data?.name || p.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.property_id && (
          <p className='text-xs text-destructive'>{errors.property_id.message}</p>
        )}
      </div>

      {/* สัญญา (optional) */}
      {selectedPropertyId && (
        <div className='grid gap-1.5'>
          <Label htmlFor='contract_id'>สัญญา (ถ้ามี)</Label>
          <Select
            value={watch('contract_id') ?? ''}
            onValueChange={(v) =>
              setValue('contract_id', v === 'none' ? '' : v, { shouldDirty: true })
            }
          >
            <SelectTrigger id='contract_id'>
              <SelectValue placeholder='ไม่ผูกสัญญา (ไม่บังคับ)' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='none'>ไม่ผูกสัญญา</SelectItem>
              {propertyContracts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {(c.data?.no ?? '').trim() || `#${c.id}`}
                  {c.data?.tenant ? ` · ${c.data.tenant}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* ประเภทมิเตอร์ */}
      <div className='grid gap-1.5'>
        <Label>
          ประเภท <span className='text-destructive'>*</span>
        </Label>
        <RadioGroup
          value={watch('type')}
          onValueChange={(v) =>
            setValue('type', v as 'water' | 'electricity' | 'other', {
              shouldDirty: true,
            })
          }
          className='flex gap-4'
        >
          {METER_TYPES.map((t) => (
            <div key={t.value} className='flex items-center gap-2'>
              <RadioGroupItem value={t.value} id={`type-${t.value}`} />
              <Label htmlFor={`type-${t.value}`} className='cursor-pointer font-normal'>
                {t.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* หมายเลขมิเตอร์ */}
      <div className='grid gap-1.5'>
        <Label htmlFor='meter_no'>หมายเลขมิเตอร์ (ไม่บังคับ)</Label>
        <Input
          id='meter_no'
          placeholder='เช่น 0012345'
          {...register('meter_no')}
        />
      </div>

      {/* วันที่อ่านมิเตอร์ */}
      <div className='grid gap-1.5'>
        <Label htmlFor='reading_date'>
          วันที่อ่านมิเตอร์ <span className='text-destructive'>*</span>
        </Label>
        <Input
          id='reading_date'
          placeholder='DD/MM/YYYY เช่น 01/05/2568'
          {...register('reading_date')}
          className={errors.reading_date ? 'border-destructive' : ''}
        />
        {errors.reading_date && (
          <p className='text-xs text-destructive'>{errors.reading_date.message}</p>
        )}
      </div>

      {/* ค่ามิเตอร์ */}
      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='grid gap-1.5'>
          <Label htmlFor='prev_reading'>
            ค่ามิเตอร์ก่อนหน้า <span className='text-destructive'>*</span>
          </Label>
          <Input
            id='prev_reading'
            type='number'
            min='0'
            step='0.01'
            {...register('prev_reading', { valueAsNumber: true })}
            className={errors.prev_reading ? 'border-destructive' : ''}
          />
          {errors.prev_reading && (
            <p className='text-xs text-destructive'>{errors.prev_reading.message}</p>
          )}
        </div>

        <div className='grid gap-1.5'>
          <Label htmlFor='curr_reading'>
            ค่ามิเตอร์ปัจจุบัน <span className='text-destructive'>*</span>
          </Label>
          <Input
            id='curr_reading'
            type='number'
            min='0'
            step='0.01'
            {...register('curr_reading', { valueAsNumber: true })}
            className={errors.curr_reading ? 'border-destructive' : ''}
          />
          {errors.curr_reading && (
            <p className='text-xs text-destructive'>{errors.curr_reading.message}</p>
          )}
        </div>
      </div>

      {/* หน่วยที่ใช้ (computed) */}
      <div className='grid gap-1.5'>
        <Label>หน่วยที่ใช้ (คำนวณอัตโนมัติ)</Label>
        <div className='flex h-9 items-center rounded-md border bg-muted px-3 text-sm font-medium'>
          {units.toLocaleString('th-TH')} หน่วย
        </div>
      </div>

      {/* ราคาต่อหน่วย + ค่าบริการคงที่ */}
      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='grid gap-1.5'>
          <Label htmlFor='rate_per_unit'>
            ราคาต่อหน่วย (บาท) <span className='text-destructive'>*</span>
          </Label>
          <Input
            id='rate_per_unit'
            type='number'
            min='0'
            step='0.01'
            {...register('rate_per_unit', { valueAsNumber: true })}
            className={errors.rate_per_unit ? 'border-destructive' : ''}
          />
          {errors.rate_per_unit && (
            <p className='text-xs text-destructive'>{errors.rate_per_unit.message}</p>
          )}
        </div>

        <div className='grid gap-1.5'>
          <Label htmlFor='fixed_fee'>ค่าบริการคงที่ (บาท · ไม่บังคับ)</Label>
          <Input
            id='fixed_fee'
            type='number'
            min='0'
            step='0.01'
            {...register('fixed_fee', { valueAsNumber: true })}
          />
        </div>
      </div>

      {/* ยอดรวม (computed) */}
      <div className='grid gap-1.5'>
        <Label>ยอดรวม (คำนวณอัตโนมัติ)</Label>
        <div className='flex h-9 items-center rounded-md border bg-muted px-3 text-sm font-semibold text-foreground'>
          {total.toLocaleString('th-TH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{' '}
          บาท
        </div>
      </div>

      {/* หมายเหตุ */}
      <div className='grid gap-1.5'>
        <Label htmlFor='notes'>หมายเหตุ</Label>
        <Textarea
          id='notes'
          placeholder='หมายเหตุเพิ่มเติม...'
          rows={3}
          {...register('notes')}
        />
      </div>

      {/* Actions */}
      <div className='flex justify-end gap-3 pt-2'>
        <Button type='button' variant='outline' onClick={onCancel} disabled={submitting}>
          ยกเลิก
        </Button>
        <Button type='submit' disabled={submitting}>
          {submitting
            ? 'กำลังบันทึก...'
            : mode === 'create'
              ? 'บันทึกการอ่านมิเตอร์'
              : 'บันทึกการแก้ไข'}
        </Button>
      </div>
    </form>
  )
}
