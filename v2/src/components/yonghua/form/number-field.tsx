import {
  type Control,
  type FieldPath,
  type FieldValues,
  useController,
} from 'react-hook-form'
import { FormControl, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface NumberFieldProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label?: string
  placeholder?: string
  /** Suffix (e.g., "บาท", "ตร.ม.") */
  suffix?: string
  /** decimal places · default 0 (integer only) */
  decimal?: number
  min?: number
  max?: number
  disabled?: boolean
  className?: string
}

/**
 * NumberField · type-safe number input · ใช้กับ react-hook-form + Zod
 *
 * แก้ปัญหาที่ Input type=number กับ field.value = number | unknown:
 * - render: value={String(field.value ?? "")} เพื่อให้ "" → 0 ไม่ flash
 * - change: parse string → number (หรือ "" ถ้าว่าง)
 * - decimal: allow "." ถ้า decimal > 0
 *
 * Usage:
 *   <NumberField control={form.control} name="rent" label="ค่าเช่า" suffix="บาท" />
 *   <NumberField control={form.control} name="qty" label="จำนวน" decimal={2} />
 */
export function NumberField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  suffix,
  decimal = 0,
  min,
  max,
  disabled,
  className,
}: NumberFieldProps<T>) {
  const { field, fieldState } = useController({ control, name })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    if (raw === '') {
      field.onChange('')
      return
    }
    const parsed = decimal > 0 ? Number.parseFloat(raw) : Number.parseInt(raw, 10)
    if (Number.isNaN(parsed)) return
    field.onChange(parsed)
  }

  return (
    <FormItem className={className}>
      {label && <FormLabel>{label}</FormLabel>}
      <FormControl>
        <div className={cn('relative', suffix && 'pr-2')}>
          <Input
            type='number'
            inputMode={decimal > 0 ? 'decimal' : 'numeric'}
            step={decimal > 0 ? Math.pow(10, -decimal) : 1}
            placeholder={placeholder}
            min={min}
            max={max}
            disabled={disabled}
            value={
              field.value === undefined || field.value === null || field.value === ''
                ? ''
                : String(field.value)
            }
            onChange={handleChange}
            onBlur={field.onBlur}
            name={field.name}
            ref={field.ref}
            className={cn(suffix && 'pe-14', fieldState.error && 'border-destructive')}
          />
          {suffix && (
            <span className='pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm text-muted-foreground'>
              {suffix}
            </span>
          )}
        </div>
      </FormControl>
      <FormMessage />
    </FormItem>
  )
}
