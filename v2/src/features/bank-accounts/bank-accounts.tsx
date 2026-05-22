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
import { Landmark, Plus, Search } from 'lucide-react'
import { SortableHeader } from '@/components/yonghua/sortable-header'
import { useMemo, useState } from 'react'
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
import { useBankAccounts } from '@/features/bank-accounts/queries'
import type { BankAccount } from '@/features/bank-accounts/types'
import { cn } from '@/lib/utils'

export function BankAccounts() {
  const { data: rows, isLoading, error } = useBankAccounts()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const navigate = useNavigate()

  const owners = useMemo(() => {
    if (!rows) return [] as Array<{ id: string; name: string }>
    const map = new Map<string, string>()
    rows.forEach((r) => {
      const id = (r.data?.ownerLandlordId ?? '').trim()
      if (id && !map.has(id))
        map.set(id, r.data?.ownerLandlordName ?? '(ไม่มีชื่อ)')
    })
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'th'))
  }, [rows])

  const columns = useMemo<ColumnDef<BankAccount>[]>(
    () => [
      {
        id: 'bank',
        accessorFn: (row) => row.data?.bank ?? '',
        header: ({ column }) => (
          <SortableHeader column={column}>ธนาคาร</SortableHeader>
        ),
        cell: ({ row }) => {
          const b = row.original.data
          return (
            <div className='flex items-start gap-2'>
              <Landmark className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
              <div className='flex min-w-0 flex-col'>
                <span className='font-medium'>{b.bank || '—'}</span>
                {b.label && (
                  <Badge variant='outline' className='mt-1 w-fit font-normal'>
                    {b.label}
                  </Badge>
                )}
              </div>
            </div>
          )
        },
      },
      {
        id: 'branch',
        accessorFn: (row) => row.data?.branch ?? '',
        header: ({ column }) => (
          <SortableHeader column={column}>สาขา</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className='text-sm'>{row.original.data?.branch || '—'}</span>
        ),
      },
      {
        id: 'acctNo',
        accessorFn: (row) => row.data?.acctNo ?? '',
        header: ({ column }) => (
          <SortableHeader column={column}>เลขบัญชี</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className='font-mono text-sm'>
            {row.original.data?.acctNo || '—'}
          </span>
        ),
      },
      {
        id: 'accountName',
        accessorFn: (row) => row.data?.accountName ?? '',
        header: ({ column }) => (
          <SortableHeader column={column}>ชื่อบัญชี</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className='text-sm'>
            {row.original.data?.accountName || '—'}
          </span>
        ),
      },
      {
        id: 'owner',
        accessorFn: (row) => row.data?.ownerLandlordName ?? '',
        header: ({ column }) => (
          <SortableHeader column={column}>ผูกกับผู้ให้เช่า</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className='text-sm'>
            {row.original.data?.ownerLandlordName || '—'}
          </span>
        ),
        filterFn: (row, _id, value) => {
          if (!value || value === 'all') return true
          return row.original.data?.ownerLandlordId === value
        },
      },
      {
        id: 'active',
        accessorFn: (row) => (row.data?.active === false ? '0' : '1'),
        header: ({ column }) => (
          <SortableHeader column={column}>สถานะ</SortableHeader>
        ),
        cell: ({ row }) => {
          const active = row.original.data?.active !== false
          return (
            <Badge
              variant={active ? 'default' : 'outline'}
              className='font-normal'
            >
              {active ? 'เปิด' : 'ปิด'}
            </Badge>
          )
        },
      },
    ],
    [],
  )

  const table = useReactTable({
    data: rows ?? [],
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _id, filterValue) => {
      const v = String(filterValue ?? '')
        .toLowerCase()
        .trim()
      if (!v) return true
      const b = row.original.data
      const haystack = [
        b?.bank,
        b?.branch,
        b?.acctNo,
        b?.accountName,
        b?.label,
        b?.ownerLandlordName,
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

  const ownerFilter =
    (columnFilters.find((f) => f.id === 'owner')?.value as string) ?? 'all'
  const setOwnerFilter = (value: string) => {
    setColumnFilters((prev) => [
      ...prev.filter((f) => f.id !== 'owner'),
      ...(value && value !== 'all' ? [{ id: 'owner', value }] : []),
    ])
  }

  const totalRows = rows?.length ?? 0
  const filteredRows = table.getRowModel().rows.length

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
            <h2 className='text-2xl font-bold tracking-tight'>บัญชีธนาคาร</h2>
            <p className='text-muted-foreground text-sm'>
              {isLoading
                ? 'กำลังโหลด...'
                : `${filteredRows.toLocaleString('th-TH')} / ${totalRows.toLocaleString('th-TH')} บัญชี`}
            </p>
          </div>
          <Button asChild>
            <Link to='/bank-accounts/new'>
              <Plus className='size-4' />
              เพิ่มบัญชี
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <div className='flex flex-wrap items-center gap-3'>
          <div className='relative max-w-sm flex-1'>
            <Search className='pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              placeholder='ค้น ธนาคาร · เลขบัญชี · ชื่อบัญชี · เจ้าของ...'
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className='pl-9'
            />
          </div>
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className='w-[240px]'>
              <SelectValue placeholder='ทุกเจ้าของ' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>ทุกเจ้าของ</SelectItem>
              {owners.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
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

        <div className='rounded-md border bg-card'>
          <Table>
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
                      <Landmark className='size-8' />
                      <p>
                        {totalRows === 0
                          ? 'ยังไม่มีบัญชีธนาคาร'
                          : 'ไม่พบบัญชีที่ตรงกับเงื่อนไข'}
                      </p>
                      {totalRows === 0 && (
                        <Button asChild variant='link' className='h-auto p-0'>
                          <Link to='/bank-accounts/new'>เพิ่มบัญชีแรก</Link>
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
                        to: '/bank-accounts/$id',
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
