/**
 * ContractSheet — slide-in side panel with a dense contract detail view.
 *
 * Two modes (toggle within the sheet, no fullscreen overlay):
 *   - 'detail'  — content-dense overview (parties, terms, address, witnesses,
 *                  bank, notes, status cards, related invoices)
 *   - 'print'   — A4 preview iframe with toolbar (พิมพ์ / ดาวน์โหลด / กลับ)
 *
 * URL: `?id=` on /contracts · bookmarkable · ESC clears.
 * "เปิดเต็มจอ" navigates to full /contracts/$id for actions that don't
 * belong in a side panel (cancel · move-out · inspection · deposit return).
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
  FileText,
  Landmark,
  MapPin,
  Printer,
  Receipt,
  StickyNote,
  Users,
  UserRound,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
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
import { buildContractHtml } from '@/features/contracts/print/contract-html'
import {
  getContractDisplay,
  getContractStatus,
  getStatusMeta,
  useContract,
} from '@/features/contracts/queries'
import { useInvoicesByContract } from '@/features/invoices/queries'
import { useLandlord } from '@/features/landlords/queries'
import { useProperty } from '@/features/properties/queries'
import { useActiveContractTemplate } from '@/features/templates/queries'
import { useTenant } from '@/features/tenants/queries'
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

export function ContractSheet({ id, onClose }: Props) {
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
  const { data: contract, isLoading } = useContract(id)
  const tenant = useTenant(contract?.data?.tenant_id)
  const landlord = useLandlord(contract?.data?.landlord_id)
  const bank = useBankAccount(contract?.data?.bankAccountId)
  const propertyId = (contract?.data?.pid_property ?? contract?.data?.pid)?.toString()
  const property = useProperty(propertyId)
  const template = useActiveContractTemplate()
  const invoices = useInvoicesByContract(id)
  const [view, setView] = useState<'detail' | 'print'>('detail')
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  const printHtml = useMemo(() => {
    if (!contract || view !== 'print') return null
    return buildContractHtml({
      contract,
      tenant: tenant.data ?? null,
      landlord: landlord.data ?? null,
      bank: bank.data ?? null,
      property: property.data ?? null,
      parent: null,
      template: template.data ?? null,
    })
  }, [contract, tenant.data, landlord.data, bank.data, property.data, template.data, view])

  if (isLoading) {
    return (
      <div className='flex flex-col gap-4 p-6'>
        <Skeleton className='h-8 w-72' />
        <Skeleton className='h-32 w-full' />
        <Skeleton className='h-24 w-full' />
      </div>
    )
  }
  if (!contract) {
    return <div className='p-6 text-sm text-muted-foreground'>ไม่พบสัญญา</div>
  }

  const c = contract.data
  const display = getContractDisplay(contract)
  const status = getContractStatus(c)
  const meta = getStatusMeta(status)

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
    a.download = `สัญญา-${(c.no ?? id).replace(/[/\\?%*:|"<>]/g, '_')}.html`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      {/* Header */}
      <SheetHeader className='border-b px-6 py-3 space-y-0'>
        <div className='flex items-center gap-3 flex-wrap'>
          {view === 'print' && (
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
          <SheetTitle className='text-xl'>
            {view === 'print' ? `ตัวอย่างพิมพ์ · ${display}` : display}
          </SheetTitle>
          {view === 'detail' && (
            <>
              <Badge
                variant='outline'
                className={cn('font-normal', STATUS_TONE_CLASS[meta.tone] ?? '')}
              >
                {meta.label}
              </Badge>
              {c.parent_contract_id && (
                <Badge variant='outline' className='font-normal'>
                  เช่าช่วง
                </Badge>
              )}
            </>
          )}
        </div>
        <SheetDescription className='sr-only'>
          รายละเอียดสัญญา {display}
        </SheetDescription>
      </SheetHeader>

      {/* Body — switches between detail and print */}
      {view === 'detail' ? (
        <div className='flex-1 overflow-y-auto'>
          <div className='space-y-5 px-6 py-5'>
            {/* Alerts */}
            {c.cancelled && (
              <div className='rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>
                <div className='flex items-start gap-2'>
                  <AlertCircle className='mt-0.5 size-4 shrink-0' />
                  <div>
                    <p className='font-medium'>สัญญานี้ถูกยกเลิก</p>
                    <p className='mt-1 text-xs'>
                      ยกเลิกเมื่อ {c.cancelledDate || '—'}
                      {c.cancelledReason ? ` · ${c.cancelledReason}` : ''}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {c.noticeDate && !c.cancelled && (
              <div className='rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100'>
                <div className='flex items-start gap-2'>
                  <AlertCircle className='mt-0.5 size-4 shrink-0' />
                  <div>
                    <p className='font-medium'>ผู้เช่าแจ้งย้ายออก</p>
                    <p className='mt-1 text-xs'>
                      แจ้งเมื่อ {c.noticeDate} · กำหนดออก {c.plannedMoveOut || '—'}
                    </p>
                    {c.noticeNote && (
                      <p className='mt-0.5 text-xs opacity-80'>{c.noticeNote}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Parties */}
            <Section title='คู่สัญญา'>
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
                  <span>{c.tenant ?? '—'}</span>
                )}
                {c.taxId && (
                  <span className='block text-xs text-muted-foreground'>
                    ภาษี: {c.taxId}
                  </span>
                )}
                {tenant.data?.data?.phone && (
                  <span className='block text-xs text-muted-foreground'>
                    โทร: {tenant.data.data.phone}
                  </span>
                )}
              </Field>
              <Field icon={Users} label='ผู้ให้เช่า'>
                {landlord.data ? (
                  <Link
                    to='/landlords/$id'
                    params={{ id: landlord.data.id }}
                    className='text-primary underline-offset-4 hover:underline'
                  >
                    {landlord.data.data?.name ?? '—'}
                  </Link>
                ) : (
                  <span>{c.landlord ?? '—'}</span>
                )}
                {landlord.data?.data?.signerName && (
                  <span className='block text-xs text-muted-foreground'>
                    ลงนาม: {landlord.data.data.signerName}
                    {landlord.data.data.signerTitle &&
                      ` (${landlord.data.data.signerTitle})`}
                  </span>
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
                  <span>{(c.property as string | undefined) ?? '—'}</span>
                )}
                {property.data?.data?.area && (
                  <span className='block text-xs text-muted-foreground'>
                    พื้นที่: {String(property.data.data.area)}
                  </span>
                )}
              </Field>
              {(c.purpose as string | undefined) && (
                <Field icon={FileText} label='วัตถุประสงค์การเช่า'>
                  {String(c.purpose)}
                </Field>
              )}
            </Section>

            <Separator />

            {/* Terms */}
            <Section title='เงื่อนไข'>
              <Field icon={Calendar} label='ระยะเวลา'>
                {c.start || '—'} → {c.end || '—'}
                {c.dur && (
                  <span className='block text-xs text-muted-foreground'>
                    {fmtDur(c.dur)}
                  </span>
                )}
              </Field>
              <Field icon={CreditCard} label='ค่าเช่า'>
                <span className='font-medium'>
                  {amt(c.rate, { symbol: false, decimal: 0 })} บาท
                </span>
                {c.payment && (
                  <span className='block text-xs text-muted-foreground'>
                    {c.payment}
                  </span>
                )}
              </Field>
              {c.deposit ? (
                <Field icon={Landmark} label='เงินประกัน'>
                  {amt(c.deposit, { symbol: false, decimal: 0 })} บาท
                </Field>
              ) : null}
              {(c as { rateAdj?: string }).rateAdj && (
                <Field icon={CreditCard} label='การปรับค่าเช่า'>
                  {String((c as { rateAdj?: string }).rateAdj)}
                </Field>
              )}
            </Section>

            {/* Bank */}
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

            {/* Where signed */}
            {(c.madeAt || c.madeDate) && (
              <>
                <Separator />
                <Section title='สถานที่และวันที่ทำสัญญา'>
                  {c.madeAt && (
                    <Field icon={MapPin} label='ที่ทำสัญญา'>
                      {c.madeAt}
                    </Field>
                  )}
                  {c.madeDate && (
                    <Field icon={Calendar} label='วันที่ทำสัญญา'>
                      {c.madeDate}
                    </Field>
                  )}
                </Section>
              </>
            )}

            {/* Witnesses */}
            {(c.wit1 || c.wit2) && (
              <>
                <Separator />
                <Section title='พยาน'>
                  {c.wit1 && (
                    <Field icon={UserRound} label='พยาน 1'>
                      {c.wit1}
                    </Field>
                  )}
                  {c.wit2 && (
                    <Field icon={UserRound} label='พยาน 2'>
                      {c.wit2}
                    </Field>
                  )}
                </Section>
              </>
            )}

            {/* Notes */}
            {(c as { notes?: string }).notes && (
              <>
                <Separator />
                <Section title='หมายเหตุ' singleColumn>
                  <Field icon={StickyNote} label=''>
                    <p className='whitespace-pre-wrap text-sm'>
                      {String((c as { notes?: string }).notes)}
                    </p>
                  </Field>
                </Section>
              </>
            )}

            {/* Related invoices */}
            {invoices.data && invoices.data.length > 0 && (
              <>
                <Separator />
                <Section title={`ใบแจ้งหนี้ (${invoices.data.length})`} singleColumn>
                  <div className='col-span-full divide-y rounded-md border'>
                    {invoices.data.slice(0, 8).map((inv) => (
                      <Link
                        key={inv.id}
                        to='/invoices'
                        search={{ id: inv.id }}
                        className='flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/40'
                      >
                        <span className='flex items-center gap-2'>
                          <Receipt className='size-4 text-muted-foreground' />
                          <span className='font-medium'>{inv.data?.invoiceNo ?? inv.id}</span>
                          <span className='text-xs text-muted-foreground'>
                            {inv.data?.month ?? ''}
                          </span>
                        </span>
                        <span className='flex items-center gap-2'>
                          <span className='tabular-nums'>
                            {amt(inv.data?.total, { symbol: false, decimal: 0 })} ฿
                          </span>
                          <Badge variant='outline' className='text-xs font-normal'>
                            {inv.status ?? '—'}
                          </Badge>
                        </span>
                      </Link>
                    ))}
                    {invoices.data.length > 8 && (
                      <p className='px-3 py-2 text-xs text-muted-foreground'>
                        ... อีก {invoices.data.length - 8} ใบ
                      </p>
                    )}
                  </div>
                </Section>
              </>
            )}
          </div>
        </div>
      ) : (
        // Print preview mode — inline inside the sheet, not a fullscreen lock
        <div className='flex-1 overflow-hidden bg-slate-200'>
          {printHtml && (
            <iframe
              ref={iframeRef}
              title={`ตัวอย่างสัญญา ${display}`}
              srcDoc={printHtml}
              className='size-full border-0'
            />
          )}
        </div>
      )}

      {/* Footer toolbar */}
      <div className='flex items-center gap-2 border-t bg-muted/30 px-6 py-3 flex-wrap'>
        {view === 'detail' ? (
          <>
            <Button variant='outline' size='sm' onClick={() => setView('print')}>
              <Printer className='size-4' />
              พิมพ์/PDF
            </Button>
            <Button asChild size='sm' className='ml-auto'>
              <Link to='/contracts/$id' params={{ id }}>
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

function fmtDur(d: number | string | undefined): string {
  if (d == null || d === '') return ''
  const s = String(d).trim()
  if (!s) return ''
  if (/(ปี|เดือน|วัน)/.test(s)) return s
  return `${s} เดือน`
}
