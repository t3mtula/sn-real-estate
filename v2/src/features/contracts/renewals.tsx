import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, FileText } from 'lucide-react'
import { useMemo } from 'react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getContractDisplay,
  getContractStatus,
  useContracts,
} from '@/features/contracts/queries'
import type { Contract } from '@/features/contracts/types'
import { amt, fmtBE, parseBE } from '@/lib/thai'

type Row = Contract & { daysLeft: number }

const BUCKETS = {
  expired: {
    label: 'หมดแล้ว',
    bg: 'bg-red-500/10 dark:bg-red-500/15',
    text: 'text-red-700 dark:text-red-300',
    accent: 'border-l-red-500',
    bar: 'bg-red-500',
  },
  d30: {
    label: 'ภายใน 30 วัน',
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    text: 'text-amber-800 dark:text-amber-300',
    accent: 'border-l-amber-500',
    bar: 'bg-amber-500',
  },
  d90: {
    label: '31-90 วัน',
    bg: 'bg-orange-500/10 dark:bg-orange-500/15',
    text: 'text-orange-800 dark:text-orange-300',
    accent: 'border-l-orange-500',
    bar: 'bg-orange-500',
  },
  d180: {
    label: '91-180 วัน',
    bg: 'bg-indigo-500/10 dark:bg-indigo-500/15',
    text: 'text-indigo-700 dark:text-indigo-300',
    accent: 'border-l-indigo-500',
    bar: 'bg-indigo-500',
  },
  all: {
    label: 'ทั้งหมด',
    bg: 'bg-muted/40',
    text: 'text-foreground',
    accent: 'border-l-muted-foreground',
    bar: 'bg-muted-foreground',
  },
}

function bucketKey(daysLeft: number): keyof typeof BUCKETS | null {
  if (daysLeft < 0) return 'expired'
  if (daysLeft <= 30) return 'd30'
  if (daysLeft <= 90) return 'd90'
  if (daysLeft <= 180) return 'd180'
  return null
}

export function Renewals() {
  const navigate = useNavigate()
  const { data: contracts, isLoading } = useContracts()

  const rows = useMemo<Row[]>(() => {
    if (!contracts) return []
    const now = new Date()
    return contracts
      .filter((c) => !c.data?.cancelled)
      .map((c) => {
        const e = parseBE(c.data?.end ?? '')
        if (!e) return null
        const daysLeft = Math.ceil(
          (e.toDate().getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        )
        return { ...c, daysLeft }
      })
      .filter((r): r is Row => r !== null)
      // window: anything ending within -30 to +180 days
      .filter((r) => r.daysLeft >= -30 && r.daysLeft <= 180)
      .sort((a, b) => a.daysLeft - b.daysLeft)
  }, [contracts])

  const counts = useMemo(() => {
    const c = { expired: 0, d30: 0, d90: 0, d180: 0, all: rows.length }
    rows.forEach((r) => {
      const k = bucketKey(r.daysLeft)
      if (k && k !== 'all') c[k]++
    })
    return c
  }, [rows])

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-6'>
        <header className='flex items-center gap-3'>
          <button
            type='button'
            onClick={() => navigate({ to: '/contracts' })}
            className='inline-flex size-9 items-center justify-center rounded-md hover:bg-muted'
            aria-label='กลับ'
          >
            <ArrowLeft className='size-4' />
          </button>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>สัญญาใกล้หมด</h1>
            <p className='text-sm text-muted-foreground'>
              สัญญาที่หมดแล้วหรือจะหมดภายใน 180 วัน · เรียงตามวันสิ้นสุด
            </p>
          </div>
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
              {(['expired', 'd30', 'd90', 'd180', 'all'] as const).map((k) => {
                const meta = BUCKETS[k]
                return (
                  <div key={k} className={`rounded-md border p-4 ${meta.bg}`}>
                    <p className={`text-xs font-semibold ${meta.text}`}>
                      {meta.label}
                    </p>
                    <p className={`mt-1 text-3xl font-bold tabular-nums ${meta.text}`}>
                      {counts[k].toLocaleString('th-TH')}
                    </p>
                    <p className='mt-1 text-xs text-muted-foreground'>สัญญา</p>
                  </div>
                )
              })}
            </div>

            {/* List */}
            {rows.length === 0 ? (
              <div className='rounded-md border bg-card p-10 text-center text-sm text-muted-foreground'>
                ไม่มีสัญญาที่ต้องต่ออายุในช่วงนี้
              </div>
            ) : (
              <div className='space-y-3'>
                {rows.map((r) => {
                  const k = bucketKey(r.daysLeft) ?? 'all'
                  const meta = BUCKETS[k]
                  const isExpired = r.daysLeft < 0
                  const start = parseBE(r.data?.start ?? '')
                  const end = parseBE(r.data?.end ?? '')
                  const now = new Date()
                  const totalDays =
                    start && end
                      ? Math.max(1, Math.round((end.toDate().getTime() - start.toDate().getTime()) / 86_400_000))
                      : 0
                  const elapsed = start
                    ? Math.round((now.getTime() - start.toDate().getTime()) / 86_400_000)
                    : 0
                  const pct =
                    totalDays > 0
                      ? Math.min(100, Math.max(0, Math.round((elapsed / totalDays) * 100)))
                      : 0
                  const status = getContractStatus(r.data)
                  return (
                    <Link
                      key={r.id}
                      to='/contracts/$id'
                      params={{ id: r.id }}
                      className={`block rounded-md border bg-card p-4 transition hover:bg-muted/30 border-l-4 ${meta.accent}`}
                    >
                      <div className='flex items-start gap-3'>
                        <FileText className='mt-1 size-4 shrink-0 text-muted-foreground' />
                        <div className='min-w-0 flex-1'>
                          <div className='flex flex-wrap items-center gap-2'>
                            <span className='truncate font-semibold'>
                              {r.data?.tenant?.trim() || '—'}
                            </span>
                            {status === 'expired' && (
                              <Badge
                                variant='outline'
                                className='border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
                              >
                                หมดอายุ
                              </Badge>
                            )}
                            {status === 'expiring' && (
                              <Badge
                                variant='outline'
                                className='border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                              >
                                ใกล้หมด
                              </Badge>
                            )}
                          </div>
                          <p className='mt-0.5 text-xs text-muted-foreground'>
                            {getContractDisplay(r)}
                            {r.data?.property ? ` · ${r.data.property}` : ''}
                          </p>
                          {r.data?.rate && (
                            <p className='mt-0.5 text-xs text-muted-foreground'>
                              {String(r.data.rate).split('(')[0]?.trim()}
                            </p>
                          )}
                          <div className='mt-2'>
                            <div className='flex justify-between text-[10px] text-muted-foreground'>
                              <span>{fmtBE(r.data?.start ?? '')}</span>
                              <span className={`font-semibold ${meta.text}`}>{pct}%</span>
                              <span>{fmtBE(r.data?.end ?? '')}</span>
                            </div>
                            <div className='mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted'>
                              <div
                                className={`h-full ${meta.bar}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className='shrink-0 text-right'>
                          <div className={`text-2xl font-bold tabular-nums ${meta.text}`}>
                            {Math.abs(r.daysLeft)}
                          </div>
                          <div className={`text-[10px] font-semibold ${meta.text}`}>
                            {isExpired ? 'วัน เกินแล้ว' : 'วัน เหลือ'}
                          </div>
                          <div className='mt-1 text-[10px] text-muted-foreground'>
                            สิ้นสุด {fmtBE(r.data?.end ?? '')}
                          </div>
                          {r.data?.rate && (
                            <div className='mt-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 tabular-nums'>
                              {amt(r.data.rate, { decimal: 0 })}
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </>
        )}
      </Main>
    </>
  )
}
