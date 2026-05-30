import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Link, useNavigate } from '@tanstack/react-router'
import { Calendar, CreditCard, Download, Eye, FileText, Landmark, Loader2, MapPin, Plus, Printer, Receipt, StickyNote, Tag as TagIcon, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useExportXlsx, xlsxFilename } from '@/hooks/use-xlsx'
import { freqShortLabel, monthlyRevenue } from '@/lib/contracts/stats'
import { OverdueBadge } from '@/components/yonghua/overdue-badge'
import { useInvoiceStatsByContract } from '@/lib/queries/invoice-stats'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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
  useRangeSelection,
  createSelectColumn,
  BatchSelectToolbar,
} from '@/components/data-table'
import {
  useCascadingFilter,
  FilterBar,
  type FilterField,
} from '@/components/yonghua/cascading-filter'
import { CursorPopover } from '@/components/cursor-popover'
import { ContractRowPreview } from '@/features/contracts/contract-row-preview'
import { ContractTimelineBar } from '@/features/contracts/contract-timeline-bar'
import {
  getContractDisplay,
  getContractStatus,
  getStatusMeta,
  useContracts,
  useContractTags,
} from '@/features/contracts/queries'
import { useBulkUpdateTags } from '@/features/contracts/mutations'
import { TagInput } from '@/components/yonghua/tag-input'
import { GenerateMonthlyDialog } from '@/features/invoices/generate-monthly-dialog'
import { amt, dayjs, fmtThaiShort } from '@/lib/thai'
import { type Contract, type ContractStatus } from '@/features/contracts/types'
import { cn } from '@/lib/utils'

type Row = Contract & {
  _status: ContractStatus
  _overdueCount: number
  _overdueAmount: number
}

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

function relativeThaiTime(isoStr: string | null | undefined): string {
  if (!isoStr) return '—'
  const d = dayjs(isoStr)
  if (!d.isValid()) return '—'
  const days = dayjs().diff(d, 'day')
  if (days === 0) return 'วันนี้'
  if (days === 1) return 'เมื่อวาน'
  if (days < 7) return `${days} วันที่แล้ว`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks} สัปดาห์ที่แล้ว`
  const months = dayjs().diff(d, 'month')
  if (months < 12) return `${months} เดือนที่แล้ว`
  return `${dayjs().diff(d, 'year')} ปีที่แล้ว`
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
  const { data: invoiceStats } = useInvoiceStatsByContract()
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'end', desc: true },
  ])
  const sel = useRangeSelection<Row>((r) => r.id)
  const { rowSelection, setRowSelection, selectedIds, selectedCount } = sel
  const { data: tagSuggestions } = useContractTags()
  const bulkTag = useBulkUpdateTags()
  const [bulkTagDraft, setBulkTagDraft] = useState<string[]>([])
  const [bulkTagOpen, setBulkTagOpen] = useState(false)
  const [bulkRemoveDraft, setBulkRemoveDraft] = useState<string[]>([])
  const [bulkRemoveOpen, setBulkRemoveOpen] = useState(false)
  const [genOpen, setGenOpen] = useState(false)
  const [genIds, setGenIds] = useState<string[]>([])
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
    return contracts.map((c) => {
      const s = invoiceStats?.get(c.id)
      return {
        ...c,
        _status: getContractStatus(c.data),
        _overdueCount: s?.overdueCount ?? 0,
        _overdueAmount: s?.overdueAmount ?? 0,
      }
    })
  }, [contracts, invoiceStats])

  // ตัวกรองกลาง — สถานะ · tag · ผู้ให้เช่า · ทรัพย์สิน
  const filterFields = useMemo<FilterField<Row>[]>(
    () => [
      {
        key: 'status',
        label: 'สถานะ',
        get: (r) => getStatusMeta(r._status).label,
      },
      {
        key: 'tags',
        label: 'Tag',
        get: (r) => (Array.isArray(r.data?.tags) ? (r.data.tags as string[]) : []),
      },
      {
        key: 'landlord',
        label: 'ผู้ให้เช่า',
        get: (r) => r.data?.landlord?.trim() || null,
      },
      {
        key: 'property',
        label: 'ทรัพย์สิน',
        get: (r) => String(r.data?.property ?? '').trim() || null,
      },
    ],
    [],
  )
  const searchGet = useCallback(
    (r: Row) =>
      [
        r.data?.no,
        r.data?.tenant,
        r.data?.landlord,
        r.data?.start,
        r.data?.end,
        r.data?.taxId,
        r.data?.madeAt,
      ]
        .filter(Boolean)
        .join(' '),
    [],
  )
  const filter = useCascadingFilter(rows, filterFields, searchGet)

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      createSelectColumn<Row>(),
      {
        id: 'no',
        accessorFn: (row) => getContractDisplay(row),
        header: ({ column }) => (
          <SortableHeader column={column}>เลขที่สัญญา</SortableHeader>
        ),
        cell: ({ row }) => {
          const v = getContractDisplay(row.original)
          const tags = Array.isArray(row.original.data?.tags)
            ? (row.original.data.tags as string[])
            : []
          return (
            <div className='max-w-[150px]'>
              <span className='block truncate font-medium' title={v}>
                {v}
              </span>
              {tags.length > 0 && (
                <div className='mt-1 flex flex-wrap gap-1'>
                  {tags.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className='inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground'
                    >
                      {t}
                    </span>
                  ))}
                  {tags.length > 3 && (
                    <span className='text-[10px] text-muted-foreground'>
                      +{tags.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
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
        id: 'property',
        accessorFn: (row) => String(row.data?.property ?? ''),
        header: ({ column }) => (
          <SortableHeader column={column}>ทรัพย์สิน</SortableHeader>
        ),
        cell: ({ row }) => {
          const v = String(row.original.data?.property ?? '').trim() || '—'
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
          const freqLabel = freqShortLabel(d ?? {})
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
        cell: ({ row }) => (
          <div className='flex flex-col items-start gap-1'>
            <StatusBadge status={row.original._status} />
            {row.original._overdueCount > 0 && (
              <OverdueBadge
                count={row.original._overdueCount}
                amount={row.original._overdueAmount}
                unit='ใบ'
              />
            )}
          </div>
        ),
      },
      {
        id: 'updated_at',
        accessorFn: (row) => row.updated_at ?? '',
        sortDescFirst: true,
        header: ({ column }) => (
          <SortableHeader column={column}>แก้ล่าสุด</SortableHeader>
        ),
        cell: ({ row }) => {
          const ts = row.original.updated_at
          if (!ts) return <span className='text-sm text-muted-foreground'>—</span>
          return (
            <div className='min-w-[90px]'>
              <div className='text-sm tabular-nums'>{fmtThaiShort(ts)}</div>
              <div className='text-[11px] text-muted-foreground'>{relativeThaiTime(ts)}</div>
            </div>
          )
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
    data: filter.filtered,
    columns,
    state: { sorting, rowSelection },
    enableRowSelection: true,
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  // ลำดับแถวที่เห็นจริง (หลัง sort/filter) — ป้อนให้ Shift-click เลือกช่วง
  const orderedRows = () => table.getRowModel().rows.map((r) => r.original)

  // tag ที่มีอยู่บนสัญญาที่เลือก (ใช้เป็นตัวเลือกตอน "เอา tag ออก")
  const tagsOnSelected = useMemo(() => {
    const set = new Set<string>()
    for (const c of contracts ?? []) {
      if (!rowSelection[c.id]) continue
      const tags = Array.isArray(c.data?.tags) ? (c.data.tags as string[]) : []
      tags.forEach((t) => set.add(t))
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'th'))
  }, [contracts, rowSelection])

  async function handleBulkApplyTags() {
    if (selectedIds.length === 0 || bulkTagDraft.length === 0) return
    try {
      const res = await bulkTag.mutateAsync({
        ids: selectedIds,
        addTags: bulkTagDraft,
      })
      toast.success(`ติด tag ให้ ${res.done} สัญญาแล้ว`, {
        description:
          res.errors.length > 0 ? `ผิดพลาด ${res.errors.length} รายการ` : undefined,
      })
      setBulkTagDraft([])
      setBulkTagOpen(false)
      setRowSelection({})
    } catch (err) {
      toast.error('ติด tag ไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  async function handleBulkRemoveTags() {
    if (selectedIds.length === 0 || bulkRemoveDraft.length === 0) return
    try {
      const res = await bulkTag.mutateAsync({
        ids: selectedIds,
        removeTags: bulkRemoveDraft,
      })
      toast.success(`เอา tag ออกจาก ${res.done} สัญญาแล้ว`)
      setBulkRemoveDraft([])
      setBulkRemoveOpen(false)
      setRowSelection({})
    } catch (err) {
      toast.error('เอา tag ออกไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  function handleExportSelected() {
    const selectedRows = table
      .getRowModel()
      .rows.filter((r) => rowSelection[r.original.id])
      .map((r) => r.original)
    exportContractsXlsx(selectedRows)
  }

  function handleBulkInvoice() {
    if (selectedIds.length === 0) return
    setGenIds(selectedIds)
    setGenOpen(true)
  }

  function handleBulkPrint() {
    if (selectedIds.length === 0) return
    if (selectedIds.length > 20) {
      toast.warning('เลือกมากเกินไป', {
        description: 'พิมพ์รวมทีละไม่เกิน 20 สัญญา',
      })
      return
    }
    navigate({
      to: '/contracts/print-batch',
      search: { ids: selectedIds.join(',') },
    })
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
    let overdueAmount = 0
    let overdueCount = 0
    for (const c of visible) {
      const s = c._status
      if (s === 'active') active++
      else if (s === 'expiring') expiring++
      else if (s === 'expired') expired++
      else if (s === 'cancelled') cancelled++
      if (s === 'active' || s === 'expiring') {
        monthlyRev += monthlyRevenue(c.data?.rate as number | string | undefined, c.data ?? {})
      }
      overdueAmount += c._overdueAmount
      overdueCount += c._overdueCount
    }
    return {
      active,
      expiring,
      expired,
      cancelled,
      monthlyRev,
      overdueAmount,
      overdueCount,
      count: visible.length,
    }
  }, [table.getRowModel().rows])
  const exportXlsx = useExportXlsx()

  function handleExport() {
    exportContractsXlsx(table.getRowModel().rows.map((r) => r.original))
  }

  function exportContractsXlsx(list: Row[]) {
    const visible = list.map((c) => {
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

        <FilterBar
          filter={filter}
          searchPlaceholder='ค้น เลขที่ · ผู้เช่า · ผู้ให้เช่า · วันที่...'
        />

        {error && (
          <div className='rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive'>
            ดึงข้อมูลไม่สำเร็จ —{' '}
            {error instanceof Error ? error.message : String(error)}
          </div>
        )}

        {!isLoading && kpi.count > 0 && (
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-6'>
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
            <KpiCard
              label='ค้างเก็บ'
              value={amt(kpi.overdueAmount, { symbol: false, decimal: 0 })}
              sub={`${kpi.overdueCount.toLocaleString('th-TH')} ใบ`}
              tone={kpi.overdueAmount > 0 ? 'destructive' : 'neutral'}
            />
          </div>
        )}

        <div className='overflow-x-auto rounded-md border bg-card'>
          <Table className='min-w-[1060px]'>
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
                    onClick={(e) => {
                      // โหมดเลือก (เลือกไว้แล้ว ≥1) → คลิกทั้งแถว = ติ๊ก/เอาติ๊กออก
                      //   · Shift+คลิก = เลือกเป็นช่วงจากอันก่อนหน้า
                      // ปกติ (ยังไม่เลือกอะไร) → คลิกแถว = เปิดหน้าสัญญา
                      if (selectedCount > 0) {
                        if (e.shiftKey && sel.rangeTo(row.id, orderedRows())) return
                        sel.toggle(row.id)
                        return
                      }
                      navigate({
                        to: '/contracts/$id',
                        params: { id: row.original.id },
                      })
                    }}
                    onMouseDown={(e) => {
                      // กัน browser ลากไฮไลต์ข้อความตอน Shift+คลิกเลือกช่วง
                      if (e.shiftKey) e.preventDefault()
                    }}
                    onMouseEnter={(e) => onRowEnter(row.original, e)}
                    onMouseMove={(e) => {
                      // Update position if popover is already open so it follows cursor
                      if (hover && hover.row.id === row.original.id) {
                        setHover({ row: row.original, x: e.clientX, y: e.clientY })
                      }
                    }}
                    onMouseLeave={onRowLeave}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const isSelect = cell.column.id === 'select'
                      return (
                        <TableCell
                          key={cell.id}
                          className={cn('py-3', isSelect && 'w-10')}
                          // ทั้ง cell ของช่องติ๊ก = toggle เลือก · ไม่ navigate เข้าสัญญา
                          onClick={
                            isSelect
                              ? (e) => {
                                  e.stopPropagation()
                                  if (e.shiftKey && sel.rangeTo(row.id, orderedRows()))
                                    return
                                  sel.toggle(row.id)
                                }
                              : undefined
                          }
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Main>

      {/* Floating bulk action bar */}
      <BatchSelectToolbar
        selectedCount={selectedCount}
        entityName='สัญญา'
        onClear={sel.clear}
      >
            <Popover
              open={bulkTagOpen}
              onOpenChange={(o) => {
                setBulkTagOpen(o)
                if (!o) setBulkTagDraft([])
              }}
            >
              <PopoverTrigger asChild>
                <Button size='sm' variant='outline'>
                  <TagIcon className='size-4' />
                  ติด tag
                </Button>
              </PopoverTrigger>
              <PopoverContent className='w-72 space-y-3' align='center' side='top'>
                <p className='text-sm font-medium'>
                  ติด tag ให้ {selectedCount} สัญญา
                </p>
                <TagInput
                  value={bulkTagDraft}
                  onChange={setBulkTagDraft}
                  suggestions={tagSuggestions ?? []}
                  placeholder='เลือก/สร้าง tag'
                />
                <Button
                  size='sm'
                  className='w-full'
                  disabled={bulkTagDraft.length === 0 || bulkTag.isPending}
                  onClick={handleBulkApplyTags}
                >
                  {bulkTag.isPending && <Loader2 className='size-4 animate-spin' />}
                  ติด tag
                </Button>
              </PopoverContent>
            </Popover>

            <Popover
              open={bulkRemoveOpen}
              onOpenChange={(o) => {
                setBulkRemoveOpen(o)
                if (!o) setBulkRemoveDraft([])
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={tagsOnSelected.length === 0}
                >
                  <TagIcon className='size-4' />
                  เอา tag ออก
                </Button>
              </PopoverTrigger>
              <PopoverContent className='w-72 space-y-3' align='center' side='top'>
                <p className='text-sm font-medium'>
                  เอา tag ออกจาก {selectedCount} สัญญา
                </p>
                <TagInput
                  value={bulkRemoveDraft}
                  onChange={setBulkRemoveDraft}
                  suggestions={tagsOnSelected}
                  placeholder='เลือก tag ที่จะเอาออก'
                />
                <Button
                  size='sm'
                  variant='destructive'
                  className='w-full'
                  disabled={bulkRemoveDraft.length === 0 || bulkTag.isPending}
                  onClick={handleBulkRemoveTags}
                >
                  {bulkTag.isPending && <Loader2 className='size-4 animate-spin' />}
                  เอา tag ออก
                </Button>
              </PopoverContent>
            </Popover>

            <Button
              size='sm'
              variant='outline'
              onClick={handleBulkInvoice}
              className='border-emerald-500 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-600 dark:text-emerald-400 dark:hover:bg-emerald-950/30'
            >
              <Receipt className='size-4' />
              ออกใบแจ้งหนี้
            </Button>

            <Button size='sm' variant='outline' onClick={handleBulkPrint}>
              <Printer className='size-4' />
              พิมพ์สัญญา
            </Button>

            <Button size='sm' variant='outline' onClick={handleExportSelected}>
              <Download className='size-4' />
              Export ที่เลือก
            </Button>
      </BatchSelectToolbar>

      <GenerateMonthlyDialog
        open={genOpen}
        onOpenChange={setGenOpen}
        contractIds={genIds}
        onGenerated={() => setRowSelection({})}
      />

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
  // Hover shows only data NOT visible on the row (tenant, landlord, property,
  // rate, timeline, status are already on the row). Focus on secondary fields:
  // deposit, payment terms, signing context, tax id, notes, overdue detail.
  const items: { icon: typeof Calendar; label: string; value: string }[] = []
  if (d.payment) items.push({ icon: Calendar, label: 'รอบจ่าย', value: String(d.payment) })
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
    items.push({ icon: FileText, label: 'เลขผู้เสียภาษี (ผู้เช่า)', value: String(d.taxId) })
  if (d.wit1 || d.wit2) {
    const wit = [d.wit1, d.wit2].filter(Boolean).join(' · ')
    items.push({ icon: UserRound, label: 'พยาน', value: wit })
  }
  if (contract._overdueCount > 0) {
    items.push({
      icon: CreditCard,
      label: 'ค้างชำระ',
      value: `${amt(contract._overdueAmount, { symbol: false, decimal: 0 })} บาท · ${contract._overdueCount} ใบ`,
    })
  }
  const notes = (d as { notes?: string }).notes
  return (
    <div className='space-y-2 text-xs'>
      <div className='flex items-center gap-2 border-b pb-2'>
        <FileText className='size-4 text-muted-foreground' />
        <span className='font-semibold'>{getContractDisplay(contract)}</span>
        <StatusBadge status={contract._status} />
      </div>
      {items.length === 0 && !notes && (
        <p className='text-[11px] text-muted-foreground'>—</p>
      )}
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
