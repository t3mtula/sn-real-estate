import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  Ban,
  Building2,
  CreditCard,
  FileText,
  Landmark,
  Printer,
  Receipt,
  RotateCcw,
  Send,
  Trash2,
  User,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EntityAuditPanel } from '@/features/activity-log/entity-audit-panel'
import { FollowUpPanel } from '@/features/invoices/follow-up-panel'
import { PaymentPanel } from '@/features/invoices/payment-panel'
import { useBankAccount } from '@/features/bank-accounts/queries'
import { useContract } from '@/features/contracts/queries'
import { useLandlord } from '@/features/landlords/queries'
import { useProperty } from '@/features/properties/queries'
import { useTenant } from '@/features/tenants/queries'
import {
  useCancelInvoice,
  useDeleteInvoice,
  useMarkInvoiceSent,
  useRestoreInvoice,
} from '@/features/invoices/mutations'
import {
  daysOverdue,
  formatMonth,
  getEffectiveStatus,
  getInvoiceDisplay,
  getStatusMeta,
  useInvoice,
} from '@/features/invoices/queries'
import { type InvoiceStatus } from '@/features/invoices/types'
import { amt } from '@/lib/thai'
import { cn } from '@/lib/utils'

const STATUS_TONE_CLASS: Record<string, string> = {
  success: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300',
  warning: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300',
  info: 'bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-300',
  muted: 'bg-muted text-muted-foreground border-border',
  destructive: 'bg-destructive/10 text-destructive border-destructive/30',
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const meta = getStatusMeta(status)
  return (
    <Badge variant='outline' className={cn('font-normal', STATUS_TONE_CLASS[meta.tone] ?? '')}>
      {meta.label}
    </Badge>
  )
}

export function InvoiceDetail({ id }: { id: string }) {
  const navigate = useNavigate()
  const { data: invoice, isLoading, error } = useInvoice(id)
  const contractId = invoice?.contract_id ?? undefined
  const { data: contract } = useContract(contractId)
  const tenantId = contract?.data?.tenant_id
  const landlordId = contract?.data?.landlord_id
  const bankAccountId = (invoice?.data?.bankAccountId ?? contract?.data?.bankAccountId) as
    | string
    | undefined
  const propertyIdNum = contract?.data?.pid_property
  const propertyKey = propertyIdNum != null ? String(propertyIdNum) : undefined

  const { data: tenant } = useTenant(tenantId)
  const { data: landlord } = useLandlord(landlordId)
  const { data: bankAccount } = useBankAccount(bankAccountId)
  const { data: property } = useProperty(propertyKey)

  const markSent = useMarkInvoiceSent(id)
  const cancel = useCancelInvoice(id)
  const restore = useRestoreInvoice(id)
  const del = useDeleteInvoice()

  const [voidOpen, setVoidOpen] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (isLoading) {
    return (
      <>
        <Header fixed />
        <Main>
          <Skeleton className='mb-4 h-8 w-80' />
          <Skeleton className='h-64 w-full' />
        </Main>
      </>
    )
  }

  if (error || !invoice) {
    return (
      <>
        <Header fixed />
        <Main className='flex flex-col gap-4'>
          <Button variant='ghost' size='sm' asChild className='w-fit'>
            <Link to='/invoices'>
              <ArrowLeft className='size-4' />
              กลับ
            </Link>
          </Button>
          <div className='rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive'>
            ไม่พบใบแจ้งหนี้ —{' '}
            {error instanceof Error ? error.message : 'ลองโหลดใหม่อีกครั้ง'}
          </div>
        </Main>
      </>
    )
  }

  const data = invoice.data
  const effective = getEffectiveStatus(invoice)
  const overdue = daysOverdue(invoice)
  const display = getInvoiceDisplay(invoice)
  const isVoided = effective === 'voided'
  const isDraft = effective === 'draft'

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-6'>
        <header className='flex flex-wrap items-start gap-3'>
          <Button variant='ghost' size='icon' asChild>
            <Link to='/invoices' aria-label='กลับ'>
              <ArrowLeft className='size-4' />
            </Link>
          </Button>
          <div className='flex-1'>
            <div className='flex flex-wrap items-center gap-2'>
              <h1 className='text-2xl font-semibold tracking-tight'>{display}</h1>
              <StatusBadge status={effective} />
              {overdue > 0 && (
                <Badge variant='outline' className={STATUS_TONE_CLASS.destructive}>
                  เกินกำหนด {overdue} วัน
                </Badge>
              )}
            </div>
            <p className='text-muted-foreground text-sm'>
              เดือน {formatMonth(data.month)} ·{' '}
              {(data.category ?? 'rent') === 'deposit' ? 'เงินประกัน' : 'ค่าเช่า'}
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button size='sm' variant='outline' asChild>
              <Link to='/invoices/$id/print' params={{ id }}>
                <Printer className='size-4' />
                พิมพ์/PDF
              </Link>
            </Button>
            {isDraft && (
              <Button
                size='sm'
                onClick={async () => {
                  try {
                    await markSent.mutateAsync()
                    toast.success('ออกใบแจ้งแล้ว')
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'ออกไม่สำเร็จ')
                  }
                }}
                disabled={markSent.isPending}
              >
                <Send className='size-4' />
                ออกใบแจ้ง
              </Button>
            )}
            {!isVoided ? (
              <Button
                size='sm'
                variant='outline'
                onClick={() => setVoidOpen(true)}
                disabled={cancel.isPending}
              >
                <Ban className='size-4' />
                ยกเลิก
              </Button>
            ) : (
              <Button
                size='sm'
                variant='outline'
                onClick={async () => {
                  try {
                    await restore.mutateAsync()
                    toast.success('คืนใบแจ้งกลับมาแล้ว')
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'คืนไม่สำเร็จ')
                  }
                }}
                disabled={restore.isPending}
              >
                <RotateCcw className='size-4' />
                คืนสภาพ
              </Button>
            )}
            <Button
              size='sm'
              variant='ghost'
              className='text-destructive hover:text-destructive'
              onClick={() => setDeleteOpen(true)}
              disabled={del.isPending}
            >
              <Trash2 className='size-4' />
              ลบ
            </Button>
          </div>
        </header>

        <div className='grid gap-6 md:grid-cols-3'>
          <div className='space-y-4 md:col-span-2'>
            <div className='rounded-md border bg-card p-4'>
              <h3 className='mb-3 flex items-center gap-2 text-sm font-medium'>
                <Receipt className='size-4' />
                รายการเรียกเก็บ
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>รายละเอียด</TableHead>
                    <TableHead className='text-right'>ยอด</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data.items ?? []).map((it, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: stable order
                    <TableRow key={i}>
                      <TableCell className='text-sm'>{it.desc || '—'}</TableCell>
                      <TableCell className='text-right text-sm tabular-nums'>
                        {amt(it.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(data.items ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className='py-6 text-center text-sm text-muted-foreground'>
                        ยังไม่มีรายการ
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <div className='mt-4 space-y-1 border-t pt-3 text-sm'>
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>ยอดรวม</span>
                  <span className='font-medium tabular-nums'>{amt(data.total)}</span>
                </div>
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>จ่ายแล้ว</span>
                  <span className='tabular-nums'>{amt(data.paidAmount)}</span>
                </div>
                <div className='flex justify-between border-t pt-1'>
                  <span className='font-medium'>คงค้าง</span>
                  <span
                    className={cn(
                      'font-medium tabular-nums',
                      (data.remainingAmount ?? 0) > 0 && !isVoided
                        ? 'text-destructive'
                        : '',
                    )}
                  >
                    {amt(data.remainingAmount)}
                  </span>
                </div>
              </div>
              {(data.vatMode === 'inclusive' || data.vatMode === 'exclusive') && (
                <p className='mt-3 text-xs text-muted-foreground'>
                  VAT: {data.vatMode === 'inclusive' ? 'รวมใน' : 'นอก'}ยอด · อัตรา{' '}
                  {data.vatRate}% · ก่อน VAT {amt(data.vatBase)}
                </p>
              )}
            </div>

            <div className='rounded-md border bg-card p-4'>
              <PaymentPanel invoice={invoice} />
            </div>
          </div>

          <aside className='space-y-3'>
            <div className='rounded-md border bg-card p-4'>
              <h3 className='mb-3 text-sm font-medium'>ข้อมูลใบแจ้ง</h3>
              <dl className='space-y-2 text-sm'>
                <div className='flex justify-between gap-3'>
                  <dt className='text-muted-foreground'>เลขที่</dt>
                  <dd className='text-right tabular-nums'>{data.invoiceNo || '—'}</dd>
                </div>
                <div className='flex justify-between gap-3'>
                  <dt className='text-muted-foreground'>วันออก</dt>
                  <dd className='text-right tabular-nums'>{data.date || '—'}</dd>
                </div>
                <div className='flex justify-between gap-3'>
                  <dt className='text-muted-foreground'>ครบกำหนด</dt>
                  <dd className='text-right tabular-nums'>{data.dueDate || '—'}</dd>
                </div>
                <div className='flex justify-between gap-3'>
                  <dt className='text-muted-foreground'>งวด</dt>
                  <dd className='text-right'>{data.freqLabel || '—'}</dd>
                </div>
              </dl>
            </div>

            <div className='rounded-md border bg-card p-4'>
              <h3 className='mb-3 text-sm font-medium'>ฝ่ายที่เกี่ยวข้อง</h3>
              <ul className='space-y-2 text-sm'>
                {contract && (
                  <li>
                    <Link
                      to='/contracts/$id'
                      params={{ id: contract.id }}
                      className='flex items-center gap-2 hover:text-primary'
                    >
                      <FileText className='size-4 text-muted-foreground' />
                      <span className='truncate'>
                        สัญญา {contract.data?.no || `#${contract.id}`}
                      </span>
                    </Link>
                  </li>
                )}
                {tenant ? (
                  <li>
                    <Link
                      to='/tenants/$id'
                      params={{ id: tenant.id }}
                      className='flex items-center gap-2 hover:text-primary'
                    >
                      <User className='size-4 text-muted-foreground' />
                      <span className='truncate'>{tenant.data?.name || data.tenant || '—'}</span>
                    </Link>
                  </li>
                ) : (
                  data.tenant && (
                    <li className='flex items-center gap-2'>
                      <User className='size-4 text-muted-foreground' />
                      <span className='truncate'>{data.tenant}</span>
                    </li>
                  )
                )}
                {landlord ? (
                  <li>
                    <Link
                      to='/landlords/$id'
                      params={{ id: landlord.id }}
                      className='flex items-center gap-2 hover:text-primary'
                    >
                      <Landmark className='size-4 text-muted-foreground' />
                      <span className='truncate'>{landlord.data?.name || data.landlord || '—'}</span>
                    </Link>
                  </li>
                ) : (
                  data.landlord && (
                    <li className='flex items-center gap-2'>
                      <Landmark className='size-4 text-muted-foreground' />
                      <span className='truncate'>{data.landlord}</span>
                    </li>
                  )
                )}
                {property ? (
                  <li>
                    <Link
                      to='/properties/$id'
                      params={{ id: property.id }}
                      className='flex items-center gap-2 hover:text-primary'
                    >
                      <Building2 className='size-4 text-muted-foreground' />
                      <span className='truncate'>{property.data?.name || data.property || '—'}</span>
                    </Link>
                  </li>
                ) : (
                  data.property && (
                    <li className='flex items-center gap-2'>
                      <Building2 className='size-4 text-muted-foreground' />
                      <span className='truncate'>{data.property}</span>
                    </li>
                  )
                )}
                {bankAccount && (
                  <li>
                    <Link
                      to='/bank-accounts/$id'
                      params={{ id: bankAccount.id }}
                      className='flex items-center gap-2 hover:text-primary'
                    >
                      <CreditCard className='size-4 text-muted-foreground' />
                      <span className='truncate'>
                        {bankAccount.data?.bank ? `${bankAccount.data.bank} · ` : ''}
                        {bankAccount.data?.acctNo || '—'}
                      </span>
                    </Link>
                  </li>
                )}
              </ul>
            </div>

            {isVoided && (data.voidedReason || data.voidedAt) ? (
              <div className='rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm'>
                <p className='font-medium text-destructive'>ใบแจ้งนี้ถูกยกเลิก</p>
                {data.voidedAt ? (
                  <p className='mt-1 text-xs text-muted-foreground'>
                    วันที่ยกเลิก: {String(data.voidedAt)}
                  </p>
                ) : null}
                {data.voidedReason ? (
                  <p className='mt-1 text-xs'>เหตุผล: {String(data.voidedReason)}</p>
                ) : null}
              </div>
            ) : null}

            <FollowUpPanel invoice={invoice} />
            <EntityAuditPanel entity='invoices' entityId={id} />
          </aside>
        </div>
      </Main>

      <AlertDialog open={voidOpen} onOpenChange={setVoidOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยกเลิกใบแจ้งหนี้ {display}?</AlertDialogTitle>
            <AlertDialogDescription>
              ใบนี้จะมีสถานะ "ยกเลิก" และจะไม่นับใน outstanding ของลูกหนี้ ·
              คืนสภาพได้ทีหลังจากหน้านี้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className='space-y-2'>
            <Label htmlFor='void-reason'>เหตุผล (ไม่บังคับ)</Label>
            <Input
              id='void-reason'
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder='เช่น ออกผิดเดือน · ผู้เช่ายกเลิกสัญญา'
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>ไม่ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              onClick={async () => {
                try {
                  await cancel.mutateAsync({ reason: voidReason })
                  toast.success('ยกเลิกใบแจ้งแล้ว')
                  setVoidOpen(false)
                  setVoidReason('')
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'ยกเลิกไม่สำเร็จ')
                }
              }}
            >
              ยืนยันยกเลิก
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบใบแจ้งหนี้ {display}?</AlertDialogTitle>
            <AlertDialogDescription>
              การลบจะเอาออกจากระบบถาวร · เรียกคืนไม่ได้ ·
              ถ้าต้องการเก็บไว้เป็น audit ให้ใช้ "ยกเลิก" แทน
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ไม่ลบ</AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              onClick={async () => {
                try {
                  await del.mutateAsync(id)
                  toast.success('ลบใบแจ้งแล้ว')
                  navigate({ to: '/invoices' })
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'ลบไม่สำเร็จ')
                }
              }}
            >
              ยืนยันลบถาวร
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
