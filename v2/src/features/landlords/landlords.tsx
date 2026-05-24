import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Link, useNavigate } from '@tanstack/react-router'
import { Building2, Clock, CreditCard, Download, FileText, Landmark, MapPin, Phone, Plus, Search, StickyNote, UserRound } from 'lucide-react'
import { useExportXlsx, xlsxFilename } from '@/hooks/use-xlsx'
import { useRowHover } from '@/hooks/use-row-hover'
import { CursorPopover } from '@/components/cursor-popover'
import { SortableHeader } from '@/components/yonghua/sortable-header'
import { OverdueBadge } from '@/components/yonghua/overdue-badge'
import { OccupancyBar } from '@/components/yonghua/occupancy-bar'
import { MetricDisplay } from '@/components/yonghua/metric-display'
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
  fmtTaxId,
  getLandlordName,
  useLandlords,
} from '@/features/landlords/queries'
import { PARTY_TYPES, type Landlord } from '@/features/landlords/types'
import { useAllLandlordBankLinks } from '@/features/landlord-banks/queries'
import { useBankAccounts } from '@/features/bank-accounts/queries'
import type { BankAccount } from '@/features/bank-accounts/types'
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
 * Resolve all contracts belonging to a landlord — matched by landlord_id /
 * invHeaderId / name fallback. Uses the shared lightweight match-keys query
 * (cache shared across landlords list, tenants list, and detail pages).
 */
function landlordContracts(
  landlord: Landlord,
  contracts: ContractMatchRow[],
): ContractMatchRow[] {
  // Filter cancelled — semantics match properties: _contractCount means
  // "non-cancelled contracts attached", _activeCount carries the non-expired
  // subset for KPI display.
  const headerId = (landlord.data.invoiceHeaderId ?? '').trim()
  const nm = (landlord.data.name ?? '').trim()
  return contracts.filter((c) => {
    if (c.data.cancelled) return false
    if (c.data.landlord_id === landlord.id) return true
    if (headerId && c.data.invHeaderId === headerId) return true
    if (c.data.landlord === nm) return true
    return false
  })
}

type RelatedContract = {
  contract: ContractMatchRow
  overdueAmount: number
  overdueCount: number
}

type LandlordRow = Landlord & {
  _contractCount: number
  _activeCount: number
  _expiringCount: number
  _bankCount: number
  _banks: Array<BankAccount & { isDefault: boolean }>
  _relatedContracts: RelatedContract[]
  _monthlyRevenue: number
  _overdueAmount: number
  _overdueCount: number
}

export function Landlords() {
  const { data: landlords, isLoading, error } = useLandlords()
  const { data: contracts } = useContractMatchKeys()
  const { data: allLinks } = useAllLandlordBankLinks()
  const { data: allBanks } = useBankAccounts()
  const { data: invoiceStats } = useInvoiceStatsByContract()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const navigate = useNavigate()
  const { hover, onEnter, onMove, onLeave } = useRowHover<LandlordRow>()

  // Count banks per landlord — via landlord_banks junction (M:M)
  const bankCountByOwner = useMemo(() => {
    const map = new Map<string, number>()
    if (!allLinks) return map
    allLinks.forEach((l) => {
      map.set(l.landlord_id, (map.get(l.landlord_id) ?? 0) + 1)
    })
    return map
  }, [allLinks])

  // Resolved bank accounts per landlord (for hover preview)
  const banksByOwner = useMemo(() => {
    const map = new Map<string, Array<BankAccount & { isDefault: boolean }>>()
    if (!allLinks || !allBanks) return map
    const bankMap = new Map(allBanks.map((b) => [b.id, b]))
    for (const link of allLinks) {
      const bank = bankMap.get(link.bank_account_id)
      if (!bank) continue
      const arr = map.get(link.landlord_id) ?? []
      arr.push({ ...bank, isDefault: !!link.is_default })
      map.set(link.landlord_id, arr)
    }
    // Sort: default first, then by bank name
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
        return (a.data?.bank ?? '').localeCompare(b.data?.bank ?? '', 'th')
      })
    }
    return map
  }, [allLinks, allBanks])

  const rows = useMemo<LandlordRow[]>(() => {
    if (!landlords) return []
    return landlords.map((l) => {
      const list = contracts ? landlordContracts(l, contracts) : []
      let active = 0
      let expiring = 0
      let monthlyRev = 0
      let overdueAmount = 0
      let overdueCount = 0
      for (const c of list) {
        if (c.data?.cancelled || c.data?.closed) continue
        const days = daysUntil(c.data?.end ?? null)
        if (days == null || days < 0) continue // skip expired
        active++
        if (days <= 90) expiring++
        monthlyRev += monthlyRevenue(c.data?.rate ?? null, c.data ?? {})
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
      const banks = banksByOwner.get(l.id) ?? []
      return {
        ...l,
        _contractCount: list.length,
        _activeCount: active,
        _expiringCount: expiring,
        _bankCount: bankCountByOwner.get(l.id) ?? banks.length,
        _banks: banks,
        _relatedContracts: related,
        _monthlyRevenue: monthlyRev,
        _overdueAmount: overdueAmount,
        _overdueCount: overdueCount,
      }
    })
  }, [landlords, contracts, bankCountByOwner, banksByOwner, invoiceStats])

  const columns = useMemo<ColumnDef<LandlordRow>[]>(
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

  /** Running KPI · count + active + revenue + overdue + expiring */
  const kpi = useMemo(() => {
    const visible = table.getRowModel().rows.map((r) => r.original)
    let monthlyRev = 0
    let activeCount = 0
    let expiringCount = 0
    let overdueAmount = 0
    let overdueCount = 0
    for (const l of visible) {
      monthlyRev += l._monthlyRevenue
      activeCount += l._activeCount
      expiringCount += l._expiringCount
      overdueAmount += l._overdueAmount
      overdueCount += l._overdueCount
    }
    return {
      count: visible.length,
      activeCount,
      monthlyRev,
      expiringCount,
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
        shortName: d?.shortName ?? '',
        partyType: d?.partyType === 'company' ? 'นิติบุคคล' : 'บุคคลธรรมดา',
        taxId: d?.taxId ?? '',
        phone: d?.phone ?? '',
        vat: d?.vatRegistered ? `${d?.vatRate ?? 7}%` : '-',
        address: [d?.addrLine, d?.addrSubdistrict, d?.addrDistrict, d?.addrProvince, d?.addrPostal]
          .filter(Boolean)
          .join(' '),
      }
    })
    void exportXlsx(
      xlsxFilename('ผู้ให้เช่า'),
      [
        { header: 'ชื่อ', key: 'name', width: 28 },
        { header: 'ชื่อย่อ', key: 'shortName', width: 14 },
        { header: 'ประเภท', key: 'partyType', width: 14 },
        { header: 'เลขผู้เสียภาษี', key: 'taxId', width: 18 },
        { header: 'เบอร์', key: 'phone', width: 14 },
        { header: 'VAT', key: 'vat', width: 8 },
        { header: 'ที่อยู่', key: 'address', width: 40 },
      ],
      visible,
      { sheetName: 'ผู้ให้เช่า' },
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

        {/* KPI strip — revenue + portfolio health */}
        {!isLoading && kpi.count > 0 && (
          <div className='grid grid-cols-2 gap-2 sm:grid-cols-5'>
            <KpiCard
              label='ทั้งหมด'
              value={kpi.count.toLocaleString('th-TH')}
              sub='ผู้ให้เช่า'
              tone='neutral'
            />
            <KpiCard
              label='สัญญาใช้งาน'
              value={kpi.activeCount.toLocaleString('th-TH')}
              sub='ทั้งหมด'
              tone='success'
            />
            <KpiCard
              label='รายได้/เดือน'
              value={amt(kpi.monthlyRev, { symbol: false, decimal: 0 })}
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

        {/* Card list — v1-style: avatar + name + signer chips + address · counts on right */}
        <div className='space-y-2'>
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
              <Skeleton key={`skeleton-${i}`} className='h-24 w-full rounded-md' />
            ))
          ) : table.getRowModel().rows.length === 0 ? (
            <div className='flex h-32 flex-col items-center justify-center gap-2 rounded-md border bg-card text-muted-foreground'>
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
          ) : (
            table.getRowModel().rows.map((row) => (
              <LandlordCard
                key={row.id}
                row={row.original}
                onClick={() =>
                  navigate({
                    to: '/landlords/$id',
                    params: { id: row.original.id },
                  })
                }
                onMouseEnter={onEnter(row.original)}
                onMouseMove={onMove(row.original)}
                onMouseLeave={onLeave}
              />
            ))
          )}
        </div>
      </Main>

      <CursorPopover open={!!hover} x={hover?.x ?? 0} y={hover?.y ?? 0}>
        {hover && <LandlordHoverDetail row={hover.row} />}
      </CursorPopover>
    </>
  )
}

function LandlordHoverDetail({ row }: { row: LandlordRow }) {
  const d = row.data ?? {}
  const partyLabel = PARTY_LABEL[d.partyType ?? 'person'] ?? '—'
  // Mini-preview of landlord detail page — saves a click.
  // Sections: header → metrics → contact + tax → banks list → contracts list → notes.
  const addr = [d.addrLine, d.addrSubdistrict, d.addrDistrict, d.addrProvince, d.addrPostal]
    .filter(Boolean)
    .join(' ')
    .trim()
  const note = (d as { notes?: string }).notes
  const visibleBanks = row._banks.slice(0, 3)
  const moreBanks = row._banks.length - visibleBanks.length
  // Sort contracts: active first, then by end-date (BE) desc.
  // BE strings "DD/MM/YYYY" cannot be sorted by string compare — parse first.
  const sortedContracts = [...row._relatedContracts].sort((a, b) => {
    const ad = a.contract.data
    const bd = b.contract.data
    const aActive = !ad?.cancelled && !ad?.closed
    const bActive = !bd?.cancelled && !bd?.closed
    if (aActive !== bActive) return aActive ? -1 : 1
    const aT = parseBE(ad?.end ?? '')?.toDate().getTime() ?? 0
    const bT = parseBE(bd?.end ?? '')?.toDate().getTime() ?? 0
    return bT - aT
  })
  const visibleContracts = sortedContracts.slice(0, 3)
  const moreContracts = sortedContracts.length - visibleContracts.length
  return (
    <div className='space-y-2.5 text-xs'>
      {/* Header */}
      <div className='flex items-center gap-2 border-b pb-2'>
        <Landmark className='size-4 text-muted-foreground' />
        <span className='truncate font-semibold'>{getLandlordName(row.data)}</span>
        <Badge variant='outline' className='ml-auto shrink-0 text-[10px] font-normal'>
          {partyLabel}
        </Badge>
      </div>

      {/* Metrics */}
      <div className='grid grid-cols-3 gap-2 rounded border bg-muted/20 px-2 py-1.5'>
        <div>
          <p className='text-[9px] uppercase text-muted-foreground'>รายได้/ด.</p>
          <p className='text-sm font-semibold tabular-nums'>
            {amt(row._monthlyRevenue, { symbol: false, decimal: 0 })}
          </p>
        </div>
        <div>
          <p className='text-[9px] uppercase text-muted-foreground'>สัญญาใช้งาน</p>
          <p className='text-sm font-semibold tabular-nums'>
            {row._activeCount}<span className='text-[10px] text-muted-foreground'>/{row._contractCount}</span>
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

      {/* Contact + tax */}
      <div className='space-y-1'>
        <div className='flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground'>
          {d.taxId && (
            <span className='inline-flex items-center gap-1'>
              <FileText className='size-2.5' /> {fmtTaxId(d.taxId)}
            </span>
          )}
          {d.phone && (
            <span className='inline-flex items-center gap-1'>
              <Phone className='size-2.5' /> {String(d.phone)}
            </span>
          )}
          {d.vatRegistered && (
            <span className='inline-flex items-center gap-1 text-amber-700 dark:text-amber-300'>
              VAT {d.vatRate ?? 7}%
            </span>
          )}
          {d.promptPayId && (
            <span className='inline-flex items-center gap-1'>
              <CreditCard className='size-2.5' /> PromptPay {d.promptPayId}
            </span>
          )}
        </div>
        {addr && (
          <p className='flex items-start gap-1.5 leading-snug'>
            <MapPin className='mt-0.5 size-3 shrink-0 text-muted-foreground' />
            <span>{addr}</span>
          </p>
        )}
      </div>

      {/* Banks list */}
      {visibleBanks.length > 0 && (
        <div className='space-y-1'>
          <p className='text-[10px] uppercase tracking-wider text-muted-foreground'>
            บัญชีรับเงิน ({row._bankCount})
          </p>
          <div className='space-y-1'>
            {visibleBanks.map((b) => (
              <div
                key={b.id}
                className='flex items-center justify-between gap-2 border-l-2 border-l-muted-foreground/20 pl-2 py-0.5 text-[11px]'
              >
                <div className='min-w-0 flex-1'>
                  <span className='font-medium'>{b.data?.bank ?? '—'}</span>
                  {b.data?.branch && (
                    <span className='ms-1 text-muted-foreground'>· {b.data.branch}</span>
                  )}
                </div>
                <span className='shrink-0 tabular-nums text-muted-foreground'>
                  {b.data?.acctNo ?? '—'}
                </span>
                {b.isDefault && (
                  <span className='shrink-0 rounded-full bg-emerald-500/20 px-1.5 py-px text-[9px] text-emerald-700 dark:text-emerald-300'>
                    หลัก
                  </span>
                )}
              </div>
            ))}
            {moreBanks > 0 && (
              <p className='text-[10px] text-muted-foreground'>
                + อีก {moreBanks} บัญชี
              </p>
            )}
          </div>
        </div>
      )}

      {/* Contracts list */}
      {visibleContracts.length > 0 && (
        <div className='space-y-1'>
          <p className='text-[10px] uppercase tracking-wider text-muted-foreground'>
            สัญญา ({row._activeCount} ใช้งาน / {row._contractCount} ทั้งหมด)
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
                titleField='tenant'
                overdueAmount={rc.overdueAmount}
                overdueCount={rc.overdueCount}
              />
            ))}
            {moreContracts > 0 && (
              <p className='text-[10px] text-muted-foreground'>
                + อีก {moreContracts} สัญญา
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

function LandlordCard({
  row,
  onClick,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
}: {
  row: LandlordRow
  onClick: () => void
  onMouseEnter: (e: React.MouseEvent) => void
  onMouseMove: (e: React.MouseEvent) => void
  onMouseLeave: () => void
}) {
  const d = row.data ?? {}
  const isCompany = d.partyType === 'company'
  const addr = [d.addrLine, d.addrSubdistrict, d.addrDistrict, d.addrProvince, d.addrPostal]
    .filter(Boolean)
    .join(' ')
    .trim()
  return (
    <button
      type='button'
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={cn(
        'group flex w-full items-start gap-3 rounded-md border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/40',
        'border-l-2',
        isCompany ? 'border-l-indigo-500' : 'border-l-emerald-500',
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-full border',
          isCompany ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        )}
      >
        {isCompany ? <Building2 className='size-5' /> : <UserRound className='size-5' />}
      </div>

      {/* Main */}
      <div className='min-w-0 flex-1'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='font-semibold'>{getLandlordName(d) || '—'}</span>
          {d.shortName && (
            <Badge variant='outline' className='text-[10px] font-normal'>
              {d.shortName}
            </Badge>
          )}
          {d.vatRegistered && (
            <Badge
              variant='outline'
              className='border-amber-500/30 bg-amber-500/10 text-[10px] font-normal text-amber-700 dark:text-amber-400'
            >
              VAT {d.vatRate ?? 7}%
            </Badge>
          )}
        </div>

        {/* Signer chips */}
        {isCompany && d.signerName && (
          <div className='mt-1 flex flex-wrap gap-1'>
            <Badge
              variant='outline'
              className='border-sky-500/30 bg-sky-500/10 text-[10px] font-normal text-sky-700 dark:text-sky-400'
            >
              เซ็นโดย {d.signerName}
              {d.signerTitle ? ` (${d.signerTitle})` : ''}
            </Badge>
          </div>
        )}

        {/* Address + tax id */}
        {(addr || d.taxId || d.phone) && (
          <p className='mt-1 text-xs text-muted-foreground'>
            {addr && (
              <span>
                {addr}
              </span>
            )}
            {(d.taxId || d.phone) && addr && <span> · </span>}
            {d.taxId && <span>เลขผู้เสียภาษี {fmtTaxId(d.taxId)}</span>}
            {d.taxId && d.phone && <span> · </span>}
            {d.phone && <span>โทร {d.phone}</span>}
          </p>
        )}
      </div>

      {/* Right side — revenue-first, then operational counts + alerts */}
      <div className='flex shrink-0 flex-col items-end gap-1.5 text-right'>
        <MetricDisplay
          value={amt(row._monthlyRevenue, { symbol: false, decimal: 0 })}
          label='บาท / เดือน'
          size='lg'
          align='right'
        />
        {row._activeCount > 0 && (
          <OccupancyBar
            occupied={row._activeCount}
            total={row._contractCount || row._activeCount}
            widthClass='w-24'
          />
        )}
        <div className='flex flex-wrap items-center justify-end gap-1.5 text-[10px] text-muted-foreground'>
          <span className='tabular-nums'>
            <Landmark className='mr-0.5 inline size-3' />
            {row._bankCount} บัญชี
          </span>
          <span>·</span>
          <span className='tabular-nums'>
            <FileText className='mr-0.5 inline size-3' />
            {row._activeCount}/{row._contractCount} สัญญา
          </span>
        </div>
        <div className='flex flex-wrap items-center justify-end gap-1'>
          {row._expiringCount > 0 && (
            <span className='inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300'>
              <Clock className='size-2.5' />
              ใกล้หมด {row._expiringCount}
            </span>
          )}
          {row._overdueCount > 0 && (
            <OverdueBadge
              count={row._overdueCount}
              amount={row._overdueAmount}
              unit='ใบ'
            />
          )}
        </div>
      </div>
    </button>
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
