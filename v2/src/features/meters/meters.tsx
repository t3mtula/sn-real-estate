import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Link, useNavigate } from '@tanstack/react-router'
import { Building2, Calendar, CreditCard, FileText, Gauge, Plus, Receipt } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useRowHover } from '@/hooks/use-row-hover'
import { CursorPopover } from '@/components/cursor-popover'
import { SortableHeader } from '@/components/yonghua/sortable-header'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MeterGrid } from '@/features/meters/meter-grid'
import { getMeterTypeLabel, useMeterReadings } from '@/features/meters/queries'
import type { MeterReading, MeterType } from '@/features/meters/types'
import { cn } from '@/lib/utils'

const METER_TYPE_OPTIONS: { value: MeterType | 'all'; label: string }[] = [
  { value: 'all', label: 'ทุกประเภท' },
  { value: 'water', label: 'น้ำ' },
  { value: 'electricity', label: 'ไฟฟ้า' },
  { value: 'other', label: 'อื่นๆ' },
]

const BILLED_OPTIONS = [
  { value: 'all', label: 'ทุกสถานะ' },
  { value: 'yes', label: 'เรียกเก็บแล้ว' },
  { value: 'no', label: 'ยังไม่เก็บ' },
]

export function Meters() {
  const { data: rows, isLoading, error } = useMeterReadings()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const navigate = useNavigate()
  const { hover, onEnter, onMove, onLeave } = useRowHover<MeterReading>()

  // Filter states
  const [propertyFilter, setPropertyFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [billedFilter, setBilledFilter] = useState<string>('all')

  // Unique properties list for dropdown
  const propertyOptions = useMemo(() => {
    if (!rows) return [] as Array<{ id: string; name: string }>
    const map = new Map<string, string>()
    rows.forEach((r) => {
      const id = (r.data?.property_id ?? '').trim()
      if (id && !map.has(id)) map.set(id, r.data?.property_name ?? id)
    })
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'th'))
  }, [rows])

  // Client-side filter
  const filtered = useMemo(() => {
    if (!rows) return []
    return rows.filter((r) => {
      if (propertyFilter !== 'all' && r.data?.property_id !== propertyFilter)
        return false
      if (typeFilter !== 'all' && r.data?.type !== typeFilter) return false
      if (billedFilter === 'yes' && !r.data?.billed) return false
      if (billedFilter === 'no' && r.data?.billed) return false
      return true
    })
  }, [rows, propertyFilter, typeFilter, billedFilter])

  const columns = useMemo<ColumnDef<MeterReading>[]>(
    () => [
      {
        id: 'reading_date',
        accessorFn: (row) => row.data?.reading_date ?? '',
        header: ({ column }) => (
          <SortableHeader column={column}>วันที่</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className='text-sm tabular-nums'>
            {row.original.data?.reading_date || '—'}
          </span>
        ),
      },
      {
        id: 'property',
        accessorFn: (row) => row.data?.property_name ?? '',
        header: ({ column }) => (
          <SortableHeader column={column}>ทรัพย์สิน</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className='text-sm'>
            {row.original.data?.property_name || '—'}
          </span>
        ),
      },
      {
        id: 'type',
        accessorFn: (row) => row.data?.type ?? '',
        header: ({ column }) => (
          <SortableHeader column={column}>ประเภท</SortableHeader>
        ),
        cell: ({ row }) => {
          const t = row.original.data?.type
          return (
            <Badge variant='outline' className='font-normal'>
              {getMeterTypeLabel(t)}
            </Badge>
          )
        },
      },
      {
        id: 'readings',
        accessorFn: (row) => row.data?.curr_reading ?? 0,
        header: 'มิเตอร์ก่อน / หลัง',
        cell: ({ row }) => {
          const d = row.original.data
          return (
            <span className='text-sm tabular-nums text-muted-foreground'>
              {(d?.prev_reading ?? 0).toLocaleString('th-TH')}
              {' → '}
              <span className='text-foreground font-medium'>
                {(d?.curr_reading ?? 0).toLocaleString('th-TH')}
              </span>
            </span>
          )
        },
      },
      {
        id: 'units',
        accessorFn: (row) => row.data?.units ?? 0,
        header: ({ column }) => (
          <SortableHeader column={column}>หน่วย</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className='text-sm tabular-nums font-medium'>
            {(row.original.data?.units ?? 0).toLocaleString('th-TH')}
          </span>
        ),
      },
      {
        id: 'total',
        accessorFn: (row) => row.data?.total ?? 0,
        header: ({ column }) => (
          <SortableHeader column={column}>จำนวนเงิน</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className='text-sm tabular-nums'>
            {(row.original.data?.total ?? 0).toLocaleString('th-TH', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        ),
      },
      {
        id: 'billed',
        accessorFn: (row) => (row.data?.billed ? '1' : '0'),
        header: 'สถานะ',
        cell: ({ row }) => {
          const billed = row.original.data?.billed
          return (
            <Badge
              variant={billed ? 'default' : 'secondary'}
              className='font-normal'
            >
              {billed ? 'เรียกเก็บแล้ว' : 'ยังไม่เก็บ'}
            </Badge>
          )
        },
      },
    ],
    [],
  )

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const totalRows = rows?.length ?? 0
  const filteredCount = filtered.length

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>มิเตอร์น้ำ/ไฟ</h2>
            <p className='text-muted-foreground text-sm'>
              {isLoading
                ? 'กำลังโหลด...'
                : `${filteredCount.toLocaleString('th-TH')} / ${totalRows.toLocaleString('th-TH')} รายการ`}
            </p>
          </div>
          <Button asChild variant='outline'>
            <Link to='/meters/new'>
              <Plus className='size-4' />
              จดทีละรายการ
            </Link>
          </Button>
        </div>

        <Tabs defaultValue='grid' className='space-y-4 sm:space-y-6'>
          <TabsList>
            <TabsTrigger value='grid'>จดมิเตอร์ (ตาราง)</TabsTrigger>
            <TabsTrigger value='history'>ประวัติการอ่าน</TabsTrigger>
          </TabsList>

          <TabsContent value='grid'>
            <MeterGrid />
          </TabsContent>

          <TabsContent value='history' className='space-y-4 sm:space-y-6'>
        {/* Filters */}
        <div className='flex flex-wrap items-center gap-3'>
          <Select value={propertyFilter} onValueChange={setPropertyFilter}>
            <SelectTrigger className='w-[200px]'>
              <SelectValue placeholder='ทุกทรัพย์สิน' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>ทุกทรัพย์สิน</SelectItem>
              {propertyOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className='w-[160px]'>
              <SelectValue placeholder='ทุกประเภท' />
            </SelectTrigger>
            <SelectContent>
              {METER_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={billedFilter} onValueChange={setBilledFilter}>
            <SelectTrigger className='w-[180px]'>
              <SelectValue placeholder='ทุกสถานะ' />
            </SelectTrigger>
            <SelectContent>
              {BILLED_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && (
          <div className='rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive'>
            ดึงข้อมูลไม่สำเร็จ —{' '}
            {error instanceof Error ? error.message : String(error)}
          </div>
        )}

        <div className='overflow-x-auto rounded-md border bg-card'>
          <Table className='min-w-[860px]'>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className='hover:bg-transparent'>
                  {hg.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className='text-xs uppercase tracking-wider'
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
                  <TableRow key={`skeleton-${i}`}>
                    <TableCell colSpan={columns.length}>
                      <Skeleton className='h-8 w-full' />
                    </TableCell>
                  </TableRow>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className='h-32 text-center'>
                    <div className='flex flex-col items-center gap-2 text-muted-foreground'>
                      <Gauge className='size-8' />
                      <p>
                        {totalRows === 0
                          ? 'ยังไม่มีการบันทึกมิเตอร์'
                          : 'ไม่พบรายการที่ตรงกับเงื่อนไข'}
                      </p>
                      {totalRows === 0 && (
                        <Button asChild variant='link' className='h-auto p-0'>
                          <Link to='/meters/new'>บันทึกรายการแรก</Link>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn('cursor-pointer', 'hover:bg-muted/40')}
                    onClick={() =>
                      navigate({
                        to: '/meters/$id',
                        params: { id: row.original.id },
                      })
                    }
                    onMouseEnter={onEnter(row.original)}
                    onMouseMove={onMove(row.original)}
                    onMouseLeave={onLeave}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className='py-3'>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
          </TabsContent>
        </Tabs>
      </Main>

      <CursorPopover open={!!hover} x={hover?.x ?? 0} y={hover?.y ?? 0}>
        {hover && <MeterHoverDetail row={hover.row} />}
      </CursorPopover>
    </>
  )
}

function MeterHoverDetail({ row }: { row: MeterReading }) {
  const d = (row.data ?? {}) as Record<string, unknown>
  const typeLabel = getMeterTypeLabel((d.type as MeterType | undefined) ?? 'other')
  const billed = d.invoice_id != null
  const items: { icon: typeof Calendar; label: string; value: string }[] = []
  if (d.property_name) items.push({ icon: Building2, label: 'ทรัพย์สิน', value: String(d.property_name) })
  if (d.meter_no) items.push({ icon: Gauge, label: 'เลขมิเตอร์', value: String(d.meter_no) })
  if (d.reading_date) items.push({ icon: Calendar, label: 'วันอ่าน', value: String(d.reading_date) })
  if (d.previous_reading != null && d.current_reading != null) {
    items.push({
      icon: Gauge,
      label: 'อ่าน',
      value: `${d.previous_reading} → ${d.current_reading} (${Number(d.current_reading) - Number(d.previous_reading)} หน่วย)`,
    })
  }
  if (d.rate_per_unit != null) {
    items.push({
      icon: CreditCard,
      label: 'ราคา/หน่วย',
      value: `${d.rate_per_unit} บาท`,
    })
  }
  if (d.fixed_fee != null && Number(d.fixed_fee) > 0) {
    items.push({ icon: CreditCard, label: 'ค่าธรรมเนียม', value: `${d.fixed_fee} บาท` })
  }
  if (d.total != null) {
    items.push({ icon: CreditCard, label: 'รวม', value: `${d.total} บาท` })
  }
  if (billed) {
    items.push({
      icon: Receipt,
      label: 'ใบแจ้งหนี้',
      value: String(d.invoice_no ?? d.invoice_id),
    })
  }
  const note = d.notes as string | undefined
  return (
    <div className='space-y-2 text-xs'>
      <div className='flex items-center gap-2 border-b pb-2'>
        <Gauge className='size-4 text-muted-foreground' />
        <span className='font-semibold'>{typeLabel}</span>
        <Badge
          variant='outline'
          className={`ml-auto text-[10px] font-normal ${billed ? 'border-emerald-500/40 text-emerald-700' : ''}`}
        >
          {billed ? 'เก็บแล้ว' : 'ยังไม่เก็บ'}
        </Badge>
      </div>
      <div className='space-y-1.5'>
        {items.map((it, i) => (
          <div key={i} className='flex items-start gap-2'>
            <it.icon className='mt-0.5 size-3.5 shrink-0 text-muted-foreground' />
            <div className='min-w-0 flex-1'>
              <span className='text-[10px] uppercase tracking-wider text-muted-foreground'>
                {it.label}
              </span>
              <p className='leading-snug'>{it.value}</p>
            </div>
          </div>
        ))}
        {note && (
          <div className='flex items-start gap-2 border-t pt-1.5'>
            <FileText className='mt-0.5 size-3.5 shrink-0 text-muted-foreground' />
            <p className='leading-snug whitespace-pre-wrap'>{note}</p>
          </div>
        )}
      </div>
    </div>
  )
}
