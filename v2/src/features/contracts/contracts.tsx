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
import { Download, FileText, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useExportCSV } from '@/hooks/use-csv'
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
  getContractDisplay,
  getContractStatus,
  getStatusMeta,
  useContracts,
} from '@/features/contracts/queries'
import { amt } from '@/lib/thai'
import {
  CONTRACT_STATUSES,
  type Contract,
  type ContractStatus,
} from '@/features/contracts/types'
import { cn } from '@/lib/utils'

type Row = Contract & { _status: ContractStatus }

const STATUS_TONE_CLASS: Record<string, string> = {
  success: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300',
  warning: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300',
  info: 'bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-300',
  muted: 'bg-muted text-muted-foreground border-border',
  destructive: 'bg-destructive/10 text-destructive border-destructive/30',
}

function StatusBadge({ status }: { status: ContractStatus }) {
  const meta = getStatusMeta(status)
  return (
    <Badge
      variant='outline'
      className={cn('font-normal', STATUS_TONE_CLASS[meta.tone] ?? '')}
    >
      {meta.label}
    </Badge>
  )
}

export function Contracts() {
  const { data: contracts, isLoading, error } = useContracts()
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'end', desc: true },
  ])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const navigate = useNavigate()

  const rows = useMemo<Row[]>(() => {
    if (!contracts) return []
    return contracts.map((c) => ({ ...c, _status: getContractStatus(c.data) }))
  }, [contracts])

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        id: 'no',
        accessorFn: (row) => getContractDisplay(row),
        header: ({ column }) => (
          <SortableHeader column={column}>เลขที่สัญญา</SortableHeader>
        ),
        cell: ({ row }) => {
          const v = getContractDisplay(row.original)
          return (
            <span className='block max-w-[140px] truncate font-medium' title={v}>
              {v}
            </span>
          )
        },
      },
      {
        id: 'tenant',
        accessorFn: (row) => row.data?.tenant ?? '',
        header: ({ column }) => (
          <SortableHeader column={column}>ผู้เช่า</SortableHeader>
        ),
        cell: ({ row }) => {
          const v = row.original.data?.tenant?.trim() || '—'
          return (
            <span className='block max-w-[180px] truncate text-sm' title={v}>
              {v}
            </span>
          )
        },
      },
      {
        id: 'landlord',
        accessorFn: (row) => row.data?.landlord ?? '',
        header: ({ column }) => (
          <SortableHeader column={column}>ผู้ให้เช่า</SortableHeader>
        ),
        cell: ({ row }) => {
          const v = row.original.data?.landlord?.trim() || '—'
          return (
            <span className='block max-w-[180px] truncate text-sm' title={v}>
              {v}
            </span>
          )
        },
      },
      {
        id: 'start',
        accessorFn: (row) => row.data?.start ?? '',
        header: ({ column }) => (
          <SortableHeader column={column}>วันเริ่ม</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className='text-sm tabular-nums'>
            {row.original.data?.start?.trim() || '—'}
          </span>
        ),
      },
      {
        id: 'end',
        accessorFn: (row) => row.data?.end ?? '',
        header: ({ column }) => (
          <SortableHeader column={column}>วันสิ้นสุด</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className='text-sm tabular-nums'>
            {row.original.data?.end?.trim() || '—'}
          </span>
        ),
      },
      {
        id: 'rate',
        // v1 legacy data ships rate as messy string. amt() loose-parses it.
        accessorFn: (row) => {
          const formatted = amt(row.data?.rate as number | string | undefined, {
            symbol: false,
            decimal: 0,
            emDash: false,
          })
          return formatted ? Number(formatted.replace(/[,\s]/g, '')) : 0
        },
        header: ({ column }) => (
          <SortableHeader column={column}>ค่าเช่า</SortableHeader>
        ),
        cell: ({ row }) => {
          const formatted = amt(row.original.data?.rate as number | string | undefined, {
            symbol: false,
            decimal: 0,
          })
          if (formatted === '—') {
            return <span className='text-sm text-muted-foreground'>—</span>
          }
          const freq = row.original.data?.payment?.trim()
          return (
            <span className='text-sm tabular-nums'>
              {formatted}
              {freq ? <span className='ms-1 text-xs text-muted-foreground'>/ {freq}</span> : null}
            </span>
          )
        },
      },
      {
        id: 'status',
        accessorFn: (row) => row._status,
        header: ({ column }) => (
          <SortableHeader column={column}>สถานะ</SortableHeader>
        ),
        cell: ({ row }) => <StatusBadge status={row.original._status} />,
        filterFn: (row, _id, value) => {
          if (!value || value === 'all') return true
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
        d?.no,
        d?.tenant,
        d?.landlord,
        d?.start,
        d?.end,
        d?.taxId,
        d?.madeAt,
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

  const statusFilter =
    (columnFilters.find((f) => f.id === 'status')?.value as string) ?? 'all'
  const setStatusFilter = (value: string) => {
    setColumnFilters((prev) => [
      ...prev.filter((f) => f.id !== 'status'),
      ...(value && value !== 'all' ? [{ id: 'status', value }] : []),
    ])
  }

  const totalRows = contracts?.length ?? 0
  const filteredRows = table.getRowModel().rows.length
  const { exportXLSX } = useExportCSV()

  function handleExport() {
    const visible = table.getRowModel().rows.map((r) => {
      const c = r.original
      const d = c.data
      const meta = getStatusMeta(getContractStatus(d))
      return {
        เลขที่: getContractDisplay(c),
        ผู้เช่า: d?.tenant ?? '',
        ผู้ให้เช่า: d?.landlord ?? '',
        ทรัพย์สิน: String(d?.property ?? ''),
        เริ่ม: d?.start ?? '',
        สิ้นสุด: d?.end ?? '',
        ระยะ: d?.dur ?? '',
        ค่าเช่า: Number(d?.rate) || 0,
        มัดจำ: Number(d?.deposit) || 0,
        การชำระ: d?.payment ?? '',
        สถานะ: meta.label,
      }
    })
    const now = new Date()
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    exportXLSX(visible, `contracts-${stamp}.xlsx`, { sheetName: 'สัญญาเช่า' })
  }

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
            <h2 className='text-2xl font-bold tracking-tight'>สัญญาเช่า</h2>
            <p className='text-muted-foreground text-sm'>
              {isLoading
                ? 'กำลังโหลด...'
                : `${filteredRows.toLocaleString('th-TH')} / ${totalRows.toLocaleString('th-TH')} ใบ`}
            </p>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <Button
              variant='outline'
              onClick={handleExport}
              disabled={filteredRows === 0}
            >
              <Download className='size-4' />
              Export Excel
            </Button>
            <Button asChild>
              <Link to='/contracts/new'>
                <Plus className='size-4' />
                สร้างสัญญา
              </Link>
            </Button>
          </div>
        </div>

        <div className='flex flex-wrap items-center gap-3'>
          <div className='relative max-w-sm flex-1'>
            <Search className='pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              placeholder='ค้น เลขที่ · ผู้เช่า · ผู้ให้เช่า · วันที่...'
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className='pl-9'
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className='w-[180px]'>
              <SelectValue placeholder='ทุกสถานะ' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>ทุกสถานะ</SelectItem>
              {CONTRACT_STATUSES.map((s) => (
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
          <Table className='min-w-[800px]'>
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
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
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
                      <FileText className='size-8' />
                      <p>
                        {totalRows === 0
                          ? 'ยังไม่มีสัญญา'
                          : 'ไม่พบสัญญาที่ตรงกับเงื่อนไข'}
                      </p>
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
                        to: '/contracts/$id',
                        params: { id: row.original.id },
                      })
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className='py-3'>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
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
