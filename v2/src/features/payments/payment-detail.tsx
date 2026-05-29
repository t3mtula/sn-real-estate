import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Ban, Banknote, CircleCheck, CircleDot, CircleHelp, Link2, Trash2 } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { useConfirm } from '@/hooks/use-confirm'
import { useBankAccounts } from '@/features/bank-accounts/queries'
import { useContracts } from '@/features/contracts/queries'
import { useInvoices } from '@/features/invoices/queries'
import { amt } from '@/lib/thai'
import { cn } from '@/lib/utils'
import { usePayment } from './queries'
import { useDeletePayment, useAllocatePayment } from './mutations'
import { PAY_METHOD_LABELS } from './schema'
import type { PaymentStatus } from './types'

const STATUS_CONFIG: Record<PaymentStatus, { label: string; icon: React.ElementType; cls: string }> = {
  matched:     { label: 'จับคู่แล้ว',   icon: CircleCheck, cls: 'text-green-600 dark:text-green-400' },
  partial:     { label: 'บางส่วน',      icon: CircleDot,   cls: 'text-amber-600 dark:text-amber-400' },
  unallocated: { label: 'ยังไม่จับคู่', icon: CircleHelp,  cls: 'text-muted-foreground' },
  other:       { label: 'ไม่ใช่ค่าเช่า', icon: Ban,         cls: 'text-slate-500 dark:text-slate-400' },
}

interface PaymentDetailProps {
  id: string
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='grid grid-cols-[160px_1fr] gap-2 py-1.5'>
      <span className='text-muted-foreground text-sm'>{label}</span>
      <span className='text-sm'>{children}</span>
    </div>
  )
}

export function PaymentDetail({ id }: PaymentDetailProps) {
  const { data: payment, isLoading } = usePayment(id)
  const { data: contracts } = useContracts()
  const { data: bankAccounts } = useBankAccounts()
  const { data: invoices } = useInvoices()
  const del = useDeletePayment()
  const allocate = useAllocatePayment()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [sel, setSel] = useState<Set<string>>(new Set())

  if (isLoading) return (
    <>
      <Header fixed><div className='ms-auto flex items-center gap-2'><ThemeSwitch /><ProfileDropdown /></div></Header>
      <Main><Skeleton className='h-64 w-full max-w-2xl' /></Main>
    </>
  )

  if (!payment) return (
    <>
      <Header fixed><div className='ms-auto flex items-center gap-2'><ThemeSwitch /><ProfileDropdown /></div></Header>
      <Main><p className='text-destructive text-sm'>ไม่พบรายการ</p></Main>
    </>
  )

  const d = payment.data
  const contract = contracts?.find((c) => c.id === d.contract_id)
  const bank = bankAccounts?.find((b) => b.id === d.bank_account_id)
  const st = d.status ?? 'unallocated'
  const stCfg = STATUS_CONFIG[st as PaymentStatus] ?? STATUS_CONFIG.unallocated
  const StIcon = stCfg.icon

  // สเต็ป 3 — จับคู่เงินค้างเข้าใบแจ้งหนี้ของสัญญานี้ (เฉพาะเงินที่ยังไม่จับ)
  const outstandingInvoices = (invoices ?? [])
    .filter((i) => i.contract_id === d.contract_id)
    .map((i) => {
      const total = Number(i.data?.total) || 0
      const paid = Number(i.data?.paidAmount ?? i.data?.paid_amount ?? 0) || 0
      return { inv: i, out: Math.max(0, total - paid) }
    })
    .filter((x) => {
      const s = (x.inv.status ?? x.inv.data?.status ?? '').toLowerCase()
      return s !== 'paid' && s !== 'voided' && x.out > 0.01
    })
    .sort((a, b) => String(a.inv.data?.month ?? '').localeCompare(String(b.inv.data?.month ?? '')))

  const canAllocate = st === 'unallocated' && !!d.contract_id && outstandingInvoices.length > 0
  const payAmount = Number(d.amount) || 0
  // greedy preview: เติมตามใบที่เลือก (เรียงเก่า→ใหม่) จนเงินหมด · เหลือ = เครดิตยกไป
  const allocPreview = new Map<string, number>()
  let rem = payAmount
  for (const { inv, out } of outstandingInvoices) {
    if (!sel.has(inv.id) || rem <= 0.01) continue
    const a = Math.min(rem, out)
    allocPreview.set(inv.id, a)
    rem -= a
  }
  const creditLeft = rem

  async function handleAllocate() {
    const ids = outstandingInvoices.filter((x) => sel.has(x.inv.id)).map((x) => x.inv.id)
    if (ids.length === 0) return
    await allocate.mutateAsync({ payment: payment!, invoiceIds: ids })
    setSel(new Set())
  }

  async function handleDelete() {
    const ok = await confirm({
      title: `ลบรายการ ${d.receiptNo ?? id}?`,
      description: 'ลบแล้วยอดรับเงินใน invoice จะถูกย้อนกลับ · ลบจริงไหม?',
      confirmLabel: 'ลบ',
      destructive: true,
    })
    if (!ok) return
    await del.mutateAsync(payment!)
    navigate({ to: '/payments' })
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
        <header className='flex items-center justify-between gap-3'>
          <div className='flex items-center gap-3'>
            <Button variant='ghost' size='icon' asChild>
              <Link to='/payments'><ArrowLeft className='size-4' /></Link>
            </Button>
            <div>
              <div className='flex items-center gap-2'>
                <Banknote className='size-5 text-muted-foreground' />
                <h1 className='text-xl font-semibold'>{d.receiptNo ?? id}</h1>
                <div className={cn('flex items-center gap-1 text-sm', stCfg.cls)}>
                  <StIcon className='size-3.5' />
                  <span>{stCfg.label}</span>
                </div>
              </div>
              <p className='text-muted-foreground text-sm'>บันทึกรับเงิน</p>
            </div>
          </div>
          <Button
            variant='outline'
            size='sm'
            className='text-destructive hover:bg-destructive/10'
            onClick={handleDelete}
            disabled={del.isPending}
          >
            <Trash2 className='size-3.5' />
            ลบรายการ
          </Button>
        </header>

        <div className='max-w-2xl space-y-6'>
          {/* ข้อมูลหลัก */}
          <section className='rounded-lg border p-4'>
            <h2 className='mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground'>รายละเอียด</h2>
            <Field label='วันที่รับเงิน'>{d.date}</Field>
            <Field label='ยอดรับ'>
              <span className='text-lg font-bold'>{amt(Number(d.amount ?? 0), { decimal: 0 })} บาท</span>
            </Field>
            <Field label='วิธีชำระ'>{PAY_METHOD_LABELS[d.payMethod ?? ''] ?? d.payMethod ?? '—'}</Field>
            <Field label='ชื่อผู้โอน'>{d.payerName || '—'}</Field>
            <Field label='เลขใบเสร็จ'>{d.receiptNo || '—'}</Field>
            {d.notes && <Field label='หมายเหตุ'>{d.notes}</Field>}
          </section>

          {/* สัญญา + บัญชี */}
          <section className='rounded-lg border p-4'>
            <h2 className='mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground'>สัญญา & บัญชี</h2>
            <Field label='สัญญา'>
              {contract ? (
                <Link to='/contracts/$id' params={{ id: contract.id }} className='text-primary hover:underline'>
                  {String(contract.data?.no ?? '')} · {String(contract.data?.tenant ?? contract.data?.tenantName ?? '')}
                </Link>
              ) : d.contract_id ? d.contract_id : '—'}
            </Field>
            <Field label='บัญชีรับเงิน'>
              {bank ? (
                <Link to='/bank-accounts/$id' params={{ id: bank.id }} className='text-primary hover:underline'>
                  {bank.data?.bank} {bank.data?.acctNo} ({bank.data?.accountName})
                </Link>
              ) : '—'}
            </Field>
          </section>

          {/* จับคู่เงินค้างเข้าใบแจ้งหนี้ (สเต็ป 3) */}
          {canAllocate && (
            <section className='rounded-lg border p-4'>
              <h2 className='mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground'>
                จับคู่กับใบแจ้งหนี้
              </h2>
              <p className='mb-3 text-xs text-muted-foreground'>
                เลือกใบที่จะให้เงินก้อนนี้จ่าย · จ่ายใบเก่าก่อน · ส่วนที่เกินเก็บเป็นเครดิตยกไปจ่ายใบหน้า
              </p>
              <div className='space-y-1'>
                {outstandingInvoices.map(({ inv, out }) => {
                  const prev = allocPreview.get(inv.id)
                  const checked = sel.has(inv.id)
                  return (
                    <label
                      key={inv.id}
                      className='flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/40'
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() =>
                          setSel((p) => {
                            const n = new Set(p)
                            if (n.has(inv.id)) n.delete(inv.id)
                            else n.add(inv.id)
                            return n
                          })
                        }
                      />
                      <span className='flex-1'>
                        {String(inv.data?.invoiceNo ?? inv.id)}
                        {inv.data?.month != null && (
                          <span className='ml-1 text-muted-foreground'>· {String(inv.data.month)}</span>
                        )}
                      </span>
                      <span className='tabular-nums text-muted-foreground'>ค้าง {amt(out, { decimal: 0 })}</span>
                      {prev != null && (
                        <span className='w-24 text-right font-medium tabular-nums text-emerald-600 dark:text-emerald-400'>
                          จ่าย {amt(prev, { decimal: 0 })}
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
              <div className='mt-3 flex items-center justify-between border-t pt-3 text-sm'>
                <span className='text-muted-foreground'>
                  เงินก้อนนี้ {amt(payAmount, { decimal: 0 })} ·{' '}
                  {creditLeft > 0.01 ? (
                    <span className='font-medium text-amber-600 dark:text-amber-400'>
                      เหลือเครดิต {amt(creditLeft, { decimal: 0 })}
                    </span>
                  ) : (
                    <span className='font-medium text-emerald-600 dark:text-emerald-400'>จ่ายครบพอดี</span>
                  )}
                </span>
                <Button size='sm' onClick={handleAllocate} disabled={sel.size === 0 || allocate.isPending}>
                  <Link2 className='size-3.5' /> จับคู่ {sel.size} ใบ
                </Button>
              </div>
            </section>
          )}

          {/* Allocations */}
          {(d.allocations?.length ?? 0) > 0 && (
            <section className='rounded-lg border p-4'>
              <h2 className='mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground'>
                ใบแจ้งหนี้ที่จับคู่ ({d.allocations.length} ใบ)
              </h2>
              <div className='space-y-2'>
                {d.allocations.map((alloc) => {
                  const iv = invoices?.find((i) => i.id === alloc.invoice_id)
                  return (
                    <div key={alloc.invoice_id} className='flex items-center justify-between rounded px-2 py-1 bg-muted/40 text-sm'>
                      <div>
                        {iv ? (
                          <Link to='/invoices/$id' params={{ id: iv.id }} className='text-primary hover:underline font-medium'>
                            {iv.data?.invoiceNo ?? iv.id}
                          </Link>
                        ) : (
                          <span className='font-mono text-xs text-muted-foreground'>{alloc.invoice_id}</span>
                        )}
                        {iv?.data?.description != null && (
                          <span className='ml-2 text-muted-foreground'>{String(iv.data.description)}</span>
                        )}
                      </div>
                      <span className='font-semibold'>{amt(alloc.amount, { decimal: 0 })} บาท</span>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </Main>
    </>
  )
}
