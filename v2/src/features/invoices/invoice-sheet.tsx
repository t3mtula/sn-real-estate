/**
 * InvoiceSheet — slide-in side panel showing a slim invoice detail view.
 * Mirrors ContractSheet pattern (Notion/Linear/Stripe style).
 *
 * URL: `?id=` search param on /invoices · bookmarkable · ESC clears.
 * "เปิดเต็มจอ" button → full /invoices/$id route for power actions
 * (cancel, payment record, slip upload, follow-up, etc.).
 */

import { Link } from '@tanstack/react-router'
import {
  ArrowUpRight,
  Building2,
  Calendar,
  CreditCard,
  Printer,
  Receipt as ReceiptIcon,
  UserRound,
} from 'lucide-react'
import { useState } from 'react'
import { PrintOverlay } from '@/components/print-overlay'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useBankAccount } from '@/features/bank-accounts/queries'
import { useContract } from '@/features/contracts/queries'
import { useLandlord } from '@/features/landlords/queries'
import { useProperty } from '@/features/properties/queries'
import { useTenant } from '@/features/tenants/queries'
import {
  daysOverdue,
  formatMonth,
  getEffectiveStatus,
  getInvoiceDisplay,
  getStatusMeta,
  useInvoice,
} from '@/features/invoices/queries'
import { buildInvoiceHtml, buildReceiptHtml } from '@/features/invoices/print/invoice-html'
import { amt } from '@/lib/thai'
import { cn } from '@/lib/utils'

const STATUS_TONE_CLASS: Record<string, string> = {
  success: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300',
  warning: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300',
  info: 'bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-300',
  muted: 'bg-muted text-muted-foreground border-border',
  destructive: 'bg-destructive/10 text-destructive border-destructive/30',
}

type Props = {
  id: string | null
  onClose: () => void
}

export function InvoiceSheet({ id, onClose }: Props) {
  return (
    <Sheet open={!!id} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side='right'
        className='w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl flex flex-col gap-0 p-0'
      >
        {id ? <Body id={id} /> : null}
      </SheetContent>
    </Sheet>
  )
}

function Body({ id }: { id: string }) {
  const { data: invoice, isLoading } = useInvoice(id)
  const contract = useContract(invoice?.contract_id ?? undefined)
  const tenant = useTenant(contract.data?.data?.tenant_id)
  const landlord = useLandlord(contract.data?.data?.landlord_id)
  const bankAccountId =
    (invoice?.data?.bankAccountId ?? contract.data?.data?.bankAccountId) as
      | string
      | undefined
  const bank = useBankAccount(bankAccountId)
  const propertyId = contract.data?.data?.pid_property?.toString()
  const property = useProperty(propertyId)
  const [printHtml, setPrintHtml] = useState<string | null>(null)
  const [printTitle, setPrintTitle] = useState<string>('ใบแจ้งหนี้')

  if (isLoading) {
    return (
      <div className='flex flex-col gap-4 p-6'>
        <Skeleton className='h-8 w-72' />
        <Skeleton className='h-32 w-full' />
        <Skeleton className='h-24 w-full' />
      </div>
    )
  }
  if (!invoice) {
    return (
      <div className='p-6 text-sm text-muted-foreground'>ไม่พบใบแจ้งหนี้</div>
    )
  }

  const data = invoice.data
  const display = getInvoiceDisplay(invoice)
  const effective = getEffectiveStatus(invoice)
  const meta = getStatusMeta(effective)
  const overdue = daysOverdue(invoice)
  const isPaid = invoice.status === 'paid' || invoice.status === 'partial'

  async function handlePrintInvoice() {
    if (!invoice) return
    const html = await buildInvoiceHtml({
      invoice,
      contract: contract.data ?? null,
      tenant: tenant.data ?? null,
      landlord: landlord.data ?? null,
      property: property.data ?? null,
      bank: bank.data ?? null,
    })
    setPrintTitle(`ใบแจ้งหนี้ ${data.invoiceNo ?? ''}`.trim())
    setPrintHtml(html)
  }

  async function handlePrintReceipt() {
    if (!invoice) return
    const html = await buildReceiptHtml({
      invoice,
      contract: contract.data ?? null,
      tenant: tenant.data ?? null,
      landlord: landlord.data ?? null,
      property: property.data ?? null,
      bank: bank.data ?? null,
    })
    const isDeposit = (data.category ?? 'rent') === 'deposit'
    setPrintTitle(
      `${isDeposit ? 'ใบรับเงินประกัน' : 'ใบเสร็จรับเงิน'} ${(data as { receiptNo?: string }).receiptNo ?? data.invoiceNo ?? ''}`.trim(),
    )
    setPrintHtml(html)
  }

  return (
    <>
      <SheetHeader className='border-b px-6 py-4'>
        <div className='flex items-center gap-3 flex-wrap'>
          <SheetTitle className='text-xl'>{display}</SheetTitle>
          <Badge variant='outline' className={cn('font-normal', STATUS_TONE_CLASS[meta.tone] ?? '')}>
            {meta.label}
          </Badge>
          {overdue > 0 && (
            <Badge variant='outline' className={STATUS_TONE_CLASS.destructive}>
              เกินกำหนด {overdue} วัน
            </Badge>
          )}
        </div>
        <SheetDescription className='text-xs'>
          เดือน {formatMonth(data.month)} ·{' '}
          {(data.category ?? 'rent') === 'deposit' ? 'เงินประกัน' : 'ค่าเช่า'}
        </SheetDescription>
      </SheetHeader>

      <div className='flex-1 overflow-y-auto'>
        <div className='space-y-6 px-6 py-5'>
          <Section title='สรุป'>
            <Field icon={UserRound} label='ผู้เช่า'>
              {tenant.data ? (
                <Link
                  to='/tenants/$id'
                  params={{ id: tenant.data.id }}
                  className='text-primary underline-offset-4 hover:underline'
                >
                  {tenant.data.data?.name ?? '—'}
                </Link>
              ) : (
                <span>{data.tenant ?? '—'}</span>
              )}
            </Field>
            <Field icon={Building2} label='ทรัพย์สิน'>
              {property.data ? (
                <Link
                  to='/properties/$id'
                  params={{ id: property.data.id }}
                  className='text-primary underline-offset-4 hover:underline'
                >
                  {property.data.data?.name ?? '—'}
                </Link>
              ) : (
                <span>{data.property ?? '—'}</span>
              )}
            </Field>
            <Field icon={Calendar} label='วันที่ออก'>
              {data.date || '—'}
            </Field>
            <Field icon={Calendar} label='กำหนดชำระ'>
              <span className={overdue > 0 ? 'text-destructive font-medium' : ''}>
                {data.dueDate || '—'}
              </span>
            </Field>
            <Field icon={CreditCard} label='ยอด'>
              <span className='font-semibold'>
                {amt(data.total, { symbol: false, decimal: 0 })} บาท
              </span>
            </Field>
            {data.remainingAmount != null && data.remainingAmount > 0 && (
              <Field icon={CreditCard} label='ค้างชำระ'>
                <span className='text-destructive font-medium'>
                  {amt(data.remainingAmount, { symbol: false, decimal: 0 })} บาท
                </span>
              </Field>
            )}
          </Section>

          {data.items && data.items.length > 0 && (
            <>
              <Separator />
              <Section title='รายการ'>
                <div className='col-span-full space-y-1.5'>
                  {data.items.map((it, i) => (
                    <div key={i} className='flex justify-between text-sm'>
                      <span>{it.desc}</span>
                      <span className='font-medium tabular-nums'>
                        {amt(it.amount, { symbol: false, decimal: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            </>
          )}
        </div>
      </div>

      <div className='flex items-center gap-2 border-t bg-muted/30 px-6 py-3 flex-wrap'>
        <Button variant='outline' size='sm' onClick={handlePrintInvoice}>
          <Printer className='size-4' />
          พิมพ์/PDF
        </Button>
        {isPaid && (
          <Button variant='outline' size='sm' onClick={handlePrintReceipt}>
            <ReceiptIcon className='size-4' />
            ใบเสร็จ
          </Button>
        )}
        <Button asChild size='sm' className='ml-auto'>
          <Link to='/invoices/$id' params={{ id }}>
            <ArrowUpRight className='size-4' />
            เปิดเต็มจอ
          </Link>
        </Button>
      </div>

      <PrintOverlay
        open={!!printHtml}
        html={printHtml}
        title={printTitle}
        onClose={() => setPrintHtml(null)}
      />
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className='space-y-3'>
      <h3 className='text-sm font-semibold text-muted-foreground'>{title}</h3>
      <div className='grid gap-3 sm:grid-cols-2'>{children}</div>
    </div>
  )
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className='flex gap-2'>
      <Icon className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
      <div className='min-w-0 flex-1'>
        <p className='text-xs uppercase tracking-wider text-muted-foreground'>
          {label}
        </p>
        <div className='text-sm'>{children}</div>
      </div>
    </div>
  )
}
