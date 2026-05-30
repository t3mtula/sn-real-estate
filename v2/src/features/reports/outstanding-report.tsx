/**
 * รายงานลูกหนี้เกินกำหนด — จัดกลุ่มตาม tenant
 * Port from v1 showAllOutstanding()
 */
import { Link } from '@tanstack/react-router'
import { Download } from 'lucide-react'
import { useMemo } from 'react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useExportXlsx, xlsxFilename } from '@/hooks/use-xlsx'
import { amt } from '@/lib/thai'
import { useInvoices, daysOverdue, getEffectiveStatus, getInvoiceDisplay, formatMonth } from '@/features/invoices/queries'
import type { Invoice } from '@/features/invoices/types'

type TenantGroup = {
  tenant: string
  invoices: Invoice[]
  totalOutstanding: number
  maxOverdue: number
}

export function OutstandingReport() {
  const { data: invoices, isLoading } = useInvoices()

  const groups = useMemo((): TenantGroup[] => {
    if (!invoices) return []
    const outstanding = invoices.filter((inv) => {
      const s = getEffectiveStatus(inv)
      const remaining = inv.data?.remainingAmount ?? inv.data?.total ?? 0
      // "ลูกหนี้เกินกำหนด" = เลยวันครบกำหนดแล้ว (overdue) + ยังมียอดค้าง
      // ใช้ daysOverdue ตัวเดียวกับ facet "เกินกำหนด" หน้าใบแจ้งหนี้ → นิยาม/เลขตรงกัน
      // (รวมทุกประเภท · มัดจำที่เลยกำหนดก็คือหนี้เกินกำหนด)
      return s !== 'paid' && s !== 'voided' && daysOverdue(inv) > 0 && remaining > 0
    })

    const map = new Map<string, Invoice[]>()
    for (const inv of outstanding) {
      const key = inv.data?.tenant?.trim() || '(ไม่ระบุ)'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(inv)
    }

    return Array.from(map.entries())
      .map(([tenant, invs]) => ({
        tenant,
        invoices: invs.sort((a, b) => daysOverdue(b) - daysOverdue(a)),
        totalOutstanding: invs.reduce((s, i) => s + (i.data?.remainingAmount ?? i.data?.total ?? 0), 0),
        maxOverdue: Math.max(...invs.map((i) => daysOverdue(i)), 0),
      }))
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding)
  }, [invoices])

  const grandTotal = groups.reduce((s, g) => s + g.totalOutstanding, 0)
  const totalInvoices = groups.reduce((s, g) => s + g.invoices.length, 0)

  const exportXlsx = useExportXlsx()
  function handleExport() {
    const rows = groups.flatMap((g) =>
      g.invoices.map((inv) => ({
        tenant: g.tenant,
        no: getInvoiceDisplay(inv),
        month: formatMonth(inv.data?.month),
        property: inv.data?.property ?? '',
        dueDate: inv.data?.dueDate ?? '',
        remaining: inv.data?.remainingAmount ?? inv.data?.total ?? 0,
        overdue: daysOverdue(inv) > 0 ? daysOverdue(inv) : '',
      })),
    )
    void exportXlsx(
      xlsxFilename('ลูกหนี้เกินกำหนด'),
      [
        { header: 'ผู้เช่า', key: 'tenant', width: 28 },
        { header: 'เลขที่', key: 'no', width: 16 },
        { header: 'เดือน', key: 'month', width: 12 },
        { header: 'ทรัพย์สิน', key: 'property', width: 24 },
        { header: 'วันครบกำหนด', key: 'dueDate', width: 14 },
        { header: 'ค้างชำระ', key: 'remaining', width: 14 },
        { header: 'เกินกำหนด (วัน)', key: 'overdue', width: 16 },
      ],
      rows,
      { sheetName: 'ลูกหนี้เกินกำหนด' },
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
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>ลูกหนี้เกินกำหนด</h1>
            <p className='mt-1 text-sm text-muted-foreground'>
              เฉพาะใบที่เลยวันครบกำหนดแล้วและยังไม่จ่าย · {groups.length} ราย ·{' '}
              {totalInvoices} ใบ · รวม {amt(grandTotal)}
            </p>
          </div>
          <Button variant='outline' onClick={handleExport} disabled={totalInvoices === 0}>
            <Download className='size-4' />
            Export Excel
          </Button>
        </header>

        {isLoading ? (
          <div className='space-y-2'>
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className='h-16 w-full' />)}
          </div>
        ) : groups.length === 0 ? (
          <div className='rounded-md border bg-muted/30 p-10 text-center text-sm text-muted-foreground'>
            ไม่มีลูกหนี้เกินกำหนด 🎉
          </div>
        ) : (
          <div className='space-y-4'>
            {groups.map((g) => (
              <div key={g.tenant} className='rounded-md border bg-card'>
                <div className='flex items-center gap-3 border-b px-4 py-2.5'>
                  <span className='font-semibold'>{g.tenant}</span>
                  {g.maxOverdue > 0 && (
                    <Badge className='bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'>
                      เกิน {g.maxOverdue} วัน
                    </Badge>
                  )}
                  <span className='ml-auto font-bold tabular-nums'>{amt(g.totalOutstanding)} ฿</span>
                </div>
                <div className='divide-y'>
                  {g.invoices.map((inv) => {
                    const remaining = inv.data?.remainingAmount ?? inv.data?.total ?? 0
                    const overdue = daysOverdue(inv)
                    return (
                      <Link
                        key={inv.id}
                        to='/invoices/$id'
                        params={{ id: inv.id }}
                        className='flex items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-muted/50'
                      >
                        <span className='min-w-[120px] font-medium text-muted-foreground'>
                          {inv.data?.invoiceNo || '—'}
                        </span>
                        <span className='flex-1 truncate text-muted-foreground'>{inv.data?.property || '—'}</span>
                        <span className='text-xs text-muted-foreground'>ครบ {inv.data?.dueDate || '—'}</span>
                        {overdue > 0 && (
                          <span className='text-xs font-semibold text-destructive'>เกิน {overdue}ว</span>
                        )}
                        <span className='min-w-[80px] text-right font-semibold tabular-nums'>{amt(remaining)} ฿</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Main>
    </>
  )
}
