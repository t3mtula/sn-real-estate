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
import {
  Building2,
  Download,
  FileText,
  Image as ImageIcon,
  Plus,
  Search,
  Users,
} from 'lucide-react'
import { useExportCSV } from '@/hooks/use-csv'
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
import {
  getPropertyAddressShort,
  getPropertyImageCount,
  getPropertyName,
  getPropertyProvince,
  useProperties,
} from '@/features/properties/queries'
import { PROPERTY_TYPES, type Property } from '@/features/properties/types'
import { useContractMatchKeys } from '@/lib/queries/contract-match'
import { cn } from '@/lib/utils'

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  PROPERTY_TYPES.map((t) => [t.value, t.label])
)

function typeLabel(value: string | undefined): string {
  if (!value) return '—'
  return TYPE_LABEL[value] ?? value
}

type Row = Property & { _contractCount: number }

export function Properties() {
  const { data: properties, isLoading, error } = useProperties()
  const { data: contractKeys } = useContractMatchKeys()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const navigate = useNavigate()

  // Count active (non-cancelled) contracts per property — match by pid_property or legacy pid
  const contractCountByPid = useMemo(() => {
    const map = new Map<number, number>()
    if (!contractKeys) return map
    contractKeys.forEach((c) => {
      if (c.data?.cancelled) return
      const pid = c.data?.pid_property ?? c.data?.pid
      if (pid == null) return
      const n = Number(pid)
      if (Number.isNaN(n)) return
      map.set(n, (map.get(n) ?? 0) + 1)
    })
    return map
  }, [contractKeys])

  const rows = useMemo<Row[]>(() => {
    if (!properties) return []
    return properties.map((p) => {
      const pid = p.data?.pid ?? Number.parseInt(p.id, 10)
      return {
        ...p,
        _contractCount: contractCountByPid.get(Number(pid)) ?? 0,
      }
    })
  }, [properties, contractCountByPid])

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        id: 'name',
        accessorFn: (row) => getPropertyName(row.data),
        header: ({ column }) => (
          <SortableHeader column={column}>ชื่อทรัพย์สิน</SortableHeader>
        ),
        cell: ({ row }) => {
          const p = row.original.data
          const fullName = getPropertyName(p)
          const addr = getPropertyAddressShort(p)
          return (
            <div className='flex min-w-0 flex-col'>
              <span className='truncate font-medium' title={fullName}>
                {fullName}
              </span>
              <span
                className='truncate text-xs text-muted-foreground'
                title={addr}
              >
                {addr}
              </span>
            </div>
          )
        },
      },
      {
        id: 'type',
        accessorFn: (row) => row.data?.type ?? '',
        header: ({ column }) => (
          <SortableHeader column={column}>ประเภท</SortableHeader>
        ),
        cell: ({ row }) => (
          <Badge variant='secondary' className='font-normal'>
            {typeLabel(row.original.data?.type)}
          </Badge>
        ),
        filterFn: (row, _id, value) => {
          if (!value || value === 'all') return true
          return row.original.data?.type === value
        },
      },
      {
        id: 'province',
        accessorFn: (row) => getPropertyProvince(row.data),
        header: ({ column }) => (
          <SortableHeader column={column}>จังหวัด</SortableHeader>
        ),
        cell: ({ row }) => {
          const v = getPropertyProvince(row.original.data)
          return (
            <span className='block max-w-[160px] truncate text-sm' title={v}>
              {v}
            </span>
          )
        },
      },
      {
        id: 'area',
        accessorFn: (row) => row.data?.area ?? '',
        header: ({ column }) => (
          <SortableHeader column={column}>เนื้อที่</SortableHeader>
        ),
        cell: ({ row }) => {
          const v = row.original.data?.area?.trim() || '—'
          return (
            <span
              className='block max-w-[180px] truncate text-sm text-muted-foreground'
              title={v}
            >
              {v}
            </span>
          )
        },
      },
      {
        id: 'contracts',
        accessorFn: (row) => row._contractCount,
        header: ({ column }) => (
          <SortableHeader column={column}>สัญญา</SortableHeader>
        ),
        cell: ({ row }) => {
          const n = row.original._contractCount
          return (
            <Badge
              variant={n > 0 ? 'default' : 'outline'}
              className='font-normal'
            >
              <FileText className='mr-1 size-3' />
              {n.toLocaleString('th-TH')}
            </Badge>
          )
        },
      },
      {
        id: 'extras',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const p = row.original.data
          const imgCount = getPropertyImageCount(p)
          return (
            <div className='flex items-center gap-2 text-xs text-muted-foreground'>
              {p?.multiTenant && (
                <span
                  className='inline-flex items-center gap-1 rounded-md bg-accent/15 px-1.5 py-0.5 text-accent'
                  title='หลายผู้เช่าได้พร้อมกัน'
                >
                  <Users className='size-3' />
                  หลายผู้เช่า
                </span>
              )}
              {imgCount > 0 && (
                <span className='inline-flex items-center gap-1'>
                  <ImageIcon className='size-3' />
                  {imgCount}
                </span>
              )}
            </div>
          )
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
      const v = String(filterValue ?? '')
        .toLowerCase()
        .trim()
      if (!v) return true
      const p = row.original.data
      const haystack = [
        p?.name,
        p?.location,
        p?.address,
        p?.titleDeed,
        p?.area,
        p?.owner,
        p?.province,
        p?.addr_province,
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

  const typeFilter =
    (columnFilters.find((f) => f.id === 'type')?.value as string) ?? 'all'
  const setTypeFilter = (value: string) => {
    setColumnFilters((prev) => [
      ...prev.filter((f) => f.id !== 'type'),
      ...(value && value !== 'all' ? [{ id: 'type', value }] : []),
    ])
  }

  const totalRows = properties?.length ?? 0
  const filteredRows = table.getRowModel().rows.length
  const { exportXLSX } = useExportCSV()

  function handleExport() {
    const visible = table.getRowModel().rows.map((r) => {
      const d = r.original.data
      return {
        ชื่อ: d?.name ?? '',
        ประเภท: d?.type ?? '',
        จังหวัด: d?.province ?? d?.addr_province ?? '',
        ที่อยู่:
          d?.address ??
          [d?.addr_line, d?.addr_subdistrict, d?.addr_district, d?.addr_province, d?.addr_postal]
            .filter(Boolean)
            .join(' '),
        ขนาด: d?.area ?? '',
        เจ้าของ: d?.owner ?? '',
        โฉนด: d?.titleDeed ?? '',
      }
    })
    const now = new Date()
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    exportXLSX(visible, `properties-${stamp}.xlsx`, { sheetName: 'ทรัพย์สิน' })
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
            <h2 className='text-2xl font-bold tracking-tight'>ทรัพย์สิน</h2>
            <p className='text-muted-foreground text-sm'>
              {isLoading
                ? 'กำลังโหลด...'
                : `${filteredRows.toLocaleString('th-TH')} / ${totalRows.toLocaleString('th-TH')} รายการ`}
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
              <Link to='/properties/new'>
                <Plus className='size-4' />
                เพิ่มทรัพย์สิน
              </Link>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className='flex flex-wrap items-center gap-3'>
          <div className='relative max-w-sm flex-1'>
            <Search className='pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              placeholder='ค้นหา ชื่อ · ที่อยู่ · เจ้าของ · จังหวัด...'
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className='pl-9'
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className='w-[220px]'>
              <SelectValue placeholder='ทุกประเภท' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>ทุกประเภท</SelectItem>
              {PROPERTY_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Error */}
        {error && (
          <div className='rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive'>
            ดึงข้อมูลไม่สำเร็จ —{' '}
            {error instanceof Error ? error.message : String(error)}
          </div>
        )}

        {/* Table */}
        <div className='overflow-x-auto rounded-md border bg-card'>
          <Table className='min-w-[820px]'>
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
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
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
                      <Building2 className='size-8' />
                      <p>
                        {totalRows === 0
                          ? 'ยังไม่มีทรัพย์สิน'
                          : 'ไม่พบทรัพย์สินที่ตรงกับเงื่อนไข'}
                      </p>
                      {totalRows === 0 && (
                        <Button asChild variant='link' className='h-auto p-0'>
                          <Link to='/properties/new'>เพิ่มทรัพย์สินรายการแรก</Link>
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
                        to: '/properties/$id',
                        params: { id: row.original.id },
                      })
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className='py-3'>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
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
