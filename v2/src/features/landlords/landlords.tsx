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
import { Building2, Download, Landmark, Plus, Search, UserRound } from 'lucide-react'
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
  fmtTaxId,
  getLandlordName,
  useLandlords,
} from '@/features/landlords/queries'
import { PARTY_TYPES, type Landlord } from '@/features/landlords/types'
import { useBankAccounts } from '@/features/bank-accounts/queries'
import {
  type ContractMatchRow,
  useContractMatchKeys,
} from '@/lib/queries/contract-match'
import { cn } from '@/lib/utils'

const PARTY_LABEL: Record<string, string> = Object.fromEntries(
  PARTY_TYPES.map((p) => [p.value, p.label]),
)

/**
 * Derive contract count per landlord — matched by landlord_id / invHeaderId /
 * name fallback. Uses the shared lightweight match-keys query (cache shared
 * across landlords list, tenants list, and detail pages).
 */
function countContracts(
  landlord: Landlord,
  contracts: ContractMatchRow[],
): number {
  const headerId = (landlord.data.invoiceHeaderId ?? '').trim()
  const nm = (landlord.data.name ?? '').trim()
  return contracts.filter((c) => {
    if (c.data.landlord_id === landlord.id) return true
    if (headerId && c.data.invHeaderId === headerId) return true
    if (c.data.landlord === nm) return true
    return false
  }).length
}

export function Landlords() {
  const { data: landlords, isLoading, error } = useLandlords()
  const { data: contracts } = useContractMatchKeys()
  const { data: allBanks } = useBankAccounts()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const navigate = useNavigate()

  // Count banks per landlord (owner)
  const bankCountByOwner = useMemo(() => {
    const map = new Map<string, number>()
    if (!allBanks) return map
    allBanks.forEach((b) => {
      const owner = (b.data?.ownerLandlordId ?? '').trim()
      if (!owner) return
      map.set(owner, (map.get(owner) ?? 0) + 1)
    })
    return map
  }, [allBanks])

  const rows = useMemo(() => {
    if (!landlords) return []
    return landlords.map((l) => ({
      ...l,
      _contractCount: contracts ? countContracts(l, contracts) : 0,
      _bankCount: bankCountByOwner.get(l.id) ?? 0,
    }))
  }, [landlords, contracts, bankCountByOwner])

  const columns = useMemo<
    ColumnDef<Landlord & { _contractCount: number; _bankCount: number }>[]
  >(
    () => [
      {
        id: 'name',
        accessorFn: (row) => getLandlordName(row.data),
        header: ({ column }) => (
          <SortableHeader column={column}>ชื่อผู้ให้เช่า</SortableHeader>
        ),
        cell: ({ row }) => {
          const t = row.original.data
          const Icon = t.partyType === 'company' ? Building2 : UserRound
          const shortName = (t.shortName ?? '').trim()
          const fullName = (t.name ?? '').trim()
          const showSecondLine = shortName && shortName !== fullName
          return (
            <div className='flex items-start gap-2'>
              {t.logo ? (
                <img
                  src={t.logo}
                  alt='โลโก้'
                  className='mt-0.5 size-6 shrink-0 rounded-sm border object-contain'
                />
              ) : (
                <Icon className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
              )}
              <div className='flex min-w-0 flex-col'>
                <span
                  className='truncate font-medium'
                  title={fullName}
                >
                  {showSecondLine ? shortName : fullName || '(ไม่มีชื่อ)'}
                </span>
                {showSecondLine && (
                  <span
                    className='truncate text-xs text-muted-foreground'
                    title={fullName}
                  >
                    {fullName}
                  </span>
                )}
              </div>
            </div>
          )
        },
      },
      {
        id: 'partyType',
        accessorFn: (row) => row.data?.partyType ?? '',
        header: ({ column }) => (
          <SortableHeader column={column}>ประเภท</SortableHeader>
        ),
        cell: ({ row }) => (
          <Badge variant='secondary' className='font-normal'>
            {PARTY_LABEL[row.original.data?.partyType ?? ''] ?? '—'}
          </Badge>
        ),
        filterFn: (row, _id, value) => {
          if (!value || value === 'all') return true
          return row.original.data?.partyType === value
        },
      },
      {
        id: 'taxId',
        accessorFn: (row) => row.data?.taxId ?? '',
        header: ({ column }) => (
          <SortableHeader column={column}>เลขผู้เสียภาษี</SortableHeader>
        ),
        cell: ({ row }) => {
          const tax = row.original.data?.taxId ?? ''
          if (!tax) return <span className='text-sm text-muted-foreground'>—</span>
          return <span className='font-mono text-sm'>{fmtTaxId(tax)}</span>
        },
      },
      {
        id: 'banks',
        accessorFn: (row) => row._bankCount,
        header: ({ column }) => (
          <SortableHeader column={column}>บัญชี</SortableHeader>
        ),
        cell: ({ row }) => {
          const n = row.original._bankCount
          return (
            <Badge variant='outline' className='font-normal'>
              <Landmark className='mr-1 size-3' />
              {n.toLocaleString('th-TH')}
            </Badge>
          )
        },
      },
      {
        id: 'province',
        accessorFn: (row) => row.data?.addrProvince ?? '',
        header: ({ column }) => (
          <SortableHeader column={column}>จังหวัด</SortableHeader>
        ),
        cell: ({ row }) => {
          const v = row.original.data?.addrProvince?.trim() || '—'
          return (
            <span className='block max-w-[160px] truncate text-sm' title={v}>
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
              {n.toLocaleString('th-TH')} ใบ
            </Badge>
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
      const t = row.original.data
      const haystack = [
        t?.name,
        t?.shortName,
        t?.taxId,
        t?.phone,
        t?.addrProvince,
        t?.addrDistrict,
        t?.addrSubdistrict,
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

  const partyFilter =
    (columnFilters.find((f) => f.id === 'partyType')?.value as string) ?? 'all'
  const setPartyFilter = (value: string) => {
    setColumnFilters((prev) => [
      ...prev.filter((f) => f.id !== 'partyType'),
      ...(value && value !== 'all' ? [{ id: 'partyType', value }] : []),
    ])
  }

  const totalRows = landlords?.length ?? 0
  const filteredRows = table.getRowModel().rows.length
  const { exportXLSX } = useExportCSV()

  function handleExport() {
    const visible = table.getRowModel().rows.map((r) => {
      const d = r.original.data
      return {
        ชื่อ: d?.name ?? '',
        ชื่อย่อ: d?.shortName ?? '',
        ประเภท: d?.partyType === 'company' ? 'นิติบุคคล' : 'บุคคลธรรมดา',
        เลขผู้เสียภาษี: d?.taxId ?? '',
        เบอร์: d?.phone ?? '',
        VAT: d?.vatRegistered ? `${d?.vatRate ?? 7}%` : '-',
        ที่อยู่: [d?.addrLine, d?.addrSubdistrict, d?.addrDistrict, d?.addrProvince, d?.addrPostal]
          .filter(Boolean)
          .join(' '),
      }
    })
    const now = new Date()
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    exportXLSX(visible, `landlords-${stamp}.xlsx`, { sheetName: 'ผู้ให้เช่า' })
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
            <h2 className='text-2xl font-bold tracking-tight'>ผู้ให้เช่า</h2>
            <p className='text-muted-foreground text-sm'>
              {isLoading
                ? 'กำลังโหลด...'
                : `${filteredRows.toLocaleString('th-TH')} / ${totalRows.toLocaleString('th-TH')} ราย`}
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
              <Link to='/landlords/new'>
                <Plus className='size-4' />
                เพิ่มผู้ให้เช่า
              </Link>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className='flex flex-wrap items-center gap-3'>
          <div className='relative max-w-sm flex-1'>
            <Search className='pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              placeholder='ค้น ชื่อ · เลขผู้เสียภาษี · ธนาคาร · จังหวัด...'
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className='pl-9'
            />
          </div>
          <Select value={partyFilter} onValueChange={setPartyFilter}>
            <SelectTrigger className='w-[180px]'>
              <SelectValue placeholder='ทุกประเภท' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>ทุกประเภท</SelectItem>
              {PARTY_TYPES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
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
                      <Landmark className='size-8' />
                      <p>
                        {totalRows === 0
                          ? 'ยังไม่มีผู้ให้เช่า'
                          : 'ไม่พบผู้ให้เช่าที่ตรงกับเงื่อนไข'}
                      </p>
                      {totalRows === 0 && (
                        <Button asChild variant='link' className='h-auto p-0'>
                          <Link to='/landlords/new'>เพิ่มผู้ให้เช่ารายแรก</Link>
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
                        to: '/landlords/$id',
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
