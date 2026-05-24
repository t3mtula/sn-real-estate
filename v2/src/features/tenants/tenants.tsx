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
import { Building2, Clock, Download, FileText, MapPin, Plus, Search, StickyNote, UserRound, Users } from 'lucide-react'
import { useExportXlsx, xlsxFilename } from '@/hooks/use-xlsx'
import { useRowHover } from '@/hooks/use-row-hover'
import { CursorPopover } from '@/components/cursor-popover'
import { SortableHeader } from '@/components/yonghua/sortable-header'
import { DaysRemainingChip } from '@/components/yonghua/days-remaining-chip'
import { OverdueBadge } from '@/components/yonghua/overdue-badge'
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
  getTenantName,
  useTenants,
} from '@/features/tenants/queries'
import { PARTY_TYPES, type Tenant } from '@/features/tenants/types'
import {
  type ContractMatchRow,
  useContractMatchKeys,
} from '@/lib/queries/contract-match'
import {
  daysUntil,
  monthlyRevenue,
} from '@/lib/contracts/stats'
import { parseBE } from '@/lib/thai'
import { useInvoiceStatsByContract } from '@/lib/queries/invoice-stats'
import { ContractMiniRow } from '@/components/yonghua/contract-mini-row'
import { amt } from '@/lib/thai'
import { cn } from '@/lib/utils'

const PARTY_LABEL: Record<string, string> = Object.fromEntries(
  PARTY_TYPES.map((p) => [p.value, p.label]),
)

/**
 * Resolve all contracts for a tenant — matched by tenant_id / taxId / name.
 */
function tenantContracts(
  tenant: Tenant,
  contracts: ContractMatchRow[],
): ContractMatchRow[] {
  // Filter cancelled — semantics match landlords/properties: _contractCount
  // means "non-cancelled contracts ever attached", _activeCount carries the
  // "non-expired" subset for KPI display.
  const tax = (tenant.data.taxId ?? '').trim()
  const nm = (tenant.data.name ?? '').trim()
  return contracts.filter((c) => {
    if (c.data.cancelled) return false
    if (c.data.tenant_id === tenant.id) return true
    if (tax && c.data.taxId === tax) return true
    if (!tax && c.data.tenant === nm) return true
    return false
  })
}

type RelatedContract = {
  contract: ContractMatchRow
  overdueAmount: number
  overdueCount: number
}

type TenantRow = Tenant & {
  _contractCount: number
  _activeCount: number
  _expiringCount: number
  _activeContract: ContractMatchRow | null
  _relatedContracts: RelatedContract[]
  _monthlyExposure: number
  _overdueAmount: number
  _overdueCount: number
}

export function Tenants() {
  const { data: tenants, isLoading, error } = useTenants()
  const { data: contracts } = useContractMatchKeys()
  const { data: invoiceStats } = useInvoiceStatsByContract()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const navigate = useNavigate()
  const { hover, onEnter, onMove, onLeave } = useRowHover<TenantRow>()

  const rows = useMemo<TenantRow[]>(() => {
    if (!tenants) return []
    return tenants.map((t) => {
      const list = contracts ? tenantContracts(t, contracts) : []
      let active = 0
      let expiring = 0
      let exposure = 0
      let overdueAmount = 0
      let overdueCount = 0
      let activeContract: ContractMatchRow | null = null
      for (const c of list) {
        if (c.data?.cancelled || c.data?.closed) continue
        const days = daysUntil(c.data?.end ?? null)
        if (days == null || days < 0) continue // skip expired
        active++
        if (days <= 90) expiring++
        if (!activeContract) activeContract = c
        exposure += monthlyRevenue(c.data?.rate ?? null, c.data ?? {})
        const stat = invoiceStats?.get(c.id)
        if (stat) {
          overdueAmount += stat.overdueAmount
          overdueCount += stat.overdueCount
        }
      }
      const related: RelatedContract[] = list.map((c) => {
        const s = invoiceStats?.get(c.id)
        return {
          contract: c,
          overdueAmount: s?.overdueAmount ?? 0,
          overdueCount: s?.overdueCount ?? 0,
        }
      })
      return {
        ...t,
        _contractCount: list.length,
        _activeCount: active,
        _expiringCount: expiring,
        _activeContract: activeContract,
        _relatedContracts: related,
        _monthlyExposure: exposure,
        _overdueAmount: overdueAmount,
        _overdueCount: overdueCount,
      }
    })
  }, [tenants, contracts, invoiceStats])

  const columns = useMemo<ColumnDef<TenantRow>[]>(
    () => [
      {
        id: 'name',
        accessorFn: (row) => getTenantName(row.data),
        header: ({ column }) => (
          <SortableHeader column={column}>ชื่อผู้เช่า</SortableHeader>
        ),
        cell: ({ row }) => {
          const t = row.original.data
          const Icon = t.partyType === 'company' ? Building2 : UserRound
          const name = getTenantName(t)
          return (
            <div className='flex items-start gap-2'>
              <Icon className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
              <div className='flex min-w-0 flex-col'>
                <span className='truncate font-medium' title={name}>
                  {name}
                </span>
                {t.phone && (
                  <span className='truncate text-xs text-muted-foreground'>
                    📞 {t.phone}
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
        id: 'rental',
        accessorFn: (row) => row._monthlyExposure,
        header: ({ column }) => (
          <SortableHeader column={column}>การเช่า</SortableHeader>
        ),
        cell: ({ row }) => {
          const r = row.original
          if (r._activeCount === 0) {
            const inactive = r._contractCount
            return (
              <Badge variant='outline' className='font-normal text-muted-foreground'>
                {inactive > 0 ? `ไม่มีสัญญาใช้งาน (${inactive} เก่า)` : 'ไม่มีสัญญา'}
              </Badge>
            )
          }
          const property = String(r._activeContract?.data?.property ?? '').trim()
          return (
            <div className='flex min-w-[200px] max-w-[260px] flex-col gap-1'>
              {property && (
                <div className='flex items-center gap-1.5'>
                  <Building2 className='size-3 shrink-0 text-muted-foreground' />
                  <span
                    className='truncate text-sm'
                    title={property}
                  >
                    {property}
                  </span>
                  {r._activeCount > 1 && (
                    <span className='shrink-0 text-[10px] text-muted-foreground'>
                      +{r._activeCount - 1}
                    </span>
                  )}
                </div>
              )}
              <div className='flex flex-wrap items-center gap-1.5'>
                <span className='text-xs font-semibold tabular-nums'>
                  {amt(r._monthlyExposure, { symbol: false, decimal: 0 })}
                  <span className='ms-0.5 text-[10px] font-normal text-muted-foreground'>
                    /ด.รวม
                  </span>
                </span>
                {r._activeContract && (
                  <DaysRemainingChip
                    end={r._activeContract.data?.end ?? null}
                    start={r._activeContract.data?.start ?? null}
                    cancelled={!!r._activeContract.data?.cancelled}
                    closed={!!r._activeContract.data?.closed}
                  />
                )}
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

  const totalRows = tenants?.length ?? 0
  const filteredRows = table.getRowModel().rows.length

  /** v1-style KPI · count + party-type + active exposure + overdue */
  const kpi = useMemo(() => {
    const visible = table.getRowModel().rows.map((r) => r.original)
    let person = 0
    let company = 0
    let activeContracts = 0
    let exposure = 0
    let overdueAmount = 0
    let overdueCount = 0
    let expiringCount = 0
    for (const t of visible) {
      if (t.data?.partyType === 'company') company++
      else person++
      activeContracts += t._activeCount
      exposure += t._monthlyExposure
      overdueAmount += t._overdueAmount
      overdueCount += t._overdueCount
      expiringCount += t._expiringCount
    }
    return {
      count: visible.length,
      person,
      company,
      activeContracts,
      exposure,
      overdueAmount,
      overdueCount,
      expiringCount,
    }
  }, [table.getRowModel().rows])
  const exportXlsx = useExportXlsx()

  function handleExport() {
    const visible = table.getRowModel().rows.map((r) => {
      const d = r.original.data
      return {
        name: d?.name ?? '',
        partyType: d?.partyType === 'company' ? 'นิติบุคคล' : 'บุคคลธรรมดา',
        taxId: d?.taxId ?? '',
        branch: d?.branch ?? '',
        phone: d?.phone ?? '',
        signerName: d?.signerName ?? '',
        address: [d?.addrLine, d?.addrSubdistrict, d?.addrDistrict, d?.addrProvince, d?.addrPostal]
          .filter(Boolean)
          .join(' '),
      }
    })
    void exportXlsx(
      xlsxFilename('ผู้เช่า'),
      [
        { header: 'ชื่อ', key: 'name', width: 28 },
        { header: 'ประเภท', key: 'partyType', width: 14 },
        { header: 'เลขผู้เสียภาษี', key: 'taxId', width: 18 },
        { header: 'สาขา', key: 'branch', width: 12 },
        { header: 'เบอร์', key: 'phone', width: 14 },
        { header: 'ผู้ลงนาม', key: 'signerName', width: 24 },
        { header: 'ที่อยู่', key: 'address', width: 40 },
      ],
      visible,
      { sheetName: 'ผู้เช่า' },
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
            <h2 className='text-2xl font-bold tracking-tight'>ผู้เช่า</h2>
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
              <Link to='/tenants/new'>
                <Plus className='size-4' />
                เพิ่มผู้เช่า
              </Link>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className='flex flex-wrap items-center gap-3'>
          <div className='relative max-w-sm flex-1'>
            <Search className='pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              placeholder='ค้น ชื่อ · เลขผู้เสียภาษี · เบอร์...'
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

        {!isLoading && kpi.count > 0 && (
          <div className='grid grid-cols-2 gap-2 sm:grid-cols-5'>
            <KpiCard
              label='ทั้งหมด'
              value={kpi.count.toLocaleString('th-TH')}
              sub={`บุคคล ${kpi.person} · นิติฯ ${kpi.company}`}
              tone='neutral'
            />
            <KpiCard
              label='สัญญาใช้งาน'
              value={kpi.activeContracts.toLocaleString('th-TH')}
              sub='สัญญา'
              tone='success'
            />
            <KpiCard
              label='ค่าเช่ารวม/เดือน'
              value={amt(kpi.exposure, { symbol: false, decimal: 0 })}
              sub='บาท · ประมาณการ'
              tone='neutral'
            />
            <KpiCard
              label='ใกล้หมด'
              value={kpi.expiringCount.toLocaleString('th-TH')}
              sub='สัญญา (90 วัน)'
              tone='warning'
            />
            <KpiCard
              label='ค้างเก็บ'
              value={amt(kpi.overdueAmount, { symbol: false, decimal: 0 })}
              sub={`${kpi.overdueCount.toLocaleString('th-TH')} ใบ`}
              tone={kpi.overdueAmount > 0 ? 'destructive' : 'neutral'}
            />
          </div>
        )}

        <div className='overflow-x-auto rounded-md border bg-card'>
          <Table className='min-w-[880px]'>
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
                      <Users className='size-8' />
                      <p>
                        {totalRows === 0
                          ? 'ยังไม่มีผู้เช่า'
                          : 'ไม่พบผู้เช่าที่ตรงกับเงื่อนไข'}
                      </p>
                      {totalRows === 0 && (
                        <Button asChild variant='link' className='h-auto p-0'>
                          <Link to='/tenants/new'>เพิ่มผู้เช่ารายแรก</Link>
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
                        to: '/tenants/$id',
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

      <CursorPopover open={!!hover} x={hover?.x ?? 0} y={hover?.y ?? 0}>
        {hover && <TenantHoverDetail row={hover.row} />}
      </CursorPopover>
    </>
  )
}

function TenantHoverDetail({ row }: { row: TenantRow }) {
  const d = row.data ?? {}
  const partyLabel = PARTY_LABEL[d.partyType ?? 'person'] ?? '—'
  // Mini-preview of tenant detail page — saves a click.
  // Sections: header → metrics → contact/address → contracts list → notes.
  const addr = [d.addrLine, d.addrSubdistrict, d.addrDistrict, d.addrProvince, d.addrPostal]
    .filter(Boolean)
    .join(' ')
    .trim()
  const note = (d as { notes?: string }).notes
  // Show active first, then past — sort by end-date (BE) desc. Inactive (cancelled/closed)
  // pinned to bottom regardless of their end date.
  const sortedContracts = [...row._relatedContracts].sort((a, b) => {
    const aInactive = !!(a.contract.data?.cancelled || a.contract.data?.closed)
    const bInactive = !!(b.contract.data?.cancelled || b.contract.data?.closed)
    if (aInactive !== bInactive) return aInactive ? 1 : -1
    const aT = parseBE(a.contract.data?.end ?? '')?.toDate().getTime() ?? 0
    const bT = parseBE(b.contract.data?.end ?? '')?.toDate().getTime() ?? 0
    return bT - aT
  })
  const visibleContracts = sortedContracts.slice(0, 4)
  const moreCount = sortedContracts.length - visibleContracts.length
  return (
    <div className='space-y-2.5 text-xs'>
      {/* Header */}
      <div className='flex items-center gap-2 border-b pb-2'>
        <UserRound className='size-4 text-muted-foreground' />
        <span className='truncate font-semibold'>{getTenantName(row.data)}</span>
        <Badge variant='outline' className='ml-auto shrink-0 text-[10px] font-normal'>
          {partyLabel}
        </Badge>
      </div>

      {/* Metrics */}
      <div className='grid grid-cols-3 gap-2 rounded border bg-muted/20 px-2 py-1.5'>
        <div>
          <p className='text-[9px] uppercase text-muted-foreground'>ใช้งาน</p>
          <p className='text-sm font-semibold tabular-nums'>
            {row._activeCount}<span className='text-[10px] text-muted-foreground'>/{row._contractCount}</span>
          </p>
        </div>
        <div>
          <p className='text-[9px] uppercase text-muted-foreground'>ค่าเช่า/ด.</p>
          <p className='text-sm font-semibold tabular-nums'>
            {amt(row._monthlyExposure, { symbol: false, decimal: 0 })}
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

      {/* Contact + address */}
      <div className='space-y-1'>
        <div className='flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground'>
          {d.taxId && (
            <span className='inline-flex items-center gap-1'>
              <FileText className='size-2.5' /> {fmtTaxId(d.taxId)}
            </span>
          )}
          {d.branch && (
            <span className='inline-flex items-center gap-1'>
              <Building2 className='size-2.5' /> สาขา {String(d.branch)}
            </span>
          )}
          {d.phone && (
            <span className='inline-flex items-center gap-1'>
              📞 {String(d.phone)}
            </span>
          )}
        </div>
        {addr && (
          <p className='flex items-start gap-1.5 leading-snug'>
            <MapPin className='mt-0.5 size-3 shrink-0 text-muted-foreground' />
            <span>{addr}</span>
          </p>
        )}
        {d.partyType === 'company' && d.signerName && (
          <p className='flex items-start gap-1.5 leading-snug text-[10px] text-muted-foreground'>
            <UserRound className='mt-0.5 size-3 shrink-0' />
            <span>ลงนาม: {d.signerName}{d.signerTitle ? ` (${d.signerTitle})` : ''}</span>
          </p>
        )}
      </div>

      {/* Contracts list */}
      {visibleContracts.length > 0 && (
        <div className='space-y-1.5'>
          <p className='text-[10px] uppercase tracking-wider text-muted-foreground'>
            สัญญาที่เช่า {row._activeCount > 0 && `· ใช้งาน ${row._activeCount}`}
            {row._expiringCount > 0 && (
              <span className='ms-1 inline-flex items-center gap-0.5 rounded-full bg-amber-500/20 px-1.5 py-px text-[9px] text-amber-700 dark:text-amber-300'>
                <Clock className='size-2' />
                ใกล้หมด {row._expiringCount}
              </span>
            )}
          </p>
          <div className='space-y-1'>
            {visibleContracts.map((rc) => (
              <ContractMiniRow
                key={rc.contract.id}
                contract={rc.contract}
                titleField='property'
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
