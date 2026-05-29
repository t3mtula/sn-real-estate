import { Check, Plus, Tag as TagIcon, X } from 'lucide-react'
import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export type TagInputProps = {
  /** tags ที่เลือกอยู่ */
  value: string[]
  onChange: (next: string[]) => void
  /** tag ที่เคยใช้ทั้งระบบ — ใช้ autocomplete */
  suggestions?: string[]
  placeholder?: string
  /** จำกัดจำนวน tag (default 20) */
  max?: number
  id?: string
  className?: string
}

function norm(s: string): string {
  return s.trim()
}

/**
 * Free-form multi-tag input.
 * - พิมพ์แล้วกด Enter หรือเลือกจาก dropdown เพื่อเพิ่ม
 * - tag ใหม่ที่ยังไม่เคยมี → แสดง "+ สร้าง" ให้กดเพิ่มได้
 * - กด × บน badge หรือ Backspace (ตอน input ว่าง) เพื่อลบ
 */
export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = 'เพิ่ม tag…',
  max = 20,
  id,
  className,
}: TagInputProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')

  const selected = React.useMemo(() => new Set(value), [value])
  const q = norm(query)

  // suggestion ที่ยังไม่ถูกเลือก + match query
  const available = React.useMemo(() => {
    const uniq = Array.from(new Set(suggestions.map(norm).filter(Boolean)))
    return uniq
      .filter((t) => !selected.has(t))
      .filter((t) => (q ? t.toLowerCase().includes(q.toLowerCase()) : true))
      .sort((a, b) => a.localeCompare(b, 'th'))
  }, [suggestions, selected, q])

  const canCreate =
    q.length > 0 &&
    !selected.has(q) &&
    !available.some((t) => t.toLowerCase() === q.toLowerCase())

  const atMax = value.length >= max

  function addTag(tag: string) {
    const t = norm(tag)
    if (!t || selected.has(t) || atMax) return
    onChange([...value, t])
    setQuery('')
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag))
  }

  return (
    <div className={cn('space-y-2', className)}>
      {value.length > 0 && (
        <div className='flex flex-wrap gap-1.5'>
          {value.map((tag) => (
            <Badge
              key={tag}
              variant='secondary'
              className='gap-1 pe-1 ps-2 font-normal'
            >
              {tag}
              <button
                type='button'
                onClick={() => removeTag(tag)}
                className='rounded-sm opacity-60 transition-opacity hover:opacity-100'
                aria-label={`ลบ tag ${tag}`}
              >
                <X className='size-3' />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type='button'
            variant='outline'
            size='sm'
            className='h-8 border-dashed text-muted-foreground'
            disabled={atMax}
          >
            <TagIcon className='size-3.5' />
            {atMax ? `ครบ ${max} tag แล้ว` : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-64 p-0' align='start'>
          <Command
            filter={() => 1 /* เราคุม filter เองผ่าน available */}
          >
            <CommandInput
              placeholder='พิมพ์เพื่อค้นหา/สร้าง tag'
              value={query}
              onValueChange={setQuery}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canCreate) {
                  e.preventDefault()
                  addTag(q)
                }
              }}
            />
            <CommandList>
              {!canCreate && available.length === 0 && (
                <CommandEmpty>ไม่มี tag · พิมพ์เพื่อสร้างใหม่</CommandEmpty>
              )}
              {available.length > 0 && (
                <CommandGroup heading='เลือก tag ที่เคยใช้'>
                  {available.map((tag) => (
                    <CommandItem
                      key={tag}
                      value={tag}
                      onSelect={() => addTag(tag)}
                    >
                      <Check className='size-4 opacity-0' />
                      {tag}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {canCreate && (
                <CommandGroup heading='สร้างใหม่'>
                  <CommandItem value={`__create__${q}`} onSelect={() => addTag(q)}>
                    <Plus className='size-4' />
                    สร้าง "{q}"
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
