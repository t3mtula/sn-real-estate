import { Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  FileText,
  ListChecks,
  Receipt,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { QuickPaymentDialog } from '@/features/invoices/payment-panel'
import {
  getContractStatus,
  useContracts,
} from '@/features/contracts/queries'
import { useProperties } from '@/features/properties/queries'
import {
  daysOverdue,
  formatMonth,
  getInvoiceDisplay,
  isContractDueForMonth,
  useInvoices,
} from '@/features/invoices/queries'
import type { Contract } from '@/features/contracts/types'
import type { Invoice } from '@/features/invoices/types'
import { amt, parseBE } from '@/lib/thai'
import { cn } from '@/lib/utils'

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Monthly revenue per contract.
 *
 * Resolution order (most authoritative first):
 *   1. data.monthlyBaht  — pre-computed by v1 (present in ~131/144 rows)
 *   2. data.rateAmount + data.rateFreq — structured v2 native
 *   3. data.rate string parsing with keyword normalization (legacy)
 *   4. last-resort: amount / durMonths if string looks like lump-sum
 */
function monthlyRev(c: Contract): number {
  const d = c.data
  if (!d) return 0
  // 1. Prefer pre-computed monthlyBaht (v1's calc)
  const mb = Number((d as any).monthlyBaht)
  if (!isNaN(mb) && mb > 0) return mb
  // 2. Use structured rateAmount + rateFreq if available
  const ra = Number((d as any).rateAmount)
  if (!isNaN(ra) && ra > 0) {
    const rf = (d as any).rateFreq as string | undefined
    if (rf === 'annual' || rf === 'yearly') return ra / 12
    if (rf === 'quarterly') return ra / 3
    if (rf === 'semiannual' || rf === 'semi') return ra / 6
    if (rf === 'lump') {
      const dm = Number((d as any).durMonths) || Number(d.dur) || 0
      return dm > 0 ? ra / dm : 0
    }
    return ra // 'monthly' or unspecified default
  }
  // 3. Fall back to string parsing (existing logic for legacy data)
  const raw = d.rate
  if (raw == null) return 0
  if (typeof raw === 'number' && !isNaN(raw)) return raw
  const str = String(raw)
  const match = str.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/)
  if (!match) return 0
  const amount = parseFloat(match[1])
  if (isNaN(amount) || amount <= 0) return 0
  if (/ปีละ|รายปี|ต่อปี/.test(str)) return amount / 12
  if (/ไตรมาส|ทุก 3 เดือน|รายไตรมาส/.test(str)) return amount / 3
  if (/ครึ่งปี|6 เดือน|ทุก 6 เดือน/.test(str)) return amount / 6
  // Last resort for lump-sum: average over duration
  const dm = Number((d as any).durMonths) || Number(d.dur) || 0
  if (dm > 1 && /ลำพ|ทั้งหมด|วันเซ็น|ครั้งเดียว/.test(str)) {
    return amount / dm
  }
  return amount
}

type KpiTone = 'primary' | 'success' | 'warning' | 'destructive' | 'info' | 'neutral'

const TONE: Record<KpiTone, { bg: string; text: string; icon: string }> = {
  primary: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    icon: 'text-primary',
  },
  success: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    text: 'text-amber-800 dark:text-amber-300',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  destructive: {
    bg: 'bg-red-500/10 dark:bg-red-500/15',
    text: 'text-red-700 dark:text-red-300',
    icon: 'text-red-600 dark:text-red-400',
  },
  info: {
    bg: 'bg-sky-500/10 dark:bg-sky-500/15',
    text: 'text-sky-700 dark:text-sky-300',
    icon: 'text-sky-600 dark:text-sky-400',
  },
  neutral: {
    bg: 'bg-muted/40',
    text: 'text-foreground',
    icon: 'text-muted-foreground',
  },
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'neutral',
  to,
}: {
  label: string
  value: string | number
  sub?: string
  icon: typeof Building2
  tone?: KpiTone
  to?: string
}) {
  const t = TONE[tone]
  const Wrapper = to
    ? ({ children }: { children: React.ReactNode }) => (
        <Link
          to={to}
          className={cn(
            'group block rounded-md border p-4 transition hover:shadow-sm',
            t.bg,
          )}
        >
          {children}
        </Link>
      )
    : ({ children }: { children: React.ReactNode }) => (
        <div className={cn('rounded-md border p-4', t.bg)}>{children}</div>
      )
  return (
    <Wrapper>
      <div className='flex items-start justify-between gap-2'>
        <p className={cn('text-xs font-semibold', t.text)}>{label}</p>
        <Icon className={cn('size-4', t.icon)} />
      </div>
      <p className={cn('mt-2 text-3xl font-bold tabular-nums', t.text)}>
        {typeof value === 'number' ? value.toLocaleString('th-TH') : value}
      </p>
      {sub && (
        <p className='mt-1 text-xs text-muted-foreground'>{sub}</p>
      )}
      {to && (
        <p className={cn(
          'mt-1 inline-flex items-center gap-1 text-xs',
          t.text,
          'opacity-70 group-hover:opacity-100',
        )}>
          ดูทั้งหมด <ArrowRight className='size-3' />
        </p>
      )}
    </Wrapper>
  )
}

export function Dashboard() {
  const { data: contracts, isLoading: lcContracts } = useContracts()
  const { data: invoices, isLoading: lcInvoices } = useInvoices()
  const { data: properties, isLoading: lcProps } = useProperties()
  const isLoading = lcContracts || lcInvoices || lcProps
  const [payQuickId, setPayQuickId] = useState<string | null>(null)

  const stats = useMemo(() => {
    const cs = contracts ?? []
    const ivs = invoices ?? []
    const ps = properties ?? []
    const month = currentMonth()

    // Contract buckets
    const active: Contract[] = []
    const expiring: Contract[] = []
    const expired: Contract[] = []
    for (const c of cs) {
      if (c.data?.cancelled) continue
      const s = getContractStatus(c.data)
      if (s === 'active' || s === 'expiring') active.push(c)
      if (s === 'expiring') expiring.push(c)
      if (s === 'expired') expired.push(c)
    }

    // Monthly revenue (sum across active)
    const monthlyRevenue = active.reduce((s, c) => s + monthlyRev(c), 0)

    // Occupancy
    const totalProps = ps.length
    const occupiedSet = new Set<number>()
    for (const c of cs) {
      if (c.data?.cancelled) continue
      const s = getContractStatus(c.data)
      if (s === 'active' || s === 'expiring' || s === 'upcoming') {
        const pid = c.data?.pid_property ?? (c.data as any)?.pid
        if (pid != null) occupiedSet.add(Number(pid))
      }
    }
    const occupied = occupiedSet.size
    const occupancy = totalProps > 0 ? Math.round((occupied / totalProps) * 100) : 0

    // Outstanding invoices
    const outstanding = ivs.filter((iv) => {
      const st = (iv.status ?? iv.data?.status ?? '').toLowerCase()
      return st !== 'paid' && st !== 'voided'
    })
    const overdueIvs = outstanding.filter((iv) => daysOverdue(iv) > 0)
    const overdueAmount = overdueIvs.reduce(
      (s, iv) => s + (Number(iv.data?.remainingAmount ?? iv.data?.total) || 0),
      0,
    )
    const outstandingAmount = outstanding.reduce(
      (s, iv) => s + (Number(iv.data?.remainingAmount ?? iv.data?.total) || 0),
      0,
    )

    // Active contracts not invoiced this month
    const nowDue = active.filter((c) =>
      isContractDueForMonth(c.data, month),
    )
    const nowDueInvoiced = new Set(
      ivs
        .filter((iv) => iv.data?.month === month)
        .map((iv) => iv.contract_id)
        .filter(Boolean) as string[],
    )
    const notInvoicedThisMonth = nowDue.filter(
      (c) => !nowDueInvoiced.has(c.id),
    )

    return {
      active,
      expiring,
      expired,
      monthlyRevenue,
      totalProps,
      occupied,
      occupancy,
      overdueIvs,
      overdueAmount,
      outstandingCount: outstanding.length,
      outstandingAmount,
      notInvoicedThisMonth,
      month,
    }
  }, [contracts, invoices, properties])

  // Top overdue list (max 5)
  const topOverdue = useMemo(() => {
    return [...stats.overdueIvs]
      .sort((a, b) => daysOverdue(b) - daysOverdue(a))
      .slice(0, 5)
  }, [stats.overdueIvs])


  // Top expiring list (max 5, sorted by end date asc)
  const topExpiring = useMemo(() => {
    return [...stats.expiring]
      .map((c) => {
        const e = parseBE(c.data?.end ?? '')
        return { c, end: e?.toDate().getTime() ?? Number.MAX_SAFE_INTEGER }
      })
      .sort((a, b) => a.end - b.end)
      .slice(0, 5)
      .map((x) => x.c)
  }, [stats.expiring])

  // Top not-invoiced-this-month list (max 5)
  const topNotInvoiced = useMemo(
    () => stats.notInvoicedThisMonth.slice(0, 5),
    [stats.notInvoicedThisMonth],
  )

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-6'>
        <header>
          <h1 className='text-2xl font-bold tracking-tight'>แดชบอร์ด</h1>
          <p className='text-sm text-muted-foreground'>
            ภาพรวมเดือน {formatMonth(stats.month)} · สัญญา ใบแจ้งหนี้ ทรัพย์สิน
          </p>
        </header>

        {isLoading ? (
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
            {Array.from({ length: 8 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
              <Skeleton key={`sk-${i}`} className='h-28' />
            ))}
          </div>
        ) : (
          <>
            {/* งานวันนี้ — top priority queue · 3 columns */}
            <TodayPanel
              overdue={topOverdue}
              expiring={topExpiring}
              notInvoiced={topNotInvoiced}
              onQuickPay={setPayQuickId}
            />

            {/* Top row · ภาพรวม + เงิน */}
            <section className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
              <KpiCard
                label='ยอดเช่าต่อเดือน'
                value={amt(stats.monthlyRevenue, { decimal: 0 })}
                sub={`จากสัญญา ${stats.active.length.toLocaleString('th-TH')} ฉบับ`}
                icon={TrendingUp}
                tone='primary'
              />
              <KpiCard
                label='ค้างชำระทั้งหมด'
                value={amt(stats.outstandingAmount, { decimal: 0 })}
                sub={`${stats.outstandingCount.toLocaleString('th-TH')} ใบ ยังไม่ปิดยอด`}
                icon={Wallet}
                tone={stats.outstandingCount > 0 ? 'warning' : 'success'}
                to='/reports/aging'
              />
              <KpiCard
                label='เกินกำหนด'
                value={amt(stats.overdueAmount, { decimal: 0 })}
                sub={`${stats.overdueIvs.length.toLocaleString('th-TH')} ใบ`}
                icon={AlertTriangle}
                tone={stats.overdueIvs.length > 0 ? 'destructive' : 'success'}
                to='/invoices'
              />
              <KpiCard
                label='อัตราเข้าใช้'
                value={`${stats.occupancy}%`}
                sub={`${stats.occupied.toLocaleString('th-TH')} / ${stats.totalProps.toLocaleString('th-TH')} ทรัพย์สิน`}
                icon={Building2}
                tone='info'
                to='/properties'
              />
            </section>

            {/* Second row · ปริมาณ */}
            <section className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
              <KpiCard
                label='สัญญา active'
                value={stats.active.length}
                icon={FileText}
                tone='success'
                to='/contracts'
              />
              <KpiCard
                label='สัญญาใกล้หมด (90 วัน)'
                value={stats.expiring.length}
                icon={CalendarClock}
                tone='warning'
                to='/contracts/renewals'
              />
              <KpiCard
                label='สัญญาหมดอายุแล้ว'
                value={stats.expired.length}
                icon={AlertTriangle}
                tone='destructive'
                to='/contracts'
              />
              <KpiCard
                label='ยังไม่ออกใบเดือนนี้'
                value={stats.notInvoicedThisMonth.length}
                sub={`เดือน ${formatMonth(stats.month)}`}
                icon={Receipt}
                tone={stats.notInvoicedThisMonth.length > 0 ? 'info' : 'success'}
                to='/invoices'
              />
            </section>

            {/* Drill-downs · 2 columns */}
            <section className='grid gap-4 lg:grid-cols-2'>
              {/* Overdue */}
              <div className='rounded-md border bg-card'>
                <div className='flex items-center justify-between border-b px-4 py-3'>
                  <div className='flex items-center gap-2'>
                    <AlertTriangle className='size-4 text-red-600 dark:text-red-400' />
                    <h2 className='text-sm font-semibold'>ใบแจ้งที่เกินกำหนด</h2>
                  </div>
                  <Link
                    to='/reports/aging'
                    className='text-xs text-muted-foreground hover:text-foreground'
                  >
                    ดูรายงานอายุหนี้ <ArrowRight className='ml-0.5 inline size-3' />
                  </Link>
                </div>
                {topOverdue.length === 0 ? (
                  <div className='flex flex-col items-center justify-center gap-1 px-4 py-10 text-sm text-muted-foreground'>
                    <CheckCircle2 className='size-6 text-emerald-500' />
                    <span>ไม่มีใบแจ้งที่เกินกำหนด</span>
                  </div>
                ) : (
                  topOverdue.map((iv, i) => (
                    <OverdueRow key={iv.id} inv={iv} isLast={i === topOverdue.length - 1} />
                  ))
                )}
              </div>

              {/* Expiring */}
              <div className='rounded-md border bg-card'>
                <div className='flex items-center justify-between border-b px-4 py-3'>
                  <div className='flex items-center gap-2'>
                    <CalendarClock className='size-4 text-amber-600 dark:text-amber-400' />
                    <h2 className='text-sm font-semibold'>สัญญาใกล้หมด (≤ 90 วัน)</h2>
                  </div>
                  <Link
                    to='/contracts/renewals'
                    className='text-xs text-muted-foreground hover:text-foreground'
                  >
                    ดูทั้งหมด <ArrowRight className='ml-0.5 inline size-3' />
                  </Link>
                </div>
                {topExpiring.length === 0 ? (
                  <div className='flex flex-col items-center justify-center gap-1 px-4 py-10 text-sm text-muted-foreground'>
                    <CheckCircle2 className='size-6 text-emerald-500' />
                    <span>ไม่มีสัญญาที่จะหมดในช่วงนี้</span>
                  </div>
                ) : (
                  topExpiring.map((c, i) => (
                    <ExpiringRow key={c.id} c={c} isLast={i === topExpiring.length - 1} />
                  ))
                )}
              </div>
            </section>
          </>
        )}
      </Main>

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
    </>
  )
}

/** "งานวันนี้" top-of-dashboard panel — 3 priority queues with quick actions. */
function TodayPanel({
  overdue,
  expiring,
  notInvoiced,
  onQuickPay,
}: {
  overdue: Invoice[]
  expiring: Contract[]
  notInvoiced: Contract[]
  onQuickPay: (id: string) => void
}) {
  const totalCount = overdue.length + expiring.length + notInvoiced.length
  return (
    <section className='rounded-lg border bg-card'>
      <div className='flex items-center gap-2 border-b px-4 py-3'>
        <ListChecks className='size-4 text-primary' />
        <h2 className='text-sm font-semibold'>งานวันนี้</h2>
        <span className='text-xs text-muted-foreground'>
          {totalCount === 0 ? 'ไม่มีงานเร่งด่วน' : `${totalCount.toLocaleString('th-TH')} รายการเร่งด่วน`}
        </span>
      </div>
      <div className='grid gap-0 lg:grid-cols-3 lg:divide-x'>
        {/* Overdue */}
        <TodayColumn
          tone='destructive'
          icon={<AlertTriangle className='size-3.5' />}
          title='บิลเกินกำหนด'
          count={overdue.length}
          empty='ไม่มีบิลเกินกำหนด'
        >
          {overdue.map((iv) => {
            const days = daysOverdue(iv)
            const amount = iv.data?.remainingAmount ?? iv.data?.total
            return (
              <div
                key={iv.id}
                className='flex items-center gap-2 border-b px-3 py-2 last:border-b-0 hover:bg-muted/40'
              >
                <Link
                  to='/invoices/$id'
                  params={{ id: iv.id }}
                  className='min-w-0 flex-1'
                >
                  <p className='truncate text-sm font-medium'>
                    {iv.data?.tenant?.trim() || '—'}
                  </p>
                  <p className='truncate text-xs text-muted-foreground'>
                    {amt(amount, { decimal: 0 })} · เกิน {days} วัน
                  </p>
                </Link>
                <Button
                  size='sm'
                  variant='outline'
                  className='h-7 shrink-0 border-emerald-500/40 text-xs text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300'
                  onClick={() => onQuickPay(iv.id)}
                >
                  <Wallet className='size-3' />
                  รับเงิน
                </Button>
              </div>
            )
          })}
        </TodayColumn>

        {/* Expiring (≤30 days) */}
        <TodayColumn
          tone='warning'
          icon={<CalendarClock className='size-3.5' />}
          title='สัญญาใกล้หมด (≤30 วัน)'
          count={expiring.length}
          empty='ไม่มีสัญญาที่จะหมดเร็วๆ นี้'
        >
          {expiring.map((c) => {
            const end = parseBE(c.data?.end ?? '')
            const daysLeft = end
              ? Math.ceil((end.toDate().getTime() - Date.now()) / 86_400_000)
              : 0
            return (
              <div
                key={c.id}
                className='flex items-center gap-2 border-b px-3 py-2 last:border-b-0 hover:bg-muted/40'
              >
                <Link
                  to='/contracts/$id'
                  params={{ id: c.id }}
                  className='min-w-0 flex-1'
                >
                  <p className='truncate text-sm font-medium'>
                    {c.data?.tenant?.trim() || '—'}
                  </p>
                  <p className='truncate text-xs text-muted-foreground'>
                    เหลือ {daysLeft} วัน · สิ้นสุด {c.data?.end || '—'}
                  </p>
                </Link>
                <Button
                  size='sm'
                  variant='outline'
                  className='h-7 shrink-0 border-amber-500/40 text-xs text-amber-700 hover:bg-amber-500/10 dark:text-amber-300'
                  asChild
                >
                  <Link to='/contracts/$id' params={{ id: c.id }}>
                    <Sparkles className='size-3' />
                    ต่ออายุ
                  </Link>
                </Button>
              </div>
            )
          })}
        </TodayColumn>

        {/* Not invoiced this month */}
        <TodayColumn
          tone='info'
          icon={<Receipt className='size-3.5' />}
          title='ยังไม่ออกใบเดือนนี้'
          count={notInvoiced.length}
          empty='ออกใบครบทุกสัญญาแล้ว'
        >
          {notInvoiced.map((c) => {
            const month = (() => {
              const d = new Date()
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            })()
            return (
              <div
                key={c.id}
                className='flex items-center gap-2 border-b px-3 py-2 last:border-b-0 hover:bg-muted/40'
              >
                <Link
                  to='/contracts/$id'
                  params={{ id: c.id }}
                  className='min-w-0 flex-1'
                >
                  <p className='truncate text-sm font-medium'>
                    {c.data?.tenant?.trim() || '—'}
                  </p>
                  <p className='truncate text-xs text-muted-foreground'>
                    {String((c.data as any)?.property ?? '').trim() || (c.data?.no?.trim() || `#${c.id}`)}
                  </p>
                </Link>
                <Button
                  size='sm'
                  variant='outline'
                  className='h-7 shrink-0 border-sky-500/40 text-xs text-sky-700 hover:bg-sky-500/10 dark:text-sky-300'
                  asChild
                >
                  <Link
                    to='/invoices/new'
                    search={{ contract: c.id, month }}
                  >
                    <Receipt className='size-3' />
                    ออกบิล
                  </Link>
                </Button>
              </div>
            )
          })}
        </TodayColumn>
      </div>
    </section>
  )
}

const TODAY_TONE: Record<string, { badge: string; header: string }> = {
  destructive: {
    badge: 'bg-red-500/10 text-red-700 dark:text-red-300',
    header: 'text-red-700 dark:text-red-300',
  },
  warning: {
    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    header: 'text-amber-700 dark:text-amber-300',
  },
  info: {
    badge: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
    header: 'text-sky-700 dark:text-sky-300',
  },
}

function TodayColumn({
  tone,
  icon,
  title,
  count,
  empty,
  children,
}: {
  tone: 'destructive' | 'warning' | 'info'
  icon: React.ReactNode
  title: string
  count: number
  empty: string
  children: React.ReactNode
}) {
  const t = TODAY_TONE[tone]
  return (
    <div className='flex flex-col'>
      <div className='flex items-center justify-between gap-2 px-3 py-2'>
        <div className={cn('flex items-center gap-1.5 text-xs font-semibold', t.header)}>
          {icon}
          {title}
        </div>
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums', t.badge)}>
          {count}
        </span>
      </div>
      {count === 0 ? (
        <div className='flex flex-1 flex-col items-center justify-center gap-1 px-3 py-6 text-xs text-muted-foreground'>
          <CheckCircle2 className='size-5 text-emerald-500' />
          {empty}
        </div>
      ) : (
        <div className='flex-1'>{children}</div>
      )}
    </div>
  )
}

function OverdueRow({ inv, isLast }: { inv: Invoice; isLast: boolean }) {
  const due = inv.data?.dueDate
  const days = daysOverdue(inv)
  return (
    <Link
      to='/invoices/$id'
      params={{ id: inv.id }}
      className={cn(
        'flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-muted/40',
        !isLast && 'border-b',
      )}
    >
      <div className='min-w-0'>
        <p className='truncate font-medium'>{getInvoiceDisplay(inv)}</p>
        <p className='truncate text-xs text-muted-foreground'>
          {inv.data?.tenant?.trim() || '—'}
          {inv.data?.property ? ` · ${inv.data.property}` : ''}
          {due ? ` · ครบ ${due}` : ''}
        </p>
      </div>
      <div className='flex shrink-0 items-center gap-3 text-right'>
        <Badge
          variant='outline'
          className='border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
        >
          เกิน {days} วัน
        </Badge>
        <span className='font-semibold tabular-nums'>
          {amt(inv.data?.remainingAmount ?? inv.data?.total, { decimal: 0 })}
        </span>
      </div>
    </Link>
  )
}

function ExpiringRow({ c, isLast }: { c: Contract; isLast: boolean }) {
  const end = parseBE(c.data?.end ?? '')
  const daysLeft = end
    ? Math.ceil((end.toDate().getTime() - Date.now()) / 86_400_000)
    : 0
  return (
    <Link
      to='/contracts/$id'
      params={{ id: c.id }}
      className={cn(
        'flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-muted/40',
        !isLast && 'border-b',
      )}
    >
      <div className='min-w-0'>
        <p className='truncate font-medium'>
          {c.data?.tenant?.trim() || '—'}
        </p>
        <p className='truncate text-xs text-muted-foreground'>
          {(c.data?.no?.trim() || `#${c.id}`)}
          {c.data?.property ? ` · ${c.data.property}` : ''}
          {c.data?.end ? ` · สิ้นสุด ${c.data.end}` : ''}
        </p>
      </div>
      <div className='shrink-0 text-right'>
        <div className='text-lg font-bold tabular-nums text-amber-700 dark:text-amber-300'>
          {daysLeft}
        </div>
        <div className='text-[10px] text-muted-foreground'>วันเหลือ</div>
      </div>
    </Link>
  )
}
