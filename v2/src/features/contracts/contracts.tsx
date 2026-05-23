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
import { Calendar, CreditCard, Download, Eye, FileText, Landmark, MapPin, Plus, Search, StickyNote, UserRound, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useExportXlsx, xlsxFilename } from '@/hooks/use-xlsx'

/**
 * Friendly short label for payment frequency.
 * Prefers structured data.payFreq · falls back to keyword parse on data.payment string.
 */
function freqShortLabel(d: Record<string, unknown> | undefined): string {
  if (!d) return ''
  const pf = String(d.payFreq ?? '').toLowerCase()
  if (pf === 'monthly') return 'รายเดือน'
  if (pf === 'quarterly') return 'รายไตรมาส'
  if (pf === 'semiannual' || pf === 'semi') return 'ครึ่งปี'
  if (pf === 'annual' || pf === 'yearly') return 'รายปี'
  if (pf === 'lump') return 'จ่ายครั้งเดียว'
  // Fallback: parse payment string
  const s = String(d.payment ?? '')
  if (/ปีละ|รายปี|ต่อปี/.test(s)) return 'รายปี'
  if (/ไตรมาส/.test(s)) return 'รายไตรมาส'
  if (/ครึ่งปี|6 เดือน/.test(s)) return 'ครึ่งปี'
  if (/ลำพ|ทั้งหมด|ครั้งเดียว|วันเซ็น/.test(s)) return 'จ่ายครั้งเดียว'
  if (/เดือนละ|รายเดือน|ทุกเดือน|ของทุกเดือน/.test(s)) return 'รายเดือน'
  return ''
}
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
import { useRef } from 'react'
import { SortableHeader } from '@/components/yonghua/sortable-header'
import { CursorPopover } from '@/components/cursor-popover'
import { ContractRowPreview } from '@/features/contracts/contract-row-preview'
import { ContractTimelineBar } from '@/features/contracts/contract-timeline-bar'
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

/** Left accent strip on the row — v1-style color cue at a glance */
const STATUS_ACCENT_STRIP: Record<string, string> = {
  active: 'border-l-2 border-l-emerald-500',
  expiring: 'border-l-2 border-l-amber-500',
  upcoming: 'border-l-2 border-l-sky-500',
  expired: 'border-l-2 border-l-slate-400',
  cancelled: 'border-l-2 border-l-red-500',
  closed: 'border-l-2 border-l-slate-300',
  unknown: 'border-l-2 border-l-transparent',
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
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [hover, setHover] = useState<{ row: Row; x: number; y: number } | null>(null)
  const hoverTimer = useRef<number | null>(null)

  function onRowEnter(row: Row, e: React.MouseEvent) {
    const x = e.clientX
    const y = e.clientY
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current)
    hoverTimer.current = window.setTimeout(() => {
      setHover({ row, x, y })
    }, 250)
  }
  function onRowLeave() {
    if (hoverTimer.current) {
      window.clearTimeout(hoverTimer.current)
      hoverTimer.current = null
    }
    setHover(null)
  }

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
        id: 'end',
        accessorFn: (row) => row.data?.end ?? '',
        header: ({ column }) => (
          <SortableHeader column={column}>ระยะสัญญา</SortableHeader>
        ),
        cell: ({ row }) => {
          const d = row.original.data
          return (
            <div className='min-w-[180px] max-w-[260px]'>
              <ContractTimelineBar
                start={d?.start}
                end={d?.end}
                cancelled={!!d?.cancelled || row.original._status === 'cancelled'}
              />
            </div>
          )
        },
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
          const d = row.original.data
          const formatted = amt(d?.rate as number | string | undefined, {
            symbol: false,
            decimal: 0,
          })
          if (formatted === '—') {
            return <span className='text-sm text-muted-foreground'>—</span>
          }
          const freqLabel = freqShortLabel(d as unknown as Record<string, unknown>)
          return (
            <span className='text-sm tabular-nums'>
              {formatted}
              {freqLabel ? (
                <span className='ms-2 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground'>
                  {freqLabel}
                </span>
              ) : null}
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
      {
        id: 'actions',
        header: () => <span className='sr-only'>การกระทำ</span>,
        cell: ({ row }) => (
          <Button
            variant='ghost'
            size='sm'
            className='size-8 p-0'
            title='ดูตัวอย่างพิมพ์'
            onClick={(e) => {
              e.stopPropagation()
              setPreviewId(row.original.id)
            }}
          >
            <Eye className='size-4' />
            <span className='sr-only'>ตัวอย่างพิมพ์</span>
          </Button>
        ),
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

  /** v1-style running KPI totals computed from filtered rows */
  const kpi = useMemo(() => {
    const visible = table.getRowModel().rows.map((r) => r.original)
    let active = 0
    let expiring = 0
    let expired = 0
    let cancelled = 0
    let monthlyRev = 0
    for (const c of visible) {
      const s = c._status
      if (s === 'active') active++
      else if (s === 'expiring') expiring++
      else if (s === 'expired') expired++
      else if (s === 'cancelled') cancelled++
      // sum monthly revenue from active + expiring (rough · uses raw rate / freq guess)
      if (s === 'active' || s === 'expiring') {
        const raw = amt(c.data?.rate as number | string | undefined, {
          symbol: false,
          decimal: 0,
          emDash: false,
        })
        const num = raw ? Number(raw.replace(/[,\s]/g, '')) : 0
        if (Number.isFinite(num) && num > 0) {
          const payFreq = freqShortLabel(c.data as unknown as Record<string, unknown>)
          // normalize to monthly
          if (payFreq === 'รายปี') monthlyRev += num / 12
          else if (payFreq === 'รายไตรมาส') monthlyRev += num / 3
          else if (payFreq === 'ครึ่งปี') monthlyRev += num / 6
          else if (payFreq === 'จ่ายครั้งเดียว') {
            // skip — lump sum doesn't translate to monthly revenue
          } else {
            monthlyRev += num
          }
        }
      }
    }
    return { active, expiring, expired, cancelled, monthlyRev, count: visible.length }
  }, [table.getRowModel().rows])
  const exportXlsx = useExportXlsx()

  function handleExport() {
    const visible = table.getRowModel().rows.map((r) => {
      const c = r.original
      const d = c.data
      const meta = getStatusMeta(getContractStatus(d))
      return {
        no: getContractDisplay(c),
        tenant: d?.tenant ?? '',
        landlord: d?.landlord ?? '',
        property: String(d?.property ?? ''),
        start: d?.start ?? '',
        end: d?.end ?? '',
        dur: d?.dur ?? '',
        rate: Number(d?.rate) || 0,
        deposit: Number(d?.deposit) || 0,
        payment: d?.payment ?? '',
        status: meta.label,
      }
    })
    void exportXlsx(
      xlsxFilename('สัญญา'),
      [
        { header: 'เลขที่', key: 'no', width: 16 },
        { header: 'ผู้เช่า', key: 'tenant', width: 28 },
        { header: 'ผู้ให้เช่า', key: 'landlord', width: 24 },
        { header: 'ทรัพย์สิน', key: 'property', width: 24 },
        { header: 'เริ่ม', key: 'start', width: 12 },
        { header: 'สิ้นสุด', key: 'end', width: 12 },
        { header: 'ระยะ', key: 'dur', width: 10 },
        { header: 'ค่าเช่า', key: 'rate', width: 12 },
        { header: 'มัดจำ', key: 'deposit', width: 12 },
        { header: 'การชำระ', key: 'payment', width: 14 },
        { header: 'สถานะ', key: 'status', width: 12 },
      ],
      visible,
      { sheetName: 'สัญญาเช่า' },
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

        {!isLoading && kpi.count > 0 && (
          <div className='grid grid-cols-2 gap-2 sm:grid-cols-5'>
            <KpiCard
              label='ทั้งหมด'
              value={kpi.count.toLocaleString('th-TH')}
              sub='สัญญา'
              tone='neutral'
            />
            <KpiCard
              label='ใช้งาน'
              value={kpi.active.toLocaleString('th-TH')}
              sub='สัญญา'
              tone='success'
            />
            <KpiCard
              label='ใกล้หมด'
              value={kpi.expiring.toLocaleString('th-TH')}
              sub='สัญญา'
              tone='warning'
            />
            <KpiCard
              label='หมดแล้ว'
              value={kpi.expired.toLocaleString('th-TH')}
              sub={`+ยกเลิก ${kpi.cancelled.toLocaleString('th-TH')}`}
              tone='destructive'
            />
            <KpiCard
              label='รายได้/เดือน'
              value={amt(kpi.monthlyRev, { symbol: false, decimal: 0 })}
              sub='บาท · ประมาณการ'
              tone='neutral'
            />
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
                    className={cn(
                      'cursor-pointer hover:bg-muted/40',
                      STATUS_ACCENT_STRIP[row.original._status] ??
                        'border-l-2 border-l-transparent',
                    )}
                    onClick={() =>
                      navigate({
                        to: '/contracts/$id',
                        params: { id: row.original.id },
                      })
                    }
                    onMouseEnter={(e) => onRowEnter(row.original, e)}
                    onMouseMove={(e) => {
                      // Update position if popover is already open so it follows cursor
                      if (hover && hover.row.id === row.original.id) {
                        setHover({ row: row.original, x: e.clientX, y: e.clientY })
                      }
                    }}
                    onMouseLeave={onRowLeave}
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

      <ContractRowPreview id={previewId} onClose={() => setPreviewId(null)} />

      <CursorPopover
        open={!!hover}
        x={hover?.x ?? 0}
        y={hover?.y ?? 0}
      >
        {hover && <ContractHoverDetail contract={hover.row} />}
      </CursorPopover>
    </>
  )
}

function ContractHoverDetail({ contract }: { contract: Row }) {
  const d = contract.data ?? {}
  const items: { icon: typeof Calendar; label: string; value: string }[] = []
  if (d.tenant) items.push({ icon: UserRound, label: 'ผู้เช่า', value: String(d.tenant) })
  if (d.landlord) items.push({ icon: Users, label: 'ผู้ให้เช่า', value: String(d.landlord) })
  const propVal = d.property as string | undefined
  if (propVal) items.push({ icon: MapPin, label: 'ทรัพย์สิน', value: propVal })
  if (d.start || d.end)
    items.push({
      icon: Calendar,
      label: 'ระยะเวลา',
      value: `${d.start ?? '—'} → ${d.end ?? '—'}`,
    })
  if (d.rate != null) {
    const fmt = amt(d.rate as number | string | undefined, { symbol: false, decimal: 0 })
    if (fmt !== '—') {
      items.push({ icon: CreditCard, label: 'ค่าเช่า', value: `${fmt} บาท${d.payment ? ` · ${d.payment}` : ''}` })
    }
  }
  if (d.deposit != null && Number(d.deposit) > 0) {
    items.push({
      icon: Landmark,
      label: 'เงินประกัน',
      value: `${amt(d.deposit as number, { symbol: false, decimal: 0 })} บาท`,
    })
  }
  if (d.madeAt)
    items.push({ icon: MapPin, label: 'ที่ทำสัญญา', value: String(d.madeAt) })
  if (d.taxId)
    items.push({ icon: FileText, label: 'เลขผู้เสียภาษี', value: String(d.taxId) })
  const notes = (d as { notes?: string }).notes
  return (
    <div className='space-y-2 text-xs'>
      <div className='flex items-center gap-2 border-b pb-2'>
        <FileText className='size-4 text-muted-foreground' />
        <span className='font-semibold'>{getContractDisplay(contract)}</span>
        <StatusBadge status={contract._status} />
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
        {notes && (
          <div className='flex items-start gap-2 border-t pt-1.5'>
            <StickyNote className='mt-0.5 size-3.5 shrink-0 text-muted-foreground' />
            <p className='leading-snug whitespace-pre-wrap'>{String(notes)}</p>
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
