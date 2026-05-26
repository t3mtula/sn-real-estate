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
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import {
  Building2,
  Download,
  FileText,
  Image as ImageIcon,
  MapPin,
  Plus,
  Ruler,
  Search,
  StickyNote,
  User,
  Users,
  X,
} from 'lucide-react'
import { useExportXlsx, xlsxFilename } from '@/hooks/use-xlsx'
import { useRowHover } from '@/hooks/use-row-hover'
import { CursorPopover } from '@/components/cursor-popover'
import { SortableHeader } from '@/components/yonghua/sortable-header'
import { DaysRemainingChip } from '@/components/yonghua/days-remaining-chip'
import { OverdueBadge } from '@/components/yonghua/overdue-badge'
import { SEVERITY_STRIP } from '@/components/yonghua/severity'
import { useEffect, useMemo, useState } from 'react'
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
import {
  type ContractMatchRow,
  useContractMatchKeys,
} from '@/lib/queries/contract-match'
import {
  daysUntil,
  freqShortLabel,
  monthlyRevenue,
  severityByDaysRemaining,
  type Severity,
} from '@/lib/contracts/stats'
import { useInvoiceStatsByContract } from '@/lib/queries/invoice-stats'
import { ContractMiniRow } from '@/components/yonghua/contract-mini-row'
import { amt } from '@/lib/thai'
import { cn } from '@/lib/utils'

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  PROPERTY_TYPES.map((t) => [t.value, t.label])
)

function typeLabel(value: string | undefined): string {
  if (!value) return '—'
  return TYPE_LABEL[value] ?? value
}

type RelatedContract = {
  contract: ContractMatchRow
  overdueAmount: number
  overdueCount: number
}

type Row = Property & {
  _contractCount: number
  _currentTenant: string | null
  _activeContract: ContractMatchRow | null
  _relatedContracts: RelatedContract[]
  _monthlyRent: number
  _overdueAmount: number
  _overdueCount: number
  _severity: Severity
}

export function Properties() {
  const { data: properties, isLoading, error } = useProperties()
  const { data: contractKeys } = useContractMatchKeys()
  const { data: invoiceStats } = useInvoiceStatsByContract()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const navigate = useNavigate()
  const { hover, onEnter, onMove, onLeave } = useRowHover<Row>()
  const search = useSearch({ from: '/_authenticated/properties/' }) as {
    province?: string
  }

  // Sync province URL param → column filter (on URL change)
  useEffect(() => {
    const provinceParam = search.province?.trim() ?? ''
    setColumnFilters((prev) => {
      const others = prev.filter((f) => f.id !== 'province')
      return provinceParam
        ? [...others, { id: 'province', value: provinceParam }]
        : others
    })
  }, [search.province])

  // Group non-cancelled contracts by property pid — used for count + current
  // tenant + active contract (rate/timeline/overdue).
  // "Active" = first non-cancelled · not yet expired (or fallback to first if all expired).
  const contractsByPid = useMemo(() => {
    const map = new Map<number, ContractMatchRow[]>()
    if (!contractKeys) return map
    contractKeys.forEach((c) => {
      if (c.data?.cancelled) return
      const pid = c.data?.pid_property ?? c.data?.pid
      if (pid == null) return
      const n = Number(pid)
      if (Number.isNaN(n)) return
      const arr = map.get(n) ?? []
      arr.push(c)
      map.set(n, arr)
    })
    return map
  }, [contractKeys])

  const rows = useMemo<Row[]>(() => {
    if (!properties) return []
    return properties.map((p) => {
      const pid = p.data?.pid ?? Number.parseInt(p.id, 10)
      const n = Number(pid)
      const list = contractsByPid.get(n) ?? []
      // Pick the "active" contract: prefer the one with latest non-expired end · fallback first
      const now = Date.now()
      const active =
        list.find((c) => {
          const days = daysUntil(c.data?.end ?? null)
          return days != null && days >= 0
        }) ??
        list[0] ??
        null
      const monthlyRent = active
        ? monthlyRevenue(active.data?.rate ?? null, active.data ?? {})
        : 0
      const stat = active ? invoiceStats?.get(active.id) : undefined
      const days = active ? daysUntil(active.data?.end ?? null) : null
      const startDays = active ? daysUntil(active.data?.start ?? null) : null
      const started = startDays == null || startDays <= 0
      const severity: Severity = active
        ? severityByDaysRemaining(days, {
            started,
            cancelled: !!active.data?.cancelled,
            closed: !!active.data?.closed,
          })
        : 'muted'
      // ignore unused now (kept for cache invalidation reactivity)
      void now
      const related: RelatedContract[] = list.map((c) => {
        const s = invoiceStats?.get(c.id)
        return {
          contract: c,
          overdueAmount: s?.overdueAmount ?? 0,
          overdueCount: s?.overdueCount ?? 0,
        }
      })
      return {
        ...p,
        _contractCount: list.length,
        _currentTenant: active?.data?.tenant ?? null,
        _activeContract: active,
        _relatedContracts: related,
        _monthlyRent: monthlyRent,
        _overdueAmount: stat?.overdueAmount ?? 0,
        _overdueCount: stat?.overdueCount ?? 0,
        _severity: severity,
      }
    })
  }, [properties, contractsByPid, invoiceStats])

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
        filterFn: (row, _id, value) => {
          if (!value) return true
          const v = String(value).trim().toLowerCase()
          if (!v) return true
          const p = row.original.data
          const fields = [p?.province, p?.addr_province]
            .filter(Boolean)
            .map((s) => String(s).toLowerCase())
          return fields.some((f) => f.includes(v))
        },
      },
      {
        id: 'rental',
        accessorFn: (row) => row._monthlyRent,
        header: ({ column }) => (
          <SortableHeader column={column}>การเช่า</SortableHeader>
        ),
        cell: ({ row }) => {
          const r = row.original
          const tenant = r._currentTenant
          const active = r._activeContract
          if (!tenant || !active) {
            return (
              <Badge variant='outline' className='font-normal text-muted-foreground'>
                ว่าง
              </Badge>
            )
          }
          const rentText = r._monthlyRent > 0
            ? amt(r._monthlyRent, { symbol: false, decimal: 0 })
            : amt(active.data?.rate ?? null, { symbol: false, decimal: 0 })
          const freq = freqShortLabel(active.data ?? {})
          const extraCount = r._contractCount - 1
          return (
            <div className='flex min-w-[200px] max-w-[260px] flex-col gap-1'>
              <div className='flex items-center gap-1.5'>
                <User className='size-3 shrink-0 text-emerald-600 dark:text-emerald-400' />
                <span
                  className='truncate text-sm font-medium'
                  title={tenant}
                >
                  {tenant}
                </span>
                {extraCount > 0 && (
                  <span className='shrink-0 text-[10px] text-muted-foreground'>
                    +{extraCount}
                  </span>
                )}
              </div>
              <div className='flex flex-wrap items-center gap-1.5'>
                <span className='text-xs font-semibold tabular-nums'>
                  {rentText}
                  <span className='ms-0.5 text-[10px] font-normal text-muted-foreground'>
                    /ด.
                  </span>
                </span>
                {freq && freq !== 'รายเดือน' && (
                  <span className='rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground'>
                    {freq}
                  </span>
                )}
                <DaysRemainingChip
                  end={active.data?.end ?? null}
                  start={active.data?.start ?? null}
                  cancelled={!!active.data?.cancelled}
                  closed={!!active.data?.closed}
                />
              </div>
              {r._overdueCount > 0 && (
                <OverdueBadge
                  count={r._overdueCount}
                  amount={r._overdueAmount}
                  unit='ใบ'
                />
              )}
            </div>
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

  const provinceFilter =
    (columnFilters.find((f) => f.id === 'province')?.value as string) ?? ''
  const clearProvinceFilter = () => {
    navigate({
      to: '/properties',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      search: {} as any,
      replace: true,
    })
  }

  const totalRows = properties?.length ?? 0
  const filteredRows = table.getRowModel().rows.length

  /** v1-style running KPI · count + occupancy + revenue + overdue */
  const kpi = useMemo(() => {
    const visible = table.getRowModel().rows.map((r) => r.original)
    let withContract = 0
    let vacant = 0
    let monthlyRev = 0
    let overdueAmount = 0
    let overdueCount = 0
    for (const p of visible) {
      if (p._contractCount > 0) withContract++
      else vacant++
      monthlyRev += p._monthlyRent
      overdueAmount += p._overdueAmount
      overdueCount += p._overdueCount
    }
    const occupancy = visible.length > 0 ? Math.round((withContract / visible.length) * 100) : 0
    return {
      count: visible.length,
      withContract,
      vacant,
      occupancy,
      monthlyRev,
      overdueAmount,
      overdueCount,
    }
  }, [table.getRowModel().rows])
  const exportXlsx = useExportXlsx()

  function handleExport() {
    const visible = table.getRowModel().rows.map((r) => {
      const d = r.original.data
      return {
        name: d?.name ?? '',
        type: d?.type ?? '',
        province: d?.province ?? d?.addr_province ?? '',
        address:
          d?.address ??
          [d?.addr_line, d?.addr_subdistrict, d?.addr_district, d?.addr_province, d?.addr_postal]
            .filter(Boolean)
            .join(' '),
        area: d?.area ?? '',
        owner: d?.owner ?? '',
        titleDeed: d?.titleDeed ?? '',
      }
    })
    void exportXlsx(
      xlsxFilename('ทรัพย์สิน'),
      [
        { header: 'ชื่อ', key: 'name', width: 28 },
        { header: 'ประเภท', key: 'type', width: 14 },
        { header: 'จังหวัด', key: 'province', width: 14 },
        { header: 'ที่อยู่', key: 'address', width: 40 },
        { header: 'ขนาด', key: 'area', width: 12 },
        { header: 'เจ้าของ', key: 'owner', width: 24 },
        { header: 'โฉนด', key: 'titleDeed', width: 16 },
      ],
      visible,
      { sheetName: 'ทรัพย์สิน' },
    )
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
          {provinceFilter && (
            <Badge
              variant='outline'
              className='gap-1 border-primary/30 bg-primary/10 py-1 pl-2.5 pr-1 text-primary'
            >
              จังหวัด: {provinceFilter}
              <button
                type='button'
                onClick={clearProvinceFilter}
                className='ml-0.5 inline-flex size-4 items-center justify-center rounded-full hover:bg-primary/20'
                aria-label='ล้างตัวกรองจังหวัด'
              >
                <X className='size-3' />
              </button>
            </Badge>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className='rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive'>
            ดึงข้อมูลไม่สำเร็จ —{' '}
            {error instanceof Error ? error.message : String(error)}
          </div>
        )}

        {/* KPI strip · v1-style running totals */}
        {!isLoading && kpi.count > 0 && (
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-5'>
            <KpiCard
              label='ทั้งหมด'
              value={kpi.count.toLocaleString('th-TH')}
              sub='ทรัพย์สิน'
              tone='neutral'
            />
            <KpiCard
              label='มีผู้เช่า'
              value={kpi.withContract.toLocaleString('th-TH')}
              sub={`${kpi.occupancy}% อัตราการเช่า`}
              tone='success'
            />
            <KpiCard
              label='ว่าง'
              value={kpi.vacant.toLocaleString('th-TH')}
              sub='ห้อง / แปลง'
              tone='warning'
            />
            <KpiCard
              label='รายได้/เดือน'
              value={amt(kpi.monthlyRev, { symbol: false, decimal: 0 })}
              sub='บาท · ประมาณการ'
              tone='neutral'
            />
            <KpiCard
              label='ค้างเก็บ'
              value={amt(kpi.overdueAmount, { symbol: false, decimal: 0 })}
              sub={`${kpi.overdueCount.toLocaleString('th-TH')} ใบ`}
              tone={kpi.overdueAmount > 0 ? 'destructive' : 'neutral'}
            />
          </div>
        )}

        {/* Table */}
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
                    className={cn(
                      'cursor-pointer hover:bg-muted/40',
                      SEVERITY_STRIP[row.original._severity],
                    )}
                    onClick={() =>
                      navigate({
                        to: '/properties/$id',
                        params: { id: row.original.id },
                      })
                    }
                    onMouseEnter={onEnter(row.original)}
                    onMouseMove={onMove(row.original)}
                    onMouseLeave={onLeave}
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

      <CursorPopover open={!!hover} x={hover?.x ?? 0} y={hover?.y ?? 0}>
        {hover && <PropertyHoverDetail row={hover.row} />}
      </CursorPopover>
    </>
  )
}

function PropertyHoverDetail({ row }: { row: Row }) {
  const d = row.data ?? {}
  const dr = d as Record<string, unknown>
  // Mini-preview of the detail page — saves a click.
  // Sections: header → metrics → full address + ownership → contracts list → notes.
  const addrParts = [
    dr.addr_line,
    dr.addr_subdistrict ? `ต.${dr.addr_subdistrict}` : '',
    dr.addr_district ? `อ.${dr.addr_district}` : '',
    dr.addr_province ? `จ.${dr.addr_province}` : '',
    dr.addr_postal,
  ]
    .filter(Boolean)
    .map(String)
    .join(' ')
    .trim()
  const note = (d as { notes?: string }).notes
  const imgCount = getPropertyImageCount(row.data)
  const visibleContracts = row._relatedContracts.slice(0, 4)
  const moreCount = row._relatedContracts.length - visibleContracts.length
  return (
    <div className='space-y-2.5 text-xs'>
      {/* Header */}
      <div className='flex items-center gap-2 border-b pb-2'>
        <Building2 className='size-4 text-muted-foreground' />
        <span className='truncate font-semibold'>{getPropertyName(row.data)}</span>
        <Badge variant='outline' className='ml-auto shrink-0 text-[10px] font-normal'>
          {typeLabel(d.type)}
        </Badge>
      </div>

      {/* Metrics row */}
      <div className='grid grid-cols-3 gap-2 rounded border bg-muted/20 px-2 py-1.5'>
        <div>
          <p className='text-[9px] uppercase text-muted-foreground'>สัญญา</p>
          <p className='text-sm font-semibold tabular-nums'>
            {row._contractCount}
          </p>
        </div>
        <div>
          <p className='text-[9px] uppercase text-muted-foreground'>รายได้/ด.</p>
          <p className='text-sm font-semibold tabular-nums'>
            {amt(row._monthlyRent, { symbol: false, decimal: 0 })}
          </p>
        </div>
        <div>
          <p className='text-[9px] uppercase text-muted-foreground'>ค้างเก็บ</p>
          <p className={cn(
            'text-sm font-semibold tabular-nums',
            row._overdueAmount > 0 ? 'text-red-700 dark:text-red-400' : '',
          )}>
            {amt(row._overdueAmount, { symbol: false, decimal: 0 })}
          </p>
        </div>
      </div>

      {/* Address + meta */}
      <div className='space-y-1'>
        {addrParts && (
          <p className='flex items-start gap-1.5 leading-snug'>
            <MapPin className='mt-0.5 size-3 shrink-0 text-muted-foreground' />
            <span>{addrParts}</span>
          </p>
        )}
        <div className='flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground'>
          {d.area && (
            <span className='inline-flex items-center gap-1'>
              <Ruler className='size-2.5' /> {String(d.area)}
            </span>
          )}
          {d.titleDeed && (
            <span className='inline-flex items-center gap-1'>
              <FileText className='size-2.5' /> โฉนด {String(d.titleDeed)}
            </span>
          )}
          {dr.owner ? (
            <span className='inline-flex items-center gap-1'>
              <User className='size-2.5' /> เจ้าของ: {String(dr.owner)}
            </span>
          ) : null}
          {d.multiTenant && (
            <span className='inline-flex items-center gap-1 text-accent'>
              <Users className='size-2.5' /> หลายผู้เช่า
            </span>
          )}
          {imgCount > 0 && (
            <span className='inline-flex items-center gap-1'>
              <ImageIcon className='size-2.5' /> {imgCount} รูป
            </span>
          )}
        </div>
      </div>

      {/* Contracts list */}
      {visibleContracts.length > 0 && (
        <div className='space-y-1.5'>
          <p className='text-[10px] uppercase tracking-wider text-muted-foreground'>
            สัญญาที่ทรัพย์นี้
          </p>
          <div className='space-y-1'>
            {visibleContracts.map((rc) => (
              <ContractMiniRow
                key={rc.contract.id}
                contract={rc.contract}
                titleField='tenant'
                overdueAmount={rc.overdueAmount}
                overdueCount={rc.overdueCount}
              />
            ))}
            {moreCount > 0 && (
              <p className='text-[10px] text-muted-foreground'>
                + อีก {moreCount} สัญญา
              </p>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {note && (
        <div className='flex items-start gap-2 border-t pt-1.5'>
          <StickyNote className='mt-0.5 size-3.5 shrink-0 text-muted-foreground' />
          <p className='leading-snug whitespace-pre-wrap'>{String(note)}</p>
        </div>
      )}
    </div>
  )
}

const KPI_TONE: Record<string, { card: string; value: string }> = {
  neutral: { card: 'border-border', value: 'text-foreground' },
  success: { card: 'border-emerald-500/30 bg-emerald-500/5', value: 'text-emerald-700 dark:text-emerald-400' },
  warning: { card: 'border-amber-500/30 bg-amber-500/5', value: 'text-amber-700 dark:text-amber-400' },
  destructive: { card: 'border-red-500/30 bg-red-500/5', value: 'text-red-700 dark:text-red-400' },
}

function KpiCard({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string
  value: string
  sub?: string
  tone?: 'neutral' | 'success' | 'warning' | 'destructive'
}) {
  const t = KPI_TONE[tone] ?? KPI_TONE.neutral
  return (
    <div className={cn('rounded-md border bg-card px-3 py-2', t.card)}>
      <p className='text-[10px] uppercase tracking-wider text-muted-foreground'>
        {label}
      </p>
      <p className={cn('mt-0.5 text-xl font-bold tabular-nums leading-tight', t.value)}>
        {value}
      </p>
      {sub && <p className='text-[10px] text-muted-foreground'>{sub}</p>}
    </div>
  )
}
