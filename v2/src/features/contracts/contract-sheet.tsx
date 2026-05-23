/**
 * ContractSheet — slide-in side panel showing a slim contract detail view.
 *
 * Pattern (Notion/Linear/Stripe): clicking a row in the contracts list opens
 * this sheet instead of navigating to a full page. The list stays visible
 * behind the sheet, scroll position is preserved, and clicking another row
 * swaps the sheet content without a full page transition.
 *
 * URL: driven by `?id=` search param on /contracts so the open state is
 * bookmarkable.  ESC / close / clicking outside clears the search param.
 *
 * "เปิดเต็มจอ" button navigates to the full /contracts/$id route for power
 * editing (cancel, move-out notice, inspection, deposit return — all the
 * heavy panels that don't belong in a side sheet).
 */

import { Link } from '@tanstack/react-router'
import {
  ArrowUpRight,
  Building2,
  Calendar,
  CreditCard,
  Landmark,
  Printer,
  UserRound,
  Users,
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
import { buildContractHtml } from '@/features/contracts/print/contract-html'
import {
  getContractDisplay,
  getContractStatus,
  getStatusMeta,
  useContract,
} from '@/features/contracts/queries'
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
  /** Contract id to show.  Sheet is open when this is non-null. */
  id: string | null
  onClose: () => void
}

export function ContractSheet({ id, onClose }: Props) {
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
  const { data: contract, isLoading } = useContract(id)
  const tenant = useTenant(contract?.data?.tenant_id)
  const landlord = useLandlord(contract?.data?.landlord_id)
  const bank = useBankAccount(contract?.data?.bankAccountId)
  const propertyId = (contract?.data?.pid_property ?? contract?.data?.pid)?.toString()
  const property = useProperty(propertyId)
  const template = useActiveContractTemplate()
  const [printHtml, setPrintHtml] = useState<string | null>(null)

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
    return (
      <div className='p-6 text-sm text-muted-foreground'>ไม่พบสัญญา</div>
    )
  }

  const c = contract.data
  const display = getContractDisplay(contract)
  const status = getContractStatus(c)
  const meta = getStatusMeta(status)

  function handlePrint() {
    if (!contract) return
    const html = buildContractHtml({
      contract,
      tenant: tenant.data ?? null,
      landlord: landlord.data ?? null,
      bank: bank.data ?? null,
      property: property.data ?? null,
      parent: null,
      template: template.data ?? null,
    })
    setPrintHtml(html)
  }

  return (
    <>
      <SheetHeader className='border-b px-6 py-4'>
        <div className='flex items-center gap-3'>
          <SheetTitle className='text-xl'>{display}</SheetTitle>
          <Badge variant='outline' className={cn('font-normal', STATUS_TONE_CLASS[meta.tone] ?? '')}>
            {meta.label}
          </Badge>
          {c.parent_contract_id && (
            <Badge variant='outline' className='font-normal'>
              เช่าช่วง
            </Badge>
          )}
        </div>
        <SheetDescription className='sr-only'>
          รายละเอียดสัญญาเช่า {display}
        </SheetDescription>
      </SheetHeader>

      <div className='flex-1 overflow-y-auto'>
        <div className='space-y-6 px-6 py-5'>
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
            </Field>
          </Section>

          <Separator />

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
              {amt(c.rate, { symbol: false, decimal: 0 })} บาท
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
          </Section>
        </div>
      </div>

      <div className='flex items-center gap-2 border-t bg-muted/30 px-6 py-3'>
        <Button variant='outline' size='sm' onClick={handlePrint}>
          <Printer className='size-4' />
          พิมพ์/PDF
        </Button>
        <Button asChild size='sm' className='ml-auto'>
          <Link to='/contracts/$id' params={{ id }}>
            <ArrowUpRight className='size-4' />
            เปิดเต็มจอ
          </Link>
        </Button>
      </div>

      <PrintOverlay
        open={!!printHtml}
        html={printHtml}
        title={`สัญญาเช่า ${display}`}
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

function fmtDur(d: number | string | undefined): string {
  if (d == null || d === '') return ''
  const s = String(d).trim()
  if (!s) return ''
  if (/(ปี|เดือน|วัน)/.test(s)) return s
  return `${s} เดือน`
}
