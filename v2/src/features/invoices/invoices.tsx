import {
  type ColumnDef,
  type ColumnFiltersState,
  type RowSelectionState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  Ban,
  Building2,
  Calendar,
  CreditCard,
  Download,
  Eye,
  Loader2,
  Plus,
  Receipt,
  Search,
  Send,
  Sparkles,
  StickyNote,
  Trash2,
  UserRound,
  Wallet,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useExportXlsx, xlsxFilename } from '@/hooks/use-xlsx'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { BatchPaymentDialog } from '@/features/invoices/batch-payment-dialog'
import { BatchReceiptPrintButton } from '@/features/invoices/batch-receipt-print'
import { GenerateMonthlyDialog } from '@/features/invoices/generate-monthly-dialog'
import { useAutoVoidExpiredDrafts, useBatchDeleteInvoices, useBatchMarkSent, useBatchVoid, useSendAllDraftsGlobal } from '@/features/invoices/mutations'
import { useInvoiceSettings } from '@/features/settings/queries'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SortableHeader } from '@/components/yonghua/sortable-header'
import {
  daysOverdue,
  formatMonth,
  getEffectiveStatus,
  getInvoiceDisplay,
  getStatusMeta,
  useInvoices,
} from '@/features/invoices/queries'
import { CursorPopover } from '@/components/cursor-popover'
import { InvoiceRowPreview, type InvoicePreviewKind } from '@/features/invoices/invoice-row-preview'
import {
  INVOICE_STATUSES,
  type Invoice,
  type InvoiceStatus,
} from '@/features/invoices/types'
import { QuickPaymentDialog } from '@/features/invoices/payment-panel'
import { SlipBatchUpload } from '@/features/invoices/slip-batch-upload'
import { amt } from '@/lib/thai'
import { cn } from '@/lib/utils'

type Row = Invoice & { _status: InvoiceStatus; _overdue: number }

const STATUS_TONE_CLASS: Record<string, string> = {
  success: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300',
  warning: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300',
  info: 'bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-300',
  muted: 'bg-muted text-muted-foreground border-border',
  destructive: 'bg-destructive/10 text-destructive border-destructive/30',
}

/** Left accent strip on the row · v1-style color cue */
function invoiceAccentStrip(status: string, overdue: number): string {
  if (overdue > 0) return 'border-l-2 border-l-red-500'
  switch (status) {
    case 'paid':
      return 'border-l-2 border-l-emerald-500'
    case 'partial':
      return 'border-l-2 border-l-amber-500'
    case 'sent':
      return 'border-l-2 border-l-sky-500'
    case 'voided':
      return 'border-l-2 border-l-slate-400'
    case 'draft':
      return 'border-l-2 border-l-slate-300'
    default:
      return 'border-l-2 border-l-transparent'
  }
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const meta = getStatusMeta(status)
  return (
    <Badge variant='outline' className={cn('font-normal', STATUS_TONE_CLASS[meta.tone] ?? '')}>
      {meta.label}
    </Badge>
  )
}

export function Invoices() {
  const { data: invoices, isLoading, error } = useInvoices()
  // Default: no explicit column sort — rows are pre-sorted "งานเร่งด่วน" first
  // (most overdue first → most recent month). Clicking a column header overrides.
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [payQuickId, setPayQuickId] = useState<string | null>(null)
  const navigate = useNavigate()
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [previewKind, setPreviewKind] = useState<InvoicePreviewKind>('invoice')

  function openPreview(id: string, kind: InvoicePreviewKind) {
    setPreviewKind(kind)
    setPreviewId(id)
  }

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
    if (!invoices) return []
    const enriched = invoices.map((inv) => ({
      ...inv,
      _status: getEffectiveStatus(inv),
      _overdue: daysOverdue(inv),
    }))
    // Default "urgent first" — overrideable by clicking column headers.
    return enriched.sort((a, b) => {
      if (a._overdue !== b._overdue) return b._overdue - a._overdue
      const am = a.data?.month ?? ''
      const bm = b.data?.month ?? ''
      return bm.localeCompare(am)
    })
  }, [invoices])

  const months = useMemo(() => {
    const set = new Set<string>()
    for (const inv of invoices ?? []) {
      const m = inv.data?.month
      if (m && /^\d{4}-\d{2}$/.test(m)) set.add(m)
    }
    return Array.from(set).sort().reverse()
  }, [invoices])

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        id: 'select',
        size: 28,
        enableSorting: false,
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomePageRowsSelected()
                ? 'indeterminate'
                : false
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label='เลือกทั้งหมดในหน้า'
            onClick={(e) => e.stopPropagation()}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label='เลือก'
            onClick={(e) => e.stopPropagation()}
          />
        ),
      },
      {
        id: 'no',
        accessorFn: (row) => getInvoiceDisplay(row),
        header: ({ column }) => <SortableHeader column={column}>เลขที่</SortableHeader>,
        cell: ({ row }) => {
          const v = getInvoiceDisplay(row.original)
          return (
            <div className='max-w-[170px]'>
              <span className='block truncate font-medium' title={v}>
                {v}
              </span>
              <span className='block text-xs tabular-nums text-muted-foreground'>
                {formatMonth(row.original.data?.month)}
              </span>
            </div>
          )
        },
      },
      {
        // ซ่อนไว้ (initialState columnVisibility) — เก็บไว้ให้ตัวกรอง "เดือน" ทำงาน
        id: 'month',
        accessorFn: (row) => row.data?.month ?? '',
        header: () => null,
        cell: () => null,
        filterFn: (row, _id, value) => {
          if (!value || value === 'all') return true
          return row.original.data?.month === value
        },
      },
      {
        id: 'tenant',
        accessorFn: (row) => `${row.data?.tenant ?? ''} ${row.data?.property ?? ''}`,
        header: ({ column }) => (
          <SortableHeader column={column}>ผู้เช่า / ทรัพย์สิน</SortableHeader>
        ),
        cell: ({ row }) => {
          const t = row.original.data?.tenant?.trim() || '—'
          const p = row.original.data?.property?.trim() || '—'
          const fu = row.original.data?.followUpDate?.trim()
          return (
            <div className='max-w-[230px]'>
              <span className='block truncate text-sm font-medium' title={t}>
                {t}
              </span>
              <span className='block truncate text-xs text-muted-foreground' title={p}>
                {p}
              </span>
              {fu && (
                <span className='mt-0.5 inline-flex items-center gap-1 rounded-sm bg-indigo-50 px-1.5 py-px text-[10px] font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'>
                  📅 {fu}
                </span>
              )}
            </div>
          )
        },
      },
      {
        id: 'rate',
        enableSorting: false,
        header: () => <span>ค่าเช่า·รอบ</span>,
        cell: ({ row }) => {
          const d = row.original.data ?? {}
          const isDeposit = (d.category ?? 'rent') === 'deposit'
          const base = Number(d.vatBase ?? d.total) || 0
          const freqText = isDeposit ? 'มัดจำ' : d.freqLabel?.trim() || ''
          return (
            <div>
              <span className='block text-sm tabular-nums'>
                {amt(base, { symbol: false, decimal: 0 })}
              </span>
              {freqText && (
                <span className='block text-xs text-muted-foreground'>{freqText}</span>
              )}
            </div>
          )
        },
      },
      {
        id: 'total',
        accessorFn: (row) => Number(row.data?.total) || 0,
        header: ({ column }) => <SortableHeader column={column}>ยอด</SortableHeader>,
        cell: ({ row }) => {
          const d = row.original.data ?? {}
          const totalV = Number(d.total) || 0
          const remaining = Number(d.remainingAmount ?? totalV) || 0
          const status = row.original._status
          return (
            <div className='text-right'>
              <span className='block text-sm font-medium tabular-nums'>
                {amt(totalV)}
              </span>
              {status === 'paid' ? (
                <span className='block text-xs text-emerald-600 dark:text-emerald-400'>
                  ชำระครบ
                </span>
              ) : status !== 'voided' && remaining > 0 && remaining < totalV ? (
                <span className='block text-xs tabular-nums text-amber-600 dark:text-amber-400'>
                  ค้าง {amt(remaining, { symbol: false, decimal: 0 })}
                </span>
              ) : null}
            </div>
          )
        },
      },
      {
        id: 'due',
        accessorFn: (row) => row.data?.dueDate ?? '',
        header: ({ column }) => <SortableHeader column={column}>ครบกำหนด</SortableHeader>,
        cell: ({ row }) => {
          const due = row.original.data?.dueDate?.trim() || '—'
          const overdue = row.original._overdue
          if (overdue > 0) {
            return (
              <span className='text-sm tabular-nums text-destructive'>
                {due} <span className='ml-1 text-xs'>(เกิน {overdue} วัน)</span>
              </span>
            )
          }
          return <span className='text-sm tabular-nums'>{due}</span>
        },
      },
      {
        id: 'status',
        accessorFn: (row) => row._status,
        header: ({ column }) => <SortableHeader column={column}>สถานะ</SortableHeader>,
        cell: ({ row }) => <StatusBadge status={row.original._status} />,
        filterFn: (row, _id, value) => {
          if (!value || value === 'all') return true
          if (value === 'overdue') return row.original._overdue > 0
          return row.original._status === value
        },
      },
      {
        id: 'actions',
        size: 96,
        enableSorting: false,
        header: () => <span className='sr-only'>การกระทำ</span>,
        cell: ({ row }) => {
          const st = row.original._status
          const isPaidLike = st === 'paid' || st === 'partial'
          return (
            <div className='flex items-center gap-0.5'>
              <Button
                size='icon'
                variant='ghost'
                className='size-7'
                title={isPaidLike ? 'ดูตัวอย่างใบเสร็จ' : 'ดูตัวอย่างใบแจ้งหนี้'}
                onClick={(e) => {
                  e.stopPropagation()
                  openPreview(
                    row.original.id,
                    isPaidLike ? 'receipt' : 'invoice',
                  )
                }}
              >
                <Eye className='size-4' />
              </Button>
              {st !== 'paid' && st !== 'voided' && (
                <Button
                  size='icon'
                  variant='ghost'
                  className='size-7 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400'
                  title='บันทึกรับเงิน'
                  onClick={(e) => {
                    e.stopPropagation()
                    setPayQuickId(row.original.id)
                  }}
                >
                  <Wallet className='size-4' />
                </Button>
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
    enableRowSelection: true,
    getRowId: (row) => row.id,
    initialState: { columnVisibility: { month: false } },
    state: { sorting, columnFilters, globalFilter, rowSelection },
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _id, filterValue) => {
      const v = String(filterValue ?? '').toLowerCase().trim()
      if (!v) return true
      const d = row.original.data
      const haystack = [
        d?.invoiceNo,
        d?.tenant,
        d?.landlord,
        d?.property,
        d?.dueDate,
        d?.month,
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

  const monthFilter =
    (columnFilters.find((f) => f.id === 'month')?.value as string) ?? 'all'
  const setMonthFilter = (value: string) => {
    setColumnFilters((prev) => [
      ...prev.filter((f) => f.id !== 'month'),
      ...(value && value !== 'all' ? [{ id: 'month', value }] : []),
    ])
  }

  const statusFilter =
    (columnFilters.find((f) => f.id === 'status')?.value as string) ?? 'all'
  const setStatusFilter = (value: string) => {
    setColumnFilters((prev) => [
      ...prev.filter((f) => f.id !== 'status'),
      ...(value && value !== 'all' ? [{ id: 'status', value }] : []),
    ])
  }

  const totalRows = invoices?.length ?? 0
  const filteredRows = table.getRowModel().rows.length

  /** v1-style running KPI totals computed from the currently filtered rows. */
  const kpi = useMemo(() => {
    const visible = table.getRowModel().rows.map((r) => r.original)
    let total = 0
    let paid = 0
    let unpaid = 0
    let overdueAmt = 0
    let paidCount = 0
    let unpaidCount = 0
    let overdueCount = 0
    for (const inv of visible) {
      const t = Number(inv.data?.total) || 0
      const remaining = Number(inv.data?.remainingAmount) || 0
      const paidAmt = Number(inv.data?.paidAmount) || 0
      total += t
      if (inv._status === 'paid') {
        paid += t
        paidCount++
      } else if (inv._status === 'voided') {
        // skip
      } else {
        const o = remaining > 0 ? remaining : t - paidAmt
        unpaid += o > 0 ? o : 0
        unpaidCount++
        if (inv._overdue > 0) {
          overdueAmt += o > 0 ? o : 0
          overdueCount++
        }
      }
    }
    return { total, paid, unpaid, overdueAmt, paidCount, unpaidCount, overdueCount, count: visible.length }
  }, [table.getRowModel().rows])
  const [genOpen, setGenOpen] = useState(false)
  const [voidOpen, setVoidOpen] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [batchPayOpen, setBatchPayOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const exportXlsx = useExportXlsx()
  const batchMarkSent = useBatchMarkSent()
  const batchVoid = useBatchVoid()
  const batchDelete = useBatchDeleteInvoices()
  const sendAllDrafts = useSendAllDraftsGlobal()
  const autoVoid = useAutoVoidExpiredDrafts()
  const { data: invSettings } = useInvoiceSettings()

  // Auto-void expired drafts once per session (on mount)
  const autoVoidRanRef = useRef(false)
  useEffect(() => {
    if (autoVoidRanRef.current) return
    autoVoidRanRef.current = true
    const enabled = invSettings?.draftVoidEnabled ?? true
    const days = invSettings?.draftVoidDays ?? 60
    autoVoid.mutate({ enabled, days })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original)
  const selectedIds = selectedRows.map((r) => r.id)
  const selectedCount = selectedIds.length
  const sumSelected = selectedRows.reduce(
    (s, r) => s + (Number(r.data?.total) || 0),
    0,
  )
  const draftSelectedIds = selectedRows
    .filter((r) => r._status === 'draft')
    .map((r) => r.id)
  const voidableSelectedIds = selectedRows
    .filter((r) => r._status !== 'voided')
    .map((r) => r.id)
  // Invoices eligible for batch payment (not yet fully paid / not voided)
  const payableSelectedRows = selectedRows.filter(
    (r) => r._status !== 'paid' && r._status !== 'voided',
  )

  async function handleBatchMarkSent() {
    if (draftSelectedIds.length === 0) return
    try {
      const res = await batchMarkSent.mutateAsync(draftSelectedIds)
      if (res.errors.length === 0) {
        toast.success(`บันทึกส่งแล้ว ${res.done} ใบ`)
      } else {
        toast.warning(`สำเร็จ ${res.done} · ผิดพลาด ${res.errors.length}`)
      }
      setRowSelection({})
    } catch (err) {
      toast.error('บันทึกส่งไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  async function handleBatchVoid() {
    if (voidableSelectedIds.length === 0) return
    try {
      const res = await batchVoid.mutateAsync({
        ids: voidableSelectedIds,
        reason: voidReason,
      })
      if (res.errors.length === 0) {
        toast.success(`ยกเลิกแล้ว ${res.done} ใบ`)
      } else {
        toast.warning(`สำเร็จ ${res.done} · ผิดพลาด ${res.errors.length}`)
      }
      setVoidOpen(false)
      setVoidReason('')
      setRowSelection({})
    } catch (err) {
      toast.error('ยกเลิกไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  async function handleBatchDelete() {
    if (selectedIds.length === 0) return
    try {
      const res = await batchDelete.mutateAsync(selectedIds)
      toast.success(`ลบแล้ว ${res.done} ใบ`)
      setDeleteOpen(false)
      setRowSelection({})
    } catch (err) {
      toast.error('ลบไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  function handleExport() {
    const visibleRows = table.getRowModel().rows.map((r) => {
      const inv = r.original
      const meta = getStatusMeta(inv._status)
      return {
        no: getInvoiceDisplay(inv),
        month: formatMonth(inv.data?.month),
        date: inv.data?.date ?? '',
        dueDate: inv.data?.dueDate ?? '',
        tenant: inv.data?.tenant ?? '',
        landlord: inv.data?.landlord ?? '',
        property: inv.data?.property ?? '',
        total: Number(inv.data?.total) || 0,
        paid: Number(inv.data?.paidAmount) || 0,
        remaining: Number(inv.data?.remainingAmount ?? inv.data?.total) || 0,
        status: meta.label,
        overdue: inv._overdue > 0 ? inv._overdue : '',
      }
    })
    void exportXlsx(
      xlsxFilename('ใบแจ้งหนี้'),
      [
        { header: 'เลขที่', key: 'no', width: 16 },
        { header: 'เดือน', key: 'month', width: 12 },
        { header: 'วันที่ออก', key: 'date', width: 12 },
        { header: 'วันครบกำหนด', key: 'dueDate', width: 14 },
        { header: 'ผู้เช่า', key: 'tenant', width: 28 },
        { header: 'ผู้ให้เช่า', key: 'landlord', width: 24 },
        { header: 'ทรัพย์สิน', key: 'property', width: 24 },
        { header: 'ยอด', key: 'total', width: 12 },
        { header: 'ชำระแล้ว', key: 'paid', width: 12 },
        { header: 'คงเหลือ', key: 'remaining', width: 12 },
        { header: 'สถานะ', key: 'status', width: 12 },
        { header: 'เกินกำหนด', key: 'overdue', width: 12 },
      ],
      visibleRows,
      { sheetName: 'ใบแจ้งหนี้' },
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
            <h2 className='text-2xl font-bold tracking-tight'>ใบแจ้งหนี้</h2>
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
            <Button variant='outline' onClick={() => setGenOpen(true)}>
              <Sparkles className='size-4' />
              สร้างรายเดือน
            </Button>
            <Button
              variant='outline'
              disabled={sendAllDrafts.isPending}
              onClick={async () => {
                try {
                  const res = await sendAllDrafts.mutateAsync()
                  if (res.done === 0) {
                    toast.info('ไม่มีใบร่างที่ยังไม่ได้ส่ง')
                  } else if (res.errors.length === 0) {
                    toast.success(`ส่งร่างทั้งหมดแล้ว ${res.done} ใบ`)
                  } else {
                    toast.warning(`ส่งสำเร็จ ${res.done} · ผิดพลาด ${res.errors.length}`)
                  }
                } catch (err) {
                  toast.error('ส่งร่างไม่สำเร็จ', { description: err instanceof Error ? err.message : String(err) })
                }
              }}
            >
              {sendAllDrafts.isPending ? (
                <Loader2 className='size-4 animate-spin' />
              ) : (
                <Send className='size-4' />
              )}
              ส่งร่างทั้งหมด
            </Button>
            <Button asChild>
              <Link to='/invoices/new'>
                <Plus className='size-4' />
                ออกใบแจ้งหนี้
              </Link>
            </Button>
          </div>
        </div>

        <GenerateMonthlyDialog open={genOpen} onOpenChange={setGenOpen} />

        <Tabs defaultValue='list'>
          <TabsList>
            <TabsTrigger value='list'>รายการ</TabsTrigger>
            <TabsTrigger value='slip-upload'>อัปโหลดสลิป</TabsTrigger>
          </TabsList>

          <TabsContent value='list' className='mt-4 space-y-4'>
            <div className='flex flex-wrap items-center gap-3'>
              <div className='relative max-w-sm flex-1'>
                <Search className='pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  placeholder='ค้น เลขที่ · ผู้เช่า · ทรัพย์สิน · เดือน...'
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  className='pl-9'
                />
              </div>
              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger className='w-[160px]'>
                  <SelectValue placeholder='ทุกเดือน' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>ทุกเดือน</SelectItem>
                  {months.map((m) => (
                    <SelectItem key={m} value={m}>
                      {formatMonth(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className='w-[160px]'>
                  <SelectValue placeholder='ทุกสถานะ' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>ทุกสถานะ</SelectItem>
                  <SelectItem value='overdue'>เกินกำหนด</SelectItem>
                  {INVOICE_STATUSES.filter((s) => s.value !== 'unknown').map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className='ml-auto text-sm text-muted-foreground'>
                {isLoading
                  ? 'กำลังโหลด...'
                  : `${filteredRows.toLocaleString('th-TH')} / ${totalRows.toLocaleString('th-TH')} ใบ`}
              </p>
            </div>

            {error && (
              <div className='rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive'>
                ดึงข้อมูลไม่สำเร็จ —{' '}
                {error instanceof Error ? error.message : String(error)}
              </div>
            )}

            {/* v1-style running totals · responds to filter + search */}
            {!isLoading && kpi.count > 0 && (
              <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
                <KpiCard
                  label='ทั้งหมด'
                  value={amt(kpi.total, { symbol: false, decimal: 0 })}
                  sub={`${kpi.count.toLocaleString('th-TH')} ใบ`}
                  tone='neutral'
                />
                <KpiCard
                  label='ชำระแล้ว'
                  value={amt(kpi.paid, { symbol: false, decimal: 0 })}
                  sub={`${kpi.paidCount.toLocaleString('th-TH')} ใบ`}
                  tone='success'
                />
                <KpiCard
                  label='ค้างชำระ'
                  value={amt(kpi.unpaid, { symbol: false, decimal: 0 })}
                  sub={`${kpi.unpaidCount.toLocaleString('th-TH')} ใบ`}
                  tone='warning'
                />
                <KpiCard
                  label='เกินกำหนด'
                  value={amt(kpi.overdueAmt, { symbol: false, decimal: 0 })}
                  sub={`${kpi.overdueCount.toLocaleString('th-TH')} ใบ`}
                  tone='destructive'
                />
              </div>
            )}

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
                            : flexRender(header.column.columnDef.header, header.getContext())}
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
                        <TableCell colSpan={table.getVisibleLeafColumns().length}>
                          <Skeleton className='h-8 w-full' />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : table.getRowModel().rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={table.getVisibleLeafColumns().length} className='h-32 text-center'>
                        <div className='flex flex-col items-center gap-2 text-muted-foreground'>
                          <Receipt className='size-8' />
                          <p>
                            {totalRows === 0
                              ? 'ยังไม่มีใบแจ้งหนี้'
                              : 'ไม่พบใบแจ้งหนี้ที่ตรงกับเงื่อนไข'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        className={cn(
                          'cursor-pointer',
                          row.original._overdue > 0
                            ? 'bg-red-50/60 hover:bg-red-100/60 dark:bg-red-950/20 dark:hover:bg-red-950/30'
                            : 'hover:bg-muted/40',
                          invoiceAccentStrip(
                            row.original._status,
                            row.original._overdue,
                          ),
                        )}
                        onClick={() =>
                          navigate({
                            to: '/invoices/$id',
                            params: { id: row.original.id },
                          })
                        }
                        onMouseEnter={(e) => onRowEnter(row.original, e)}
                        onMouseMove={(e) => {
                          if (hover && hover.row.id === row.original.id) {
                            setHover({
                              row: row.original,
                              x: e.clientX,
                              y: e.clientY,
                            })
                          }
                        }}
                        onMouseLeave={onRowLeave}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className='py-3'>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value='slip-upload' className='mt-4'>
            <SlipBatchUpload />
          </TabsContent>
        </Tabs>
      </Main>

      <InvoiceRowPreview
        id={previewId}
        kind={previewKind}
        onClose={() => setPreviewId(null)}
      />

      <CursorPopover
        open={!!hover}
        x={hover?.x ?? 0}
        y={hover?.y ?? 0}
      >
        {hover && <InvoiceHoverDetail invoice={hover.row} />}
      </CursorPopover>

      {/* Floating bulk action bar */}
      {selectedCount > 0 && (
        <div className='pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4'>
          <div className='pointer-events-auto flex flex-wrap items-center gap-3 rounded-full border bg-card/95 px-4 py-2 shadow-lg backdrop-blur'>
            <span className='text-sm font-semibold'>
              เลือก {selectedCount.toLocaleString('th-TH')} ใบ
            </span>
            <span className='text-xs text-muted-foreground tabular-nums'>
              · รวม {amt(sumSelected, { decimal: 0 })}
            </span>
            <span className='h-4 w-px bg-border' />
            <Button
              size='sm'
              variant='outline'
              disabled={payableSelectedRows.length === 0}
              onClick={() => setBatchPayOpen(true)}
              className='border-emerald-500 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-600 dark:text-emerald-400 dark:hover:bg-emerald-950/30'
            >
              <Wallet className='size-4' />
              รับเงิน
              {payableSelectedRows.length > 0 && ` (${payableSelectedRows.length})`}
            </Button>
            <Button
              size='sm'
              variant='outline'
              disabled={draftSelectedIds.length === 0 || batchMarkSent.isPending}
              onClick={handleBatchMarkSent}
            >
              {batchMarkSent.isPending ? (
                <Loader2 className='size-4 animate-spin' />
              ) : (
                <Send className='size-4' />
              )}
              บันทึกส่ง
              {draftSelectedIds.length > 0 && ` (${draftSelectedIds.length})`}
            </Button>
            <Button
              size='sm'
              variant='outline'
              disabled={voidableSelectedIds.length === 0 || batchVoid.isPending}
              onClick={() => setVoidOpen(true)}
            >
              <Ban className='size-4' />
              ยกเลิก
              {voidableSelectedIds.length > 0 && ` (${voidableSelectedIds.length})`}
            </Button>
            <Button
              size='sm'
              variant='outline'
              className='text-destructive hover:bg-destructive/10 hover:text-destructive'
              disabled={selectedCount === 0 || batchDelete.isPending}
              onClick={() => setDeleteOpen(true)}
            >
              {batchDelete.isPending ? (
                <Loader2 className='size-4 animate-spin' />
              ) : (
                <Trash2 className='size-4' />
              )}
              ลบ ({selectedCount})
            </Button>
            <BatchReceiptPrintButton invoices={selectedRows} />
            <span className='h-4 w-px bg-border' />
            <Button
              size='sm'
              variant='ghost'
              onClick={() => setRowSelection({})}
              aria-label='ล้างการเลือก'
            >
              <X className='size-4' />
            </Button>
          </div>
        </div>
      )}

      <BatchPaymentDialog
        open={batchPayOpen}
        onOpenChange={setBatchPayOpen}
        invoices={payableSelectedRows}
        onSuccess={() => setRowSelection({})}
      />

      {payQuickId && (() => {
        const inv = invoices?.find((x) => x.id === payQuickId)
        if (!inv) return null
        return (
          <QuickPaymentDialog
            invoice={inv}
            open={true}
            onOpenChange={(v) => { if (!v) setPayQuickId(null) }}
          />
        )
      })()}

      <AlertDialog open={voidOpen} onOpenChange={setVoidOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ยกเลิกใบแจ้งหนี้ {voidableSelectedIds.length} ใบ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              ใบที่ถูกยกเลิกแล้วจะถูกข้าม · กู้คืนได้ภายหลัง
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className='space-y-2'>
            <Label htmlFor='batchVoidReason'>เหตุผล</Label>
            <Textarea
              id='batchVoidReason'
              rows={3}
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder='เช่น ออกใบใหม่ · ผู้เช่ายกเลิกสัญญา · จ่ายแล้วช่องทางอื่น...'
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={batchVoid.isPending}>ปิด</AlertDialogCancel>
            <AlertDialogAction
              disabled={batchVoid.isPending}
              onClick={handleBatchVoid}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {batchVoid.isPending && <Loader2 className='size-4 animate-spin' />}
              ยกเลิก {voidableSelectedIds.length} ใบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch delete dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบใบแจ้งหนี้ {selectedCount} ใบถาวร?</AlertDialogTitle>
            <AlertDialogDescription>
              ลบแล้วกู้คืนไม่ได้ · เงินที่จับคู่ไว้จะถูกปลดออก (เงินไม่หาย กลับเป็น “ยังไม่จับคู่”)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ปิด</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchDelete}
              disabled={batchDelete.isPending}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {batchDelete.isPending ? 'กำลังลบ…' : `ลบถาวร ${selectedCount} ใบ`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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

function InvoiceHoverDetail({ invoice }: { invoice: Row }) {
  const d = invoice.data ?? {}
  const overdue = invoice._overdue
  const isDeposit = (d.category ?? 'rent') === 'deposit'
  const items: { icon: typeof Calendar; label: string; value: string }[] = []
  if (d.tenant) items.push({ icon: UserRound, label: 'ผู้เช่า', value: String(d.tenant) })
  if (d.property)
    items.push({ icon: Building2, label: 'ทรัพย์สิน', value: String(d.property) })
  if (d.date) items.push({ icon: Calendar, label: 'วันที่ออก', value: String(d.date) })
  if (d.dueDate) items.push({ icon: Calendar, label: 'กำหนดชำระ', value: String(d.dueDate) })
  if (d.total != null) {
    items.push({
      icon: CreditCard,
      label: 'ยอดรวม',
      value: `${amt(d.total as number, { symbol: false, decimal: 0 })} บาท`,
    })
  }
  if (d.paidAmount != null && d.paidAmount > 0) {
    items.push({
      icon: CreditCard,
      label: 'ชำระแล้ว',
      value: `${amt(d.paidAmount as number, { symbol: false, decimal: 0 })} บาท`,
    })
  }
  if (d.remainingAmount != null && d.remainingAmount > 0) {
    items.push({
      icon: CreditCard,
      label: 'ค้างชำระ',
      value: `${amt(d.remainingAmount as number, { symbol: false, decimal: 0 })} บาท`,
    })
  }
  if (d.followUpDate) {
    items.push({ icon: Calendar, label: 'นัดติดตาม', value: String(d.followUpDate) })
  }
  const note = (d as { note?: string }).note
  const lineItems = d.items ?? []
  const paidAmount = Number(d.paidAmount ?? 0)
  return (
    <div className='space-y-2 text-xs'>
      <div className='flex flex-wrap items-center gap-1.5 border-b pb-2'>
        <Receipt className='size-4 text-muted-foreground' />
        <span className='font-semibold'>{getInvoiceDisplay(invoice)}</span>
        <StatusBadge status={invoice._status} />
        {overdue > 0 && (
          <Badge variant='outline' className={cn('text-[10px]', STATUS_TONE_CLASS.destructive)}>
            เกิน {overdue} วัน
          </Badge>
        )}
        {isDeposit && <Badge variant='outline' className='text-[10px]'>มัดจำ</Badge>}
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
      </div>
      {lineItems.length > 0 && (
        <div className='space-y-0.5 border-t pt-1.5'>
          <p className='text-[10px] uppercase tracking-wider text-muted-foreground'>รายการ</p>
          {lineItems.slice(0, 4).map((it, i) => (
            <div key={i} className='flex justify-between gap-2'>
              <span className='truncate'>{it.desc}</span>
              <span className='tabular-nums'>
                {amt(it.amount, { symbol: false, decimal: 2 })}
              </span>
            </div>
          ))}
          {lineItems.length > 4 && (
            <p className='text-[10px] text-muted-foreground'>
              ... อีก {lineItems.length - 4} รายการ
            </p>
          )}
        </div>
      )}
      {paidAmount > 0 && (
        <div className='flex justify-between gap-2 border-t pt-1.5'>
          <span className='text-[10px] uppercase tracking-wider text-muted-foreground'>
            ชำระแล้ว
          </span>
          <span className='tabular-nums text-emerald-700 dark:text-emerald-400'>
            {amt(paidAmount, { symbol: false, decimal: 2 })}
          </span>
        </div>
      )}
      {note && (
        <div className='flex items-start gap-2 border-t pt-1.5'>
          <StickyNote className='mt-0.5 size-3.5 shrink-0 text-muted-foreground' />
          <p className='leading-snug whitespace-pre-wrap'>{String(note)}</p>
        </div>
      )}
    </div>
  )
}
