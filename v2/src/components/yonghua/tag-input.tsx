import { Plus, X } from 'lucide-react'
import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
 * Free-form multi-tag input (inline · ไม่ใช้ popover/cmdk เพื่อความชัวร์)
 * - พิมพ์แล้วกด Enter หรือ comma เพื่อเพิ่ม
 * - กดชิป suggestion ด้านล่างเพื่อเพิ่ม
 * - กด × บน badge เพื่อลบ · Backspace ตอน input ว่าง = ลบตัวล่าสุด
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
  const [query, setQuery] = React.useState('')
  const selected = React.useMemo(() => new Set(value), [value])
  const q = norm(query)
  const atMax = value.length >= max

  // suggestion ที่ยังไม่ถูกเลือก + match query (จำกัด 10)
  const matches = React.useMemo(() => {
    const uniq = Array.from(new Set(suggestions.map(norm).filter(Boolean)))
    return uniq
      .filter((t) => !selected.has(t))
      .filter((t) => (q ? t.toLowerCase().includes(q.toLowerCase()) : true))
      .sort((a, b) => a.localeCompare(b, 'th'))
      .slice(0, 10)
  }, [suggestions, selected, q])

  const canCreate =
    q.length > 0 &&
    !selected.has(q) &&
    !matches.some((t) => t.toLowerCase() === q.toLowerCase())

  function addTag(tag: string) {
    const t = norm(tag)
    if (!t || selected.has(t) || value.length >= max) return
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

      {!atMax && (
        <Input
          id={id}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              if (canCreate) addTag(q)
              else if (matches.length > 0) addTag(matches[0])
            } else if (e.key === 'Backspace' && !query && value.length > 0) {
              removeTag(value[value.length - 1])
            }
          }}
          placeholder={placeholder}
          className='h-8'
        />
      )}

      {(matches.length > 0 || canCreate) && (
        <div className='flex flex-wrap gap-1.5'>
          {canCreate && (
            <button
              type='button'
              onClick={() => addTag(q)}
              className='inline-flex items-center gap-1 rounded-full border border-dashed border-primary/50 px-2 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10'
            >
              <Plus className='size-3' />
              สร้าง "{q}"
            </button>
          )}
          {matches.map((tag) => (
            <button
              key={tag}
              type='button'
              onClick={() => addTag(tag)}
              className='inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted'
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
