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
import { Plus, Receipt, Search, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { GenerateMonthlyDialog } from '@/features/invoices/generate-monthly-dialog'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { SortableHeader } from '@/components/yonghua/sortable-header'
import {
  daysOverdue,
  formatMonth,
  getEffectiveStatus,
  getInvoiceDisplay,
  getStatusMeta,
  useInvoices,
} from '@/features/invoices/queries'
import {
  INVOICE_STATUSES,
  type Invoice,
  type InvoiceStatus,
} from '@/features/invoices/types'
import { amt } from '@/lib/thai'
import { cn } from '@/lib/utils'

type Row = Invoice & { _status: InvoiceStatus; _overdue: number }

const STATUS_TONE_CLASS: Record<string, string> = {
  success: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300',
  warning: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300',
  info: 'bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-300',
  muted: 'bg-muted text-muted-foreground border-border',
  destructive: 'bg-destructive/10 text-destructive border-destructive/30',
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const meta = getStatusMeta(status)
  return (
    <Badge variant='outline' className={cn('font-normal', STATUS_TONE_CLASS[meta.tone] ?? '')}>
      {meta.label}
    </Badge>
  )
}

export function Invoices() {
  const { data: invoices, isLoading, error } = useInvoices()
  const [sorting, setSorting] = useState<SortingState>([{ id: 'month', desc: true }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const navigate = useNavigate()

  const rows = useMemo<Row[]>(() => {
    if (!invoices) return []
    return invoices.map((inv) => ({
      ...inv,
      _status: getEffectiveStatus(inv),
      _overdue: daysOverdue(inv),
    }))
  }, [invoices])

  const months = useMemo(() => {
    const set = new Set<string>()
    for (const inv of invoices ?? []) {
      const m = inv.data?.month
      if (m && /^\d{4}-\d{2}$/.test(m)) set.add(m)
    }
    return Array.from(set).sort().reverse()
  }, [invoices])

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        id: 'no',
        accessorFn: (row) => getInvoiceDisplay(row),
        header: ({ column }) => <SortableHeader column={column}>เลขที่</SortableHeader>,
        cell: ({ row }) => {
          const v = getInvoiceDisplay(row.original)
          return (
            <span className='block max-w-[160px] truncate font-medium' title={v}>
              {v}
            </span>
          )
        },
      },
      {
        id: 'month',
        accessorFn: (row) => row.data?.month ?? '',
        header: ({ column }) => <SortableHeader column={column}>เดือน</SortableHeader>,
        cell: ({ row }) => (
          <span className='text-sm tabular-nums'>
            {formatMonth(row.original.data?.month)}
          </span>
        ),
        filterFn: (row, _id, value) => {
          if (!value || value === 'all') return true
          return row.original.data?.month === value
        },
      },
      {
        id: 'tenant',
        accessorFn: (row) => row.data?.tenant ?? '',
        header: ({ column }) => <SortableHeader column={column}>ผู้เช่า</SortableHeader>,
        cell: ({ row }) => {
          const v = row.original.data?.tenant?.trim() || '—'
          return (
            <span className='block max-w-[200px] truncate text-sm' title={v}>
              {v}
            </span>
          )
        },
      },
      {
        id: 'property',
        accessorFn: (row) => row.data?.property ?? '',
        header: ({ column }) => <SortableHeader column={column}>ทรัพย์สิน</SortableHeader>,
        cell: ({ row }) => {
          const v = row.original.data?.property?.trim() || '—'
          return (
            <span className='block max-w-[160px] truncate text-sm' title={v}>
              {v}
            </span>
          )
        },
      },
      {
        id: 'total',
        accessorFn: (row) => Number(row.data?.total) || 0,
        header: ({ column }) => <SortableHeader column={column}>ยอด</SortableHeader>,
        cell: ({ row }) => (
          <span className='block text-right text-sm font-medium tabular-nums'>
            {amt(row.original.data?.total)}
          </span>
        ),
      },
      {
        id: 'due',
        accessorFn: (row) => row.data?.dueDate ?? '',
        header: ({ column }) => <SortableHeader column={column}>ครบกำหนด</SortableHeader>,
        cell: ({ row }) => {
          const due = row.original.data?.dueDate?.trim() || '—'
          const overdue = row.original._overdue
          if (overdue > 0) {
            return (
              <span className='text-sm tabular-nums text-destructive'>
                {due} <span className='ml-1 text-xs'>(เกิน {overdue} วัน)</span>
              </span>
            )
          }
          return <span className='text-sm tabular-nums'>{due}</span>
        },
      },
      {
        id: 'status',
        accessorFn: (row) => row._status,
        header: ({ column }) => <SortableHeader column={column}>สถานะ</SortableHeader>,
        cell: ({ row }) => <StatusBadge status={row.original._status} />,
        filterFn: (row, _id, value) => {
          if (!value || value === 'all') return true
          if (value === 'overdue') return row.original._overdue > 0
          return row.original._status === value
        },
      },
    ],
    [],
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _id, filterValue) => {
      const v = String(filterValue ?? '').toLowerCase().trim()
      if (!v) return true
      const d = row.original.data
      const haystack = [
        d?.invoiceNo,
        d?.tenant,
        d?.landlord,
        d?.property,
        d?.dueDate,
        d?.month,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(v)
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const monthFilter =
    (columnFilters.find((f) => f.id === 'month')?.value as string) ?? 'all'
  const setMonthFilter = (value: string) => {
    setColumnFilters((prev) => [
      ...prev.filter((f) => f.id !== 'month'),
      ...(value && value !== 'all' ? [{ id: 'month', value }] : []),
    ])
  }

  const statusFilter =
    (columnFilters.find((f) => f.id === 'status')?.value as string) ?? 'all'
  const setStatusFilter = (value: string) => {
    setColumnFilters((prev) => [
      ...prev.filter((f) => f.id !== 'status'),
      ...(value && value !== 'all' ? [{ id: 'status', value }] : []),
    ])
  }

  const totalRows = invoices?.length ?? 0
  const filteredRows = table.getRowModel().rows.length
  const [genOpen, setGenOpen] = useState(false)

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
            <h2 className='text-2xl font-bold tracking-tight'>ใบแจ้งหนี้</h2>
            <p className='text-muted-foreground text-sm'>
              {isLoading
                ? 'กำลังโหลด...'
                : `${filteredRows.toLocaleString('th-TH')} / ${totalRows.toLocaleString('th-TH')} ใบ`}
            </p>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <Button variant='outline' onClick={() => setGenOpen(true)}>
              <Sparkles className='size-4' />
              สร้างรายเดือน
            </Button>
            <Button asChild>
              <Link to='/invoices/new'>
                <Plus className='size-4' />
                ออกใบแจ้งหนี้
              </Link>
            </Button>
          </div>
        </div>

        <GenerateMonthlyDialog open={genOpen} onOpenChange={setGenOpen} />

        <div className='flex flex-wrap items-center gap-3'>
          <div className='relative max-w-sm flex-1'>
            <Search className='pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              placeholder='ค้น เลขที่ · ผู้เช่า · ทรัพย์สิน · เดือน...'
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className='pl-9'
            />
          </div>
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className='w-[160px]'>
              <SelectValue placeholder='ทุกเดือน' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>ทุกเดือน</SelectItem>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {formatMonth(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className='w-[160px]'>
              <SelectValue placeholder='ทุกสถานะ' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>ทุกสถานะ</SelectItem>
              <SelectItem value='overdue'>เกินกำหนด</SelectItem>
              {INVOICE_STATUSES.filter((s) => s.value !== 'unknown').map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
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
          <Table className='min-w-[900px]'>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className='hover:bg-transparent'>
                  {headerGroup.headers.map((header) => (
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
                Array.from({ length: 6 }).map((_, i) => (
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
                      <Receipt className='size-8' />
                      <p>
                        {totalRows === 0
                          ? 'ยังไม่มีใบแจ้งหนี้'
                          : 'ไม่พบใบแจ้งหนี้ที่ตรงกับเงื่อนไข'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn(
                      'cursor-pointer',
                      'hover:bg-muted/40',
                      row.original._overdue > 0 && 'bg-destructive/5',
                    )}
                    onClick={() =>
                      navigate({ to: '/invoices/$id', params: { id: row.original.id } })
                    }
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
      </Main>
    </>
  )
}
