import { Link } from '@tanstack/react-router'
import { Calendar } from 'lucide-react'
import { useMemo } from 'react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { amt, parseBE } from '@/lib/thai'
import { useInvoices, daysOverdue, getEffectiveStatus } from '@/features/invoices/queries'
import type { Invoice } from '@/features/invoices/types'

type Group = { label: string; color: string; items: Invoice[] }

function FollowUpCard({ inv }: { inv: Invoice }) {
  const d = inv.data
  const overdue = daysOverdue(inv)
  const fu = d?.followUpDate?.trim()
  const fuNote = d?.followUpNote?.trim()

  const fuDays = fu
    ? (() => {
        const parsed = parseBE(fu)
        if (!parsed) return null
        return Math.ceil((parsed.valueOf() - Date.now()) / 86_400_000)
      })()
    : null

  return (
    <Link
      to='/invoices/$id'
      params={{ id: inv.id }}
      className='flex items-center gap-3 rounded-md border bg-card px-3 py-2.5 text-sm transition-colors hover:bg-muted/50'
    >
      <div className='min-w-[90px] font-semibold text-muted-foreground'>
        {d?.invoiceNo || '—'}
      </div>
      <div className='flex-1 min-w-0'>
        <div className='truncate font-medium'>{d?.tenant || '—'}</div>
        <div className='truncate text-xs text-muted-foreground'>{d?.property || ''}</div>
        {fuNote && (
          <div className='mt-0.5 truncate text-xs text-muted-foreground'>💬 {fuNote}</div>
        )}
      </div>
      {fu && fuDays !== null && (
        <Badge
          className={
            fuDays < 0
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
              : fuDays === 0
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
          }
        >
          📅 {fu}
          {fuDays < 0 && ` เลย ${Math.abs(fuDays)} วัน`}
          {fuDays === 0 && ' (วันนี้)'}
          {fuDays > 0 && ` อีก ${fuDays} วัน`}
        </Badge>
      )}
      {overdue > 0 && (
        <span className='text-xs font-semibold text-destructive'>เกิน {overdue}ว</span>
      )}
      <span className='min-w-[72px] text-right font-semibold tabular-nums'>
        {amt(d?.remainingAmount ?? d?.total)} ฿
      </span>
    </Link>
  )
}

function Section({ group }: { group: Group }) {
  if (group.items.length === 0) return null
  return (
    <section className='space-y-2'>
      <h2 className={`text-sm font-bold ${group.color}`}>
        {group.label} ({group.items.length})
      </h2>
      <div className='space-y-1'>
        {group.items.map((inv) => (
          <FollowUpCard key={inv.id} inv={inv} />
        ))}
      </div>
    </section>
  )
}

export function FollowUpDashboard() {
  const { data: invoices, isLoading } = useInvoices()

  const today = useMemo(() => new Date(), [])

  const groups = useMemo((): Group[] => {
    if (!invoices) return []

    const active = invoices.filter((inv) => {
      const s = getEffectiveStatus(inv)
      return s !== 'paid' && s !== 'voided'
    })

    const withFU = active.filter((inv) => inv.data?.followUpDate?.trim())
    const noFU = active.filter(
      (inv) => !inv.data?.followUpDate?.trim() && daysOverdue(inv) > 0,
    )

    const fuPast: Invoice[] = []
    const fuToday: Invoice[] = []
    const fuUpcoming: Invoice[] = []

    for (const inv of withFU) {
      const parsed = parseBE(inv.data.followUpDate ?? '')
      if (!parsed) { fuUpcoming.push(inv); continue }
      const diff = Math.ceil((parsed.valueOf() - today.getTime()) / 86_400_000)
      if (diff < 0) fuPast.push(inv)
      else if (diff === 0) fuToday.push(inv)
      else fuUpcoming.push(inv)
    }

    // Sort each group by follow-up date asc, then by overdue desc
    const byFuDate = (a: Invoice, b: Invoice) => {
      const da = parseBE(a.data?.followUpDate ?? '')
      const db = parseBE(b.data?.followUpDate ?? '')
      return (da?.valueOf() ?? 0) - (db?.valueOf() ?? 0)
    }
    fuPast.sort(byFuDate)
    fuToday.sort(byFuDate)
    fuUpcoming.sort(byFuDate)
    noFU.sort((a, b) => daysOverdue(b) - daysOverdue(a))

    return [
      { label: '🔴 นัดชำระเลยวันแล้ว', color: 'text-red-600 dark:text-red-400', items: fuPast },
      { label: '🟡 นัดชำระวันนี้', color: 'text-amber-600 dark:text-amber-400', items: fuToday },
      { label: '🟢 นัดชำระข้างหน้า', color: 'text-emerald-600 dark:text-emerald-400', items: fuUpcoming },
      { label: '⚪ ค้างชำระยังไม่ได้นัด', color: 'text-muted-foreground', items: noFU },
    ]
  }, [invoices, today])

  const total = groups.reduce((s, g) => s + g.items.length, 0)

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-5'>
        <header>
          <div className='flex items-center gap-2'>
            <Calendar className='size-5 text-indigo-500' />
            <h1 className='text-2xl font-bold tracking-tight'>นัดชำระ (Follow-up)</h1>
          </div>
          <p className='mt-1 text-sm text-muted-foreground'>
            ใบแจ้งหนี้ค้างชำระที่มีหรือยังไม่มีวันนัด · {total} รายการ
          </p>
        </header>

        {isLoading ? (
          <div className='space-y-2'>
            {Array.from({ length: 5 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
              <Skeleton key={i} className='h-14 w-full' />
            ))}
          </div>
        ) : total === 0 ? (
          <div className='rounded-md border bg-muted/30 p-10 text-center text-sm text-muted-foreground'>
            ไม่มีใบแจ้งหนี้ค้างชำระ
          </div>
        ) : (
          <div className='space-y-6'>
            {groups.map((g) => (
              <Section key={g.label} group={g} />
            ))}
          </div>
        )}
      </Main>
    </>
  )
}
