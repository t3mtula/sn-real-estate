/**
 * รายงานสรุปรายเดือน — port from v1 showMonthlySummary()
 * รายได้ที่ออก vs รายได้ที่รับ vs ค้าง per month
 */
import { useMemo, useState } from 'react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { amt } from '@/lib/thai'
import { useInvoices, getEffectiveStatus } from '@/features/invoices/queries'

type MonthRow = {
  month: string          // "YYYY-MM"
  label: string          // "มกราคม 2568"
  issued: number         // total ยอดที่ออกใบ
  paid: number           // ยอดที่รับแล้ว
  outstanding: number    // ยอดค้าง
  count: number          // จำนวนใบ
  paidCount: number
}

const TH_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

function monthLabel(m: string): string {
  const [y, mo] = m.split('-')
  const idx = Number(mo) - 1
  return `${TH_MONTHS[idx]} ${Number(y) + 543}`
}

export function MonthlySummary() {
  const { data: invoices, isLoading } = useInvoices()
  const [yearFilter, setYearFilter] = useState<string>('all')

  const { rows, years } = useMemo(() => {
    if (!invoices) return { rows: [], years: [] }

    const map = new Map<string, MonthRow>()
    for (const inv of invoices) {
      const month = inv.data?.month
      if (!month) continue
      const s = getEffectiveStatus(inv)
      if (s === 'voided') continue
      const total = inv.data?.total ?? 0
      const paid = inv.data?.paidAmount ?? (s === 'paid' ? total : 0)
      if (!map.has(month)) {
        map.set(month, { month, label: monthLabel(month), issued: 0, paid: 0, outstanding: 0, count: 0, paidCount: 0 })
      }
      const row = map.get(month)!
      row.issued += total
      row.paid += paid
      row.outstanding += Math.max(total - paid, 0)
      row.count++
      if (s === 'paid') row.paidCount++
    }

    const allRows = Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month))
    const yearsSet = new Set(allRows.map((r) => r.month.slice(0, 4)))
    return { rows: allRows, years: Array.from(yearsSet).sort((a, b) => b.localeCompare(a)) }
  }, [invoices])

  const filtered = yearFilter === 'all' ? rows : rows.filter((r) => r.month.startsWith(yearFilter))
  const totals = filtered.reduce((acc, r) => ({
    issued: acc.issued + r.issued,
    paid: acc.paid + r.paid,
    outstanding: acc.outstanding + r.outstanding,
    count: acc.count + r.count,
  }), { issued: 0, paid: 0, outstanding: 0, count: 0 })

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-5'>
        <header className='flex flex-wrap items-end gap-3'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>สรุปรายเดือน</h1>
            <p className='mt-1 text-sm text-muted-foreground'>รายได้ที่ออกใบ vs รับแล้ว vs ค้าง · ไม่นับใบยกเลิก</p>
          </div>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className='w-28'>
              <SelectValue placeholder='ปี' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>ทุกปี</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={y}>{Number(y) + 543}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </header>

        {isLoading ? (
          <div className='space-y-2'>
            {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className='h-12 w-full' />)}
          </div>
        ) : (
          <div className='overflow-x-auto rounded-md border'>
            <table className='w-full text-sm'>
              <thead className='bg-muted/50'>
                <tr>
                  <th className='px-4 py-2 text-left font-semibold'>เดือน</th>
                  <th className='px-4 py-2 text-right font-semibold'>จำนวนใบ</th>
                  <th className='px-4 py-2 text-right font-semibold'>ออกใบรวม</th>
                  <th className='px-4 py-2 text-right font-semibold'>รับแล้ว</th>
                  <th className='px-4 py-2 text-right font-semibold text-destructive'>ค้าง</th>
                </tr>
              </thead>
              <tbody className='divide-y'>
                {filtered.map((r) => (
                  <tr key={r.month} className='hover:bg-muted/30'>
                    <td className='px-4 py-2 font-medium'>{r.label}</td>
                    <td className='px-4 py-2 text-right tabular-nums text-muted-foreground'>
                      {r.count} ใบ · ชำระ {r.paidCount}
                    </td>
                    <td className='px-4 py-2 text-right tabular-nums'>{amt(r.issued)}</td>
                    <td className='px-4 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400'>{amt(r.paid)}</td>
                    <td className='px-4 py-2 text-right tabular-nums'>
                      {r.outstanding > 0
                        ? <span className='font-semibold text-destructive'>{amt(r.outstanding)}</span>
                        : <span className='text-muted-foreground'>—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className='border-t bg-muted/30 font-semibold'>
                <tr>
                  <td className='px-4 py-2'>รวม {yearFilter === 'all' ? 'ทั้งหมด' : `ปี ${Number(yearFilter) + 543}`}</td>
                  <td className='px-4 py-2 text-right tabular-nums text-muted-foreground'>{totals.count} ใบ</td>
                  <td className='px-4 py-2 text-right tabular-nums'>{amt(totals.issued)}</td>
                  <td className='px-4 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400'>{amt(totals.paid)}</td>
                  <td className='px-4 py-2 text-right tabular-nums text-destructive'>{amt(totals.outstanding)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Main>
    </>
  )
}
