/**
 * Cascading multi-filter — data-agnostic · reusable ทั้งแอป
 *
 * ไม่ผูกกับ TanStack Table (ใช้กับ array อะไรก็ได้ — wizard, list page, ฯลฯ)
 * - useCascadingFilter(items, fields, searchGet) → { filtered, ... }
 * - <FilterBar> = ช่องค้นหา + dropdown faceted ต่อ field
 *
 * Cascade: option ของแต่ละ field คิดจาก items ที่ผ่าน filter "ตัวอื่น" แล้ว
 *          (+ จำนวนนับ) → ใส่ตัวไหน ตัวที่เหลือแคบตาม · กรองสด client-side
 */
import { useMemo, useState } from 'react'
import { Check, ListFilter, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'

/** นิยาม field สำหรับกรอง — get คืนค่า/หลายค่า (เช่น tags) ของ item */
export type FilterField<T> = {
  key: string
  label: string
  get: (item: T) => string | string[] | undefined | null
}

function toValues(v: string | string[] | undefined | null): string[] {
  if (v == null) return []
  if (Array.isArray(v)) return v.filter((x) => x != null && x !== '').map(String)
  return v === '' ? [] : [String(v)]
}

export type CascadingFilter<T> = {
  search: string
  setSearch: (s: string) => void
  selected: Record<string, string[]>
  setFieldValues: (key: string, values: string[]) => void
  /** items ที่ผ่านทุกเงื่อนไข */
  filtered: T[]
  /** option + จำนวน (cascade) ของ field — value → count */
  facetsFor: (key: string) => Array<{ value: string; count: number }>
  reset: () => void
  activeCount: number
  fields: FilterField<T>[]
}

export function useCascadingFilter<T>(
  items: T[],
  fields: FilterField<T>[],
  searchGet: (item: T) => string,
): CascadingFilter<T> {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Record<string, string[]>>({})

  return useMemo(() => {
    const q = search.trim().toLowerCase()
    const passesSearch = (it: T) =>
      !q || searchGet(it).toLowerCase().includes(q)
    const passesField = (it: T, f: FilterField<T>) => {
      const sel = selected[f.key] ?? []
      if (sel.length === 0) return true
      const vals = toValues(f.get(it))
      return sel.some((s) => vals.includes(s))
    }

    const filtered = items.filter(
      (it) => passesSearch(it) && fields.every((f) => passesField(it, f)),
    )

    const facetsFor = (key: string) => {
      const field = fields.find((f) => f.key === key)
      if (!field) return []
      // cascade: นับจาก items ที่ผ่าน search + ทุก field "ยกเว้นตัวนี้"
      const base = items.filter(
        (it) =>
          passesSearch(it) &&
          fields.filter((o) => o.key !== key).every((o) => passesField(it, o)),
      )
      const counts = new Map<string, number>()
      for (const it of base) {
        for (const val of toValues(field.get(it))) {
          counts.set(val, (counts.get(val) ?? 0) + 1)
        }
      }
      // ค่าที่เลือกไว้แต่ตอนนี้นับได้ 0 → ยังโชว์ (ให้เอาออกได้)
      for (const val of selected[key] ?? []) {
        if (!counts.has(val)) counts.set(val, 0)
      }
      return Array.from(counts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'th'))
    }

    const setFieldValues = (key: string, values: string[]) =>
      setSelected((p) => ({ ...p, [key]: values }))
    const reset = () => {
      setSearch('')
      setSelected({})
    }
    const activeCount =
      (q ? 1 : 0) +
      Object.values(selected).filter((v) => v.length > 0).length

    return {
      search,
      setSearch,
      selected,
      setFieldValues,
      filtered,
      facetsFor,
      reset,
      activeCount,
      fields,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, fields, search, selected, searchGet])
}

/** dropdown faceted ของ field เดียว */
function FacetFilter<T>({
  filter,
  field,
}: {
  filter: CascadingFilter<T>
  field: FilterField<T>
}) {
  const options = filter.facetsFor(field.key)
  const selected = new Set(filter.selected[field.key] ?? [])
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant='outline' size='sm' className='h-9 border-dashed'>
          <ListFilter className='size-4' />
          {field.label}
          {selected.size > 0 && (
            <>
              <Separator orientation='vertical' className='mx-1 h-4' />
              <Badge variant='secondary' className='rounded-sm px-1 font-normal'>
                {selected.size}
              </Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-64 p-0' align='start'>
        <Command>
          <CommandInput placeholder={`ค้น ${field.label}...`} />
          <CommandList>
            <CommandEmpty>ไม่พบ</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const isSel = selected.has(opt.value)
                return (
                  <CommandItem
                    key={opt.value}
                    onSelect={() => {
                      const next = new Set(selected)
                      if (isSel) next.delete(opt.value)
                      else next.add(opt.value)
                      filter.setFieldValues(field.key, Array.from(next))
                    }}
                  >
                    <div
                      className={cn(
                        'flex size-4 items-center justify-center rounded-sm border border-primary',
                        isSel
                          ? 'bg-primary text-primary-foreground'
                          : 'opacity-50 [&_svg]:invisible',
                      )}
                    >
                      <Check className='size-3.5' />
                    </div>
                    <span className='truncate'>{opt.value}</span>
                    <span className='ms-auto font-mono text-xs text-muted-foreground'>
                      {opt.count}
                    </span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {selected.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => filter.setFieldValues(field.key, [])}
                    className='justify-center text-center'
                  >
                    ล้าง {field.label}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/** แถบกรอง — ช่องค้นหา + dropdown faceted ต่อ field + ปุ่มล้าง */
export function FilterBar<T>({
  filter,
  searchPlaceholder = 'ค้นหา...',
  className,
}: {
  filter: CascadingFilter<T>
  searchPlaceholder?: string
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div className='relative min-w-[14rem] flex-1'>
        <Search className='pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
        <Input
          value={filter.search}
          onChange={(e) => filter.setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className='h-9 pl-9'
        />
      </div>
      {filter.fields.map((f) => (
        <FacetFilter key={f.key} filter={filter} field={f} />
      ))}
      {filter.activeCount > 0 && (
        <Button
          variant='ghost'
          size='sm'
          className='h-9'
          onClick={filter.reset}
        >
          <X className='size-4' />
          ล้างทั้งหมด
        </Button>
      )}
    </div>
  )
}
