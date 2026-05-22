import { Check, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  entryToAddress,
  formatAddressEntry,
  searchThaiAddress,
  type ThaiAddress,
} from '@/lib/thai-address'
import { cn } from '@/lib/utils'

type ThaiAddressInputProps = {
  value: ThaiAddress
  onChange: (value: ThaiAddress) => void
  /** "no" / "moo" / "soi" / "road" pre-filled free-text · ผม manage external · เก็บแยก */
  lineValue?: string
  onLineChange?: (line: string) => void
  /** Disable form interaction (e.g., during submit) */
  disabled?: boolean
}

/**
 * Thai address input with cascade autocomplete · 7,498 ตำบล + รหัสไปรษณีย์
 *
 * UX:
 * - 1 search field — พิมพ์ตำบล หรือ รหัสไปรษณีย์ (5 หลัก) → autocomplete
 * - 4 visible fields ที่ auto-fill หลังเลือก: ตำบล · อำเภอ · จังหวัด · รหัสไปรษณีย์
 * - แก้ทีหลังได้ (in case auto-fill ผิด)
 */
export function ThaiAddressInput({
  value,
  onChange,
  lineValue = '',
  onLineChange,
  disabled = false,
}: ThaiAddressInputProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const results = useMemo(() => searchThaiAddress(query, 30), [query])

  return (
    <div className='space-y-3'>
      {/* Free-text street line */}
      <div>
        <Label htmlFor='addr-line'>เลขที่ / หมู่ / ซอย / ถนน</Label>
        <Input
          id='addr-line'
          value={lineValue}
          onChange={(e) => onLineChange?.(e.target.value)}
          placeholder='เช่น 123/45 หมู่ 5 ซอยลาดพร้าว 71 ถ.ลาดพร้าว'
          disabled={disabled}
        />
      </div>

      {/* Smart search: subdistrict OR postal code */}
      <div>
        <Label>ค้น ตำบล หรือ รหัสไปรษณีย์</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type='button'
              className={cn(
                'flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-left text-sm shadow-xs hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
                disabled && 'pointer-events-none opacity-50'
              )}
              disabled={disabled}
            >
              <span className='inline-flex items-center gap-2 text-muted-foreground'>
                <Search className='size-4' />
                {query || 'เช่น "พระโขนง" หรือ "10110"'}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent className='w-[--radix-popover-trigger-width] p-0' align='start'>
            <Command shouldFilter={false}>
              <CommandInput
                placeholder='พิมพ์ตำบล หรือ รหัสไปรษณีย์...'
                value={query}
                onValueChange={setQuery}
              />
              <CommandList>
                <CommandEmpty>
                  {query.trim()
                    ? 'ไม่พบที่อยู่ตรงกับคำค้น'
                    : 'พิมพ์เพื่อค้น (อย่างน้อย 1 ตัวอักษร)'}
                </CommandEmpty>
                {results.length > 0 && (
                  <CommandGroup heading={`พบ ${results.length} รายการ`}>
                    {results.map((entry) => {
                      const label = formatAddressEntry(entry)
                      const isSelected =
                        value.subdistrict === entry[0] &&
                        value.district === entry[1] &&
                        value.province === entry[2] &&
                        value.postal === entry[3]
                      return (
                        <CommandItem
                          key={`${entry[3]}-${entry[0]}-${entry[1]}`}
                          value={label}
                          onSelect={() => {
                            onChange(entryToAddress(entry))
                            setQuery('')
                            setOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 size-4',
                              isSelected ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          <span>{label}</span>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <p className='mt-1 text-xs text-muted-foreground'>
          เลือกแล้วระบบจะ auto-fill ตำบล · อำเภอ · จังหวัด · รหัสไปรษณีย์ ให้อัตโนมัติ
        </p>
      </div>

      {/* 4 auto-filled fields · editable */}
      <div className='grid gap-3 sm:grid-cols-2'>
        <div>
          <Label htmlFor='addr-subdistrict'>ตำบล / แขวง</Label>
          <Input
            id='addr-subdistrict'
            value={value.subdistrict}
            onChange={(e) => onChange({ ...value, subdistrict: e.target.value })}
            disabled={disabled}
          />
        </div>
        <div>
          <Label htmlFor='addr-district'>อำเภอ / เขต</Label>
          <Input
            id='addr-district'
            value={value.district}
            onChange={(e) => onChange({ ...value, district: e.target.value })}
            disabled={disabled}
          />
        </div>
        <div>
          <Label htmlFor='addr-province'>จังหวัด</Label>
          <Input
            id='addr-province'
            value={value.province}
            onChange={(e) => onChange({ ...value, province: e.target.value })}
            disabled={disabled}
          />
        </div>
        <div>
          <Label htmlFor='addr-postal'>รหัสไปรษณีย์</Label>
          <Input
            id='addr-postal'
            value={value.postal}
            onChange={(e) => onChange({ ...value, postal: e.target.value })}
            inputMode='numeric'
            maxLength={5}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  )
}
