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
import { Building2, Download, FileText, MapPin, Phone, Plus, Search, StickyNote, UserRound, Users } from 'lucide-react'
import { useExportXlsx, xlsxFilename } from '@/hooks/use-xlsx'
import { useRowHover } from '@/hooks/use-row-hover'
import { CursorPopover } from '@/components/cursor-popover'
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
  getTenantName,
  useTenants,
} from '@/features/tenants/queries'
import { PARTY_TYPES, type Tenant } from '@/features/tenants/types'
import {
  type ContractMatchRow,
  useContractMatchKeys,
} from '@/lib/queries/contract-match'
import { cn } from '@/lib/utils'

const PARTY_LABEL: Record<string, string> = Object.fromEntries(
  PARTY_TYPES.map((p) => [p.value, p.label]),
)

/**
 * Derive contract count per tenant — uses shared lightweight match-keys query.
 * (See lib/queries/contract-match.ts for the why.)
 */
function countContracts(
  tenant: Tenant,
  contracts: ContractMatchRow[],
): number {
  const tax = (tenant.data.taxId ?? '').trim()
  const nm = (tenant.data.name ?? '').trim()
  return contracts.filter((c) => {
    if (c.data.tenant_id === tenant.id) return true
    if (tax && c.data.taxId === tax) return true
    if (!tax && c.data.tenant === nm) return true
    return false
  }).length
}

type TenantRow = Tenant & { _contractCount: number }

export function Tenants() {
  const { data: tenants, isLoading, error } = useTenants()
  const { data: contracts } = useContractMatchKeys()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const navigate = useNavigate()
  const { hover, onEnter, onMove, onLeave } = useRowHover<TenantRow>()

  const rows = useMemo(() => {
    if (!tenants) return []
    if (!contracts) return tenants.map((t) => ({ ...t, _contractCount: 0 }))
    return tenants.map((t) => ({ ...t, _contractCount: countContracts(t, contracts) }))
  }, [tenants, contracts])

  const columns = useMemo<ColumnDef<Tenant & { _contractCount: number }>[]>(
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

  /** v1-style KPI · count + person/company breakdown + contracts */
  const kpi = useMemo(() => {
    const visible = table.getRowModel().rows.map((r) => r.original)
    let person = 0
    let company = 0
    let withContract = 0
    let totalContracts = 0
    for (const t of visible) {
      if (t.data?.partyType === 'company') company++
      else person++
      if (t._contractCount > 0) withContract++
      totalContracts += t._contractCount
    }
    return { count: visible.length, person, company, withContract, totalContracts }
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
          <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
            <KpiCard
              label='ทั้งหมด'
              value={kpi.count.toLocaleString('th-TH')}
              sub='ผู้เช่า'
              tone='neutral'
            />
            <KpiCard
              label='บุคคล'
              value={kpi.person.toLocaleString('th-TH')}
              sub='ราย'
              tone='success'
            />
            <KpiCard
              label='นิติบุคคล'
              value={kpi.company.toLocaleString('th-TH')}
              sub='บริษัท / หจก.'
              tone='neutral'
            />
            <KpiCard
              label='สัญญา'
              value={kpi.totalContracts.toLocaleString('th-TH')}
              sub={`${kpi.withContract.toLocaleString('th-TH')} ราย มีสัญญา`}
              tone='neutral'
            />
          </div>
        )}

        <div className='overflow-x-auto rounded-md border bg-card'>
          <Table className='min-w-[760px]'>
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
  const addr = [d.addrLine, d.addrSubdistrict, d.addrDistrict, d.addrProvince, d.addrPostal]
    .filter(Boolean)
    .join(' ')
    .trim()
  const items: { icon: typeof MapPin; label: string; value: string }[] = []
  items.push({ icon: UserRound, label: 'ประเภท', value: partyLabel })
  if (d.taxId) items.push({ icon: FileText, label: 'เลขผู้เสียภาษี', value: fmtTaxId(d.taxId) })
  if (d.phone) items.push({ icon: Phone, label: 'โทร', value: String(d.phone) })
  if (addr) items.push({ icon: MapPin, label: 'ที่อยู่', value: addr })
  if (d.partyType === 'company' && d.signerName) {
    items.push({
      icon: UserRound,
      label: 'ผู้ลงนาม',
      value: `${d.signerName}${d.signerTitle ? ` (${d.signerTitle})` : ''}`,
    })
  }
  items.push({
    icon: FileText,
    label: 'สัญญา',
    value: `${row._contractCount.toLocaleString('th-TH')} ฉบับ`,
  })
  const note = (d as { notes?: string }).notes
  return (
    <div className='space-y-2 text-xs'>
      <div className='flex items-center gap-2 border-b pb-2'>
        <UserRound className='size-4 text-muted-foreground' />
        <span className='font-semibold'>{getTenantName(row.data)}</span>
        <Badge variant='outline' className='ml-auto text-[10px] font-normal'>
          {partyLabel}
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
            <StickyNote className='mt-0.5 size-3.5 shrink-0 text-muted-foreground' />
            <p className='leading-snug whitespace-pre-wrap'>{String(note)}</p>
          </div>
        )}
      </div>
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
