import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Download, FileText } from 'lucide-react'
import { useMemo } from 'react'
import { useExportXlsx, xlsxFilename } from '@/hooks/use-xlsx'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  daysOverdue,
  formatMonth,
  getInvoiceDisplay,
  useInvoices,
} from '@/features/invoices/queries'
import type { Invoice } from '@/features/invoices/types'
import { amt } from '@/lib/thai'

type Bucket = {
  key: 'current' | 'd30' | 'd60' | 'd90' | 'over90'
  label: string
  tone: string
  invoices: Invoice[]
}

const BUCKET_TONE: Record<Bucket['key'], { bg: string; text: string; dot: string }> = {
  current: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  d30: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    text: 'text-amber-800 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  d60: {
    bg: 'bg-orange-500/10 dark:bg-orange-500/15',
    text: 'text-orange-800 dark:text-orange-300',
    dot: 'bg-orange-500',
  },
  d90: {
    bg: 'bg-red-500/10 dark:bg-red-500/15',
    text: 'text-red-700 dark:text-red-300',
    dot: 'bg-red-500',
  },
  over90: {
    bg: 'bg-red-800/15 dark:bg-red-900/30',
    text: 'text-red-900 dark:text-red-200',
    dot: 'bg-red-800',
  },
}

function bucketOf(inv: Invoice): Bucket['key'] {
  const overdue = daysOverdue(inv)
  if (overdue <= 0) return 'current'
  if (overdue <= 30) return 'd30'
  if (overdue <= 60) return 'd60'
  if (overdue <= 90) return 'd90'
  return 'over90'
}

export function AgingReport() {
  const navigate = useNavigate()
  const { data: invoices, isLoading } = useInvoices()

  const buckets = useMemo<Bucket[]>(() => {
    const seed: Bucket[] = [
      { key: 'current', label: 'ยังไม่ถึงกำหนด', tone: BUCKET_TONE.current.text, invoices: [] },
      { key: 'd30', label: 'เกิน 1-30 วัน', tone: BUCKET_TONE.d30.text, invoices: [] },
      { key: 'd60', label: 'เกิน 31-60 วัน', tone: BUCKET_TONE.d60.text, invoices: [] },
      { key: 'd90', label: 'เกิน 61-90 วัน', tone: BUCKET_TONE.d90.text, invoices: [] },
      { key: 'over90', label: 'เกิน 90 วัน', tone: BUCKET_TONE.over90.text, invoices: [] },
    ]
    if (!invoices) return seed
    // Skip paid + voided · only outstanding
    const outstanding = invoices.filter((inv) => {
      const status = (inv.status ?? inv.data?.status ?? '').toLowerCase()
      return status !== 'paid' && status !== 'voided'
    })
    outstanding.forEach((inv) => {
      const key = bucketOf(inv)
      const b = seed.find((x) => x.key === key)
      if (b) b.invoices.push(inv)
    })
    return seed
  }, [invoices])

  const sumBucket = (b: Bucket) =>
    b.invoices.reduce((s, i) => s + (Number(i.data?.remainingAmount ?? i.data?.total) || 0), 0)
  const totalOutstanding = buckets.reduce((s, b) => s + sumBucket(b), 0)
  const totalCount = buckets.reduce((s, b) => s + b.invoices.length, 0)

  const exportXlsx = useExportXlsx()
  function handleExport() {
    const rows: Array<Record<string, unknown>> = []
    for (const b of buckets) {
      for (const inv of b.invoices) {
        rows.push({
          bucket: b.label,
          no: getInvoiceDisplay(inv),
          month: formatMonth(inv.data?.month),
          tenant: inv.data?.tenant ?? '',
          property: inv.data?.property ?? '',
          dueDate: inv.data?.dueDate ?? '',
          remaining: Number(inv.data?.remainingAmount ?? inv.data?.total) || 0,
          overdue: daysOverdue(inv) > 0 ? daysOverdue(inv) : '',
        })
      }
    }
    void exportXlsx(
      xlsxFilename('อายุหนี้'),
      [
        { header: 'กลุ่ม', key: 'bucket', width: 16 },
        { header: 'เลขที่', key: 'no', width: 16 },
        { header: 'เดือน', key: 'month', width: 12 },
        { header: 'ผู้เช่า', key: 'tenant', width: 28 },
        { header: 'ทรัพย์สิน', key: 'property', width: 24 },
        { header: 'วันครบกำหนด', key: 'dueDate', width: 14 },
        { header: 'ค้างชำระ', key: 'remaining', width: 14 },
        { header: 'เกิน', key: 'overdue', width: 10 },
      ],
      rows,
      { sheetName: 'อายุหนี้' },
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

      <Main className='flex flex-1 flex-col gap-6'>
        <header className='flex flex-wrap items-center justify-between gap-3'>
          <div className='flex items-center gap-3'>
            <button
              type='button'
              onClick={() => navigate({ to: '/invoices' })}
              className='inline-flex size-9 items-center justify-center rounded-md hover:bg-muted'
              aria-label='กลับ'
            >
              <ArrowLeft className='size-4' />
            </button>
            <div>
              <h1 className='text-2xl font-bold tracking-tight'>รายงานอายุหนี้</h1>
              <p className='text-sm text-muted-foreground'>
                ลูกหนี้ค้างชำระจัดกลุ่มตามวันที่เกินกำหนด · ไม่นับใบที่ชำระแล้ว
                หรือยกเลิก
              </p>
            </div>
          </div>
          <Button
            variant='outline'
            onClick={handleExport}
            disabled={totalCount === 0}
          >
            <Download className='size-4' />
            Export Excel
          </Button>
        </header>

        {isLoading ? (
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-5'>
            {Array.from({ length: 5 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
              <Skeleton key={`sk-${i}`} className='h-24' />
            ))}
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-5'>
              {buckets.map((b) => {
                const tone = BUCKET_TONE[b.key]
                const total = sumBucket(b)
                return (
                  <div
                    key={b.key}
                    className={`rounded-md border p-4 ${tone.bg}`}
                  >
                    <p className={`text-xs font-semibold ${tone.text}`}>
                      {b.label}
                    </p>
                    <p className={`mt-1 text-2xl font-bold tabular-nums ${tone.text}`}>
                      {amt(total, { symbol: false, decimal: 0 })}
                    </p>
                    <p className='mt-1 text-xs text-muted-foreground'>
                      {b.invoices.length} ใบ
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Grand total */}
            <div className='flex items-center justify-between rounded-md border bg-card p-4'>
              <div>
                <p className='text-sm text-muted-foreground'>ยอดค้างชำระทั้งหมด</p>
                <p className='text-xs text-muted-foreground'>
                  {totalCount.toLocaleString('th-TH')} ใบ
                </p>
              </div>
              <p className='text-2xl font-bold tabular-nums'>
                {amt(totalOutstanding, { decimal: 0 })}
              </p>
            </div>

            {/* Detail per bucket */}
            {buckets
              .filter((b) => b.invoices.length > 0)
              .map((b) => {
                const tone = BUCKET_TONE[b.key]
                return (
                  <section key={b.key} className='space-y-2'>
                    <div className='flex items-center gap-2'>
                      <span className={`size-2 rounded-full ${tone.dot}`} />
                      <h2 className={`text-base font-semibold ${tone.text}`}>
                        {b.label}
                      </h2>
                      <span className='text-sm text-muted-foreground'>
                        ({b.invoices.length} ใบ · {amt(sumBucket(b), { decimal: 0 })})
                      </span>
                    </div>
                    <div className='overflow-hidden rounded-md border bg-card'>
                      {b.invoices
                        .sort((a, z) => daysOverdue(z) - daysOverdue(a))
                        .map((inv, i) => (
                          <Link
                            key={inv.id}
                            to='/invoices/$id'
                            params={{ id: inv.id }}
                            className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-muted/40 ${
                              i > 0 ? 'border-t' : ''
                            }`}
                          >
                            <div className='flex min-w-0 items-center gap-3'>
                              <FileText className='size-4 shrink-0 text-muted-foreground' />
                              <div className='min-w-0'>
                                <p className='truncate font-medium'>
                                  {getInvoiceDisplay(inv)}
                                  <span className='ms-2 text-muted-foreground'>
                                    · {formatMonth(inv.data?.month)}
                                  </span>
                                </p>
                                <p className='truncate text-xs text-muted-foreground'>
                                  {inv.data?.tenant?.trim() || '—'}
                                  {inv.data?.property
                                    ? ` · ${inv.data.property}`
                                    : ''}
                                </p>
                              </div>
                            </div>
                            <div className='flex shrink-0 items-center gap-3 text-right'>
                              {daysOverdue(inv) > 0 && (
                                <span className={`text-xs font-medium ${tone.text}`}>
                                  เกิน {daysOverdue(inv)} วัน
                                </span>
                              )}
                              <span className='font-semibold tabular-nums'>
                                {amt(inv.data?.remainingAmount ?? inv.data?.total, {
                                  decimal: 0,
                                })}
                              </span>
                            </div>
                          </Link>
                        ))}
                    </div>
                  </section>
                )
              })}
          </>
        )}
      </Main>
    </>
  )
}
