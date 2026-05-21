import { format as dfFormat, parse as dfParse } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { fmtThaiLong, parseBE } from '@/lib/thai/date'
import { cn } from '@/lib/utils'

interface BeDatePickerProps {
  /** value · ใช้ Date object หรือ ISO string · undefined = ยังไม่เลือก */
  value?: Date | string | null
  onChange?: (date: Date | null) => void
  /** placeholder · default "วว/ดด/ปปปป (พ.ศ.)" */
  placeholder?: string
  disabled?: boolean
  /** ถ้า true · render เป็น input อย่างเดียว (ไม่มี popover) */
  inline?: boolean
  className?: string
}

/**
 * BeDatePicker · date picker ที่แสดง พ.ศ. + ยอมรับ input พ.ศ.
 *
 * - ภายในเก็บ Date object (ค.ศ.) ตามมาตรฐาน · เมื่อ submit ส่ง ISO string
 * - แสดงเป็น พ.ศ. "21 พฤษภาคม 2569" · หรือ input "21/05/2569"
 * - Calendar popover ยังเป็น ค.ศ. (limit ของ react-day-picker) · แต่ display button + input เป็น พ.ศ.
 *
 * Usage:
 *   <BeDatePicker value={field.value} onChange={field.onChange} />
 *
 *   หรือใน RHF FormField:
 *   <FormField name="startDate" render={({ field }) => (
 *     <FormItem>
 *       <FormLabel>วันเริ่มสัญญา</FormLabel>
 *       <BeDatePicker value={field.value} onChange={field.onChange} />
 *     </FormItem>
 *   )} />
 */
export function BeDatePicker({
  value,
  onChange,
  placeholder = 'วว/ดด/ปปปป (พ.ศ.)',
  disabled,
  inline,
  className,
}: BeDatePickerProps) {
  const date =
    typeof value === 'string'
      ? value
        ? new Date(value)
        : null
      : value ?? null

  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState<string>(
    date && !Number.isNaN(date.getTime()) ? dfFormat(date, 'dd/MM/') + (date.getFullYear() + 543) : '',
  )

  function handleSelect(d: Date | undefined) {
    if (!d) {
      onChange?.(null)
      setInputValue('')
      return
    }
    onChange?.(d)
    setInputValue(dfFormat(d, 'dd/MM/') + (d.getFullYear() + 543))
    setOpen(false)
  }

  function handleInputBlur(raw: string) {
    if (!raw.trim()) {
      onChange?.(null)
      setInputValue('')
      return
    }
    const parsed = parseBE(raw)
    if (parsed) {
      const native = parsed.toDate()
      onChange?.(native)
      setInputValue(dfFormat(native, 'dd/MM/') + (native.getFullYear() + 543))
    } else {
      // invalid · restore previous value
      setInputValue(
        date && !Number.isNaN(date.getTime())
          ? dfFormat(date, 'dd/MM/') + (date.getFullYear() + 543)
          : '',
      )
    }
  }

  if (inline) {
    return (
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={(e) => handleInputBlur(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />
    )
  }

  return (
    <div className={cn('flex gap-2', className)}>
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={(e) => handleInputBlur(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className='flex-1'
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type='button'
            variant='outline'
            size='icon'
            disabled={disabled}
            aria-label='เปิดปฏิทิน'
          >
            <CalendarIcon className='size-4' />
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-auto p-0' align='end'>
          <Calendar
            mode='single'
            selected={date ?? undefined}
            onSelect={handleSelect}
            captionLayout='dropdown'
          />
          {date && (
            <div className='border-t p-2 text-center text-xs text-muted-foreground'>
              {fmtThaiLong(date)}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

// Re-export date-fns parse/format helpers for tests
export { dfFormat, dfParse }
