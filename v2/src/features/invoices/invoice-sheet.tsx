/**
 * InvoiceSheet — slide-in side panel with a dense invoice detail view.
 *
 * Two modes (toggle within the sheet, no fullscreen overlay):
 *   - 'detail'   — content-dense overview (parties, items, totals, payments,
 *                  bank, follow-up, slip indicator, notes)
 *   - 'invoice'  — A4 invoice preview iframe (พิมพ์ / ดาวน์โหลด / กลับ)
 *   - 'receipt'  — A4 receipt preview iframe (paid/partial only)
 *
 * URL: `?id=` on /invoices · bookmarkable.
 * "เปิดเต็มจอ" → full /invoices/$id for cancel / slip upload / follow-up.
 */

import { Link } from '@tanstack/react-router'
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Building2,
  Calendar,
  CreditCard,
  Download,
  Landmark,
  Printer,
  Receipt as ReceiptIcon,
  StickyNote,
  UserRound,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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

type View = 'detail' | 'invoice' | 'receipt'

type Props = {
  id: string | null
  onClose: () => void
}

export function InvoiceSheet({ id, onClose }: Props) {
  return (
    <Sheet open={!!id} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side='right'
        className='w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl flex flex-col gap-0 p-0'
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

  const [view, setView] = useState<View>('detail')
  const [printHtml, setPrintHtml] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  // Rebuild HTML when view or refs change
  useEffect(() => {
    if (!invoice || view === 'detail') {
      setPrintHtml(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const refs = {
          invoice,
          contract: contract.data ?? null,
          tenant: tenant.data ?? null,
          landlord: landlord.data ?? null,
          property: property.data ?? null,
          bank: bank.data ?? null,
        }
        const html =
          view === 'invoice' ? await buildInvoiceHtml(refs) : await buildReceiptHtml(refs)
        if (!cancelled) setPrintHtml(html)
      } catch {
        if (!cancelled) setPrintHtml('<html><body style="padding:40px;font-family:Sarabun">สร้างตัวอย่างไม่สำเร็จ</body></html>')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [view, invoice, contract.data, tenant.data, landlord.data, property.data, bank.data])

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
  const isDeposit = (data.category ?? 'rent') === 'deposit'
  const payments = data.payments ?? []
  const note = data.note as string | undefined

  function doPrint() {
    iframeRef.current?.contentWindow?.focus()
    iframeRef.current?.contentWindow?.print()
  }
  function doDownload() {
    if (!printHtml) return
    const blob = new Blob([printHtml], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const docKind = view === 'receipt' ? 'ใบเสร็จ' : 'ใบแจ้งหนี้'
    a.download = `${docKind}-${(data.invoiceNo ?? id).replace(/[/\\?%*:|"<>]/g, '_')}.html`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const viewTitle =
    view === 'invoice'
      ? `ตัวอย่างใบแจ้งหนี้ · ${display}`
      : view === 'receipt'
        ? `ตัวอย่าง${isDeposit ? 'ใบรับเงินประกัน' : 'ใบเสร็จ'} · ${display}`
        : display

  return (
    <>
      <SheetHeader className='border-b px-6 py-3 space-y-0'>
        <div className='flex items-center gap-3 flex-wrap'>
          {view !== 'detail' && (
            <Button
              variant='ghost'
              size='sm'
              onClick={() => setView('detail')}
              className='-ml-2'
            >
              <ArrowLeft className='size-4' />
              กลับไปดูข้อมูล
            </Button>
          )}
          <SheetTitle className='text-xl'>{viewTitle}</SheetTitle>
          {view === 'detail' && (
            <>
              <Badge
                variant='outline'
                className={cn('font-normal', STATUS_TONE_CLASS[meta.tone] ?? '')}
              >
                {meta.label}
              </Badge>
              {overdue > 0 && (
                <Badge variant='outline' className={STATUS_TONE_CLASS.destructive}>
                  เกินกำหนด {overdue} วัน
                </Badge>
              )}
              {isDeposit && (
                <Badge variant='outline' className='font-normal'>
                  เงินประกัน
                </Badge>
              )}
            </>
          )}
        </div>
        <SheetDescription className='text-xs'>
          {view === 'detail'
            ? `เดือน ${formatMonth(data.month)} · ${isDeposit ? 'เงินประกัน' : 'ค่าเช่า'}`
            : 'ตัวอย่างก่อนพิมพ์'}
        </SheetDescription>
      </SheetHeader>

      {/* Body */}
      {view === 'detail' ? (
        <div className='flex-1 overflow-y-auto'>
          <div className='space-y-5 px-6 py-5'>
            {/* Overdue alert */}
            {overdue > 0 && (
              <div className='rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>
                <div className='flex items-start gap-2'>
                  <AlertCircle className='mt-0.5 size-4 shrink-0' />
                  <div>
                    <p className='font-medium'>เกินกำหนดชำระ {overdue} วัน</p>
                    <p className='mt-1 text-xs'>
                      กำหนด {data.dueDate || '—'} · ค้าง{' '}
                      {amt(data.remainingAmount ?? data.total, {
                        symbol: false,
                        decimal: 0,
                      })}{' '}
                      บาท
                    </p>
                  </div>
                </div>
              </div>
            )}

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
                {contract.data && (
                  <span className='block text-xs text-muted-foreground'>
                    สัญญา:{' '}
                    <Link
                      to='/contracts'
                      search={{ id: contract.data.id }}
                      className='text-primary underline-offset-4 hover:underline'
                    >
                      {contract.data.data?.no ?? contract.data.id}
                    </Link>
                  </span>
                )}
              </Field>
              <Field icon={Calendar} label='วันที่ออก'>
                {data.date || '—'}
              </Field>
              <Field icon={Calendar} label='กำหนดชำระ'>
                <span
                  className={overdue > 0 ? 'font-medium text-destructive' : ''}
                >
                  {data.dueDate || '—'}
                </span>
              </Field>
              <Field icon={CreditCard} label='ยอดรวม'>
                <span className='font-semibold'>
                  {amt(data.total, { symbol: false, decimal: 0 })} บาท
                </span>
              </Field>
              {data.paidAmount != null && data.paidAmount > 0 && (
                <Field icon={CreditCard} label='ชำระแล้ว'>
                  <span className='font-medium text-emerald-700 dark:text-emerald-400'>
                    {amt(data.paidAmount, { symbol: false, decimal: 0 })} บาท
                  </span>
                </Field>
              )}
              {data.remainingAmount != null && data.remainingAmount > 0 && (
                <Field icon={CreditCard} label='ค้างชำระ'>
                  <span className='font-medium text-destructive'>
                    {amt(data.remainingAmount, { symbol: false, decimal: 0 })} บาท
                  </span>
                </Field>
              )}
            </Section>

            {data.items && data.items.length > 0 && (
              <>
                <Separator />
                <Section title='รายการ' singleColumn>
                  <div className='col-span-full divide-y rounded-md border'>
                    {data.items.map((it, i) => (
                      <div
                        key={i}
                        className='flex items-center justify-between px-3 py-2 text-sm'
                      >
                        <span>
                          {i + 1}. {it.desc}
                        </span>
                        <span className='font-medium tabular-nums'>
                          {amt(it.amount, { symbol: false, decimal: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </Section>
              </>
            )}

            {payments.length > 0 && (
              <>
                <Separator />
                <Section title={`การชำระเงิน (${payments.length})`} singleColumn>
                  <div className='col-span-full divide-y rounded-md border'>
                    {payments.map((p, i) => (
                      <div
                        key={i}
                        className='flex items-center justify-between px-3 py-2 text-sm'
                      >
                        <div>
                          <p className='font-medium'>
                            {p.date ?? '—'} · {p.method ?? 'ไม่ระบุ'}
                          </p>
                          {p.ref && (
                            <p className='text-xs text-muted-foreground'>
                              อ้างอิง: {String(p.ref)}
                            </p>
                          )}
                        </div>
                        <span className='font-medium text-emerald-700 tabular-nums dark:text-emerald-400'>
                          {amt(p.amount, { symbol: false, decimal: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </Section>
              </>
            )}

            {bank.data?.data && (
              <>
                <Separator />
                <Section title='บัญชีรับเงิน'>
                  <Field icon={Landmark} label='ธนาคาร'>
                    {bank.data.data.bank ?? '—'}
                    {bank.data.data.branch && ` สาขา ${bank.data.data.branch}`}
                  </Field>
                  {bank.data.data.acctNo && (
                    <Field icon={CreditCard} label='เลขที่บัญชี'>
                      <span className='font-mono'>{bank.data.data.acctNo}</span>
                    </Field>
                  )}
                  {bank.data.data.accountName && (
                    <Field icon={UserRound} label='ชื่อบัญชี'>
                      {bank.data.data.accountName}
                    </Field>
                  )}
                </Section>
              </>
            )}

            {(landlord.data?.data?.name ?? data.landlord) && (
              <>
                <Separator />
                <Section title='ผู้ให้เช่า'>
                  <Field icon={UserRound} label='ชื่อ'>
                    {landlord.data ? (
                      <Link
                        to='/landlords/$id'
                        params={{ id: landlord.data.id }}
                        className='text-primary underline-offset-4 hover:underline'
                      >
                        {landlord.data.data?.name ?? '—'}
                      </Link>
                    ) : (
                      <span>{data.landlord ?? '—'}</span>
                    )}
                  </Field>
                </Section>
              </>
            )}

            {data.followUpDate && (
              <>
                <Separator />
                <Section title='นัดติดตาม'>
                  <Field icon={Calendar} label='วันที่นัด'>
                    {data.followUpDate}
                  </Field>
                  {data.followUpNote && (
                    <Field icon={StickyNote} label='หมายเหตุ'>
                      {data.followUpNote}
                    </Field>
                  )}
                </Section>
              </>
            )}

            {note && (
              <>
                <Separator />
                <Section title='หมายเหตุ' singleColumn>
                  <Field icon={StickyNote} label=''>
                    <p className='whitespace-pre-wrap text-sm'>{note}</p>
                  </Field>
                </Section>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className='flex-1 overflow-hidden bg-slate-200'>
          {printHtml && (
            <iframe
              ref={iframeRef}
              title={viewTitle}
              srcDoc={printHtml}
              className='size-full border-0'
            />
          )}
        </div>
      )}

      <div className='flex items-center gap-2 border-t bg-muted/30 px-6 py-3 flex-wrap'>
        {view === 'detail' ? (
          <>
            <Button variant='outline' size='sm' onClick={() => setView('invoice')}>
              <Printer className='size-4' />
              พิมพ์/PDF
            </Button>
            {isPaid && (
              <Button variant='outline' size='sm' onClick={() => setView('receipt')}>
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
          </>
        ) : (
          <>
            <Button variant='outline' size='sm' onClick={doDownload}>
              <Download className='size-4' />
              ดาวน์โหลด HTML
            </Button>
            <Button size='sm' onClick={doPrint} className='ml-auto'>
              <Printer className='size-4' />
              พิมพ์ / บันทึก PDF
            </Button>
          </>
        )}
      </div>
    </>
  )
}

function Section({
  title,
  children,
  singleColumn,
}: {
  title: string
  children: React.ReactNode
  singleColumn?: boolean
}) {
  return (
    <div className='space-y-3'>
      <h3 className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
        {title}
      </h3>
      <div className={cn('grid gap-3', singleColumn ? '' : 'sm:grid-cols-2')}>
        {children}
      </div>
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
        {label && (
          <p className='text-xs uppercase tracking-wider text-muted-foreground'>
            {label}
          </p>
        )}
        <div className='text-sm'>{children}</div>
      </div>
    </div>
  )
}
