import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Loader2 } from 'lucide-react'
import { DateInputBE } from '@/components/date-input-be'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useBankAccounts } from '@/features/bank-accounts/queries'
import { useContracts } from '@/features/contracts/queries'
import { useInvoices, daysOverdue } from '@/features/invoices/queries'
import { useLandlordBankLinks } from '@/features/landlord-banks/queries'
import { amt } from '@/lib/thai'
import { cn } from '@/lib/utils'
import {
  PAYMENT_FORM_DEFAULTS,
  PAY_METHOD_LABELS,
  paymentFormSchema,
  type PaymentFormValues,
} from './schema'
import { useMemo, useState } from 'react'

interface PaymentFormProps {
  defaultValues?: Partial<PaymentFormValues>
  submitting?: boolean
  onSubmit: (values: PaymentFormValues) => Promise<void> | void
  onCancel: () => void
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className='mt-1 text-xs text-destructive'>{children}</p>
}

export function PaymentForm({ defaultValues, submitting, onSubmit, onCancel }: PaymentFormProps) {
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: { ...PAYMENT_FORM_DEFAULTS, ...defaultValues },
    mode: 'onBlur',
  })

  const { data: bankAccounts } = useBankAccounts()
  const { data: contracts } = useContracts()
  const { data: invoices } = useInvoices()

  const contractId = form.watch('contract_id')
  const bankAccountId = form.watch('bank_account_id')
  const selectedInvoiceIds = form.watch('invoice_ids')

  // Landlord of selected contract → filter bank accounts
  const selectedContract = contracts?.find((c) => c.id === contractId)
  const landlordId = selectedContract?.data?.landlord_id
  const { data: landlordBankLinks } = useLandlordBankLinks(landlordId)

  const filteredBanks = useMemo(() => {
    if (!bankAccounts) return []
    if (!landlordId || !landlordBankLinks?.length) return bankAccounts
    const linked = new Set(landlordBankLinks.map((l) => l.bank_account_id))
    const preferred = bankAccounts.filter((b) => linked.has(b.id))
    return preferred.length > 0 ? preferred : bankAccounts
  }, [bankAccounts, landlordId, landlordBankLinks])

  // Unpaid invoices for selected contract
  const contractInvoices = useMemo(() => {
    if (!contractId || !invoices) return []
    return invoices.filter((iv) => {
      if (iv.contract_id !== contractId) return false
      const st = (iv.status ?? iv.data?.status ?? '').toLowerCase()
      return st !== 'paid' && st !== 'voided'
    })
  }, [invoices, contractId])

  const [showAll, setShowAll] = useState(false)
  const visibleInvoices = showAll ? contractInvoices : contractInvoices.filter((iv) => daysOverdue(iv) >= 0 || (iv.data?.remaining_amount ?? iv.data?.total) > 0)

  function toggleInvoice(id: string) {
    const cur = form.getValues('invoice_ids')
    form.setValue(
      'invoice_ids',
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
      { shouldDirty: true },
    )
  }

  async function handleSubmit(values: PaymentFormValues) {
    await onSubmit(values)
  }

  const errors = form.formState.errors

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className='flex flex-col gap-6'>

      {/* Section 1: สัญญา + บัญชี */}
      <section className='grid gap-4 sm:grid-cols-2'>
        <div className='sm:col-span-2'>
          <Label htmlFor='contract_id'>
            สัญญา <span className='text-destructive'>*</span>
          </Label>
          <Select
            value={form.watch('contract_id') || 'none'}
            onValueChange={(v) => {
              form.setValue('contract_id', v === 'none' ? '' : v, { shouldDirty: true })
              form.setValue('invoice_ids', [])
              form.setValue('bank_account_id', '')
            }}
          >
            <SelectTrigger id='contract_id' className={cn(errors.contract_id && 'border-destructive')}>
              <SelectValue placeholder='— เลือกสัญญา —' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='none'>— เลือกสัญญา —</SelectItem>
              {(contracts ?? [])
                .filter((c) => !c.data?.cancelled)
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.data?.no} · {c.data?.tenant ?? c.data?.tenantName ?? ''}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {errors.contract_id && <FieldError>{errors.contract_id.message}</FieldError>}
        </div>

        <div>
          <Label htmlFor='bank_account_id'>บัญชีรับเงิน</Label>
          <Select
            value={form.watch('bank_account_id') || 'none'}
            onValueChange={(v) => form.setValue('bank_account_id', v === 'none' ? '' : v, { shouldDirty: true })}
          >
            <SelectTrigger id='bank_account_id'>
              <SelectValue placeholder='— ไม่ระบุ —' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='none'>— ไม่ระบุ —</SelectItem>
              {filteredBanks.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.data?.bank} · {b.data?.acctNo} · {b.data?.accountName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor='payMethod'>วิธีชำระ</Label>
          <Select
            value={form.watch('payMethod')}
            onValueChange={(v) => form.setValue('payMethod', v as PaymentFormValues['payMethod'], { shouldDirty: true })}
          >
            <SelectTrigger id='payMethod'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PAY_METHOD_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Section 2: วันที่ + ยอด + ผู้โอน */}
      <section className='grid gap-4 sm:grid-cols-2'>
        <div>
          <Label htmlFor='date'>
            วันที่รับเงิน <span className='text-destructive'>*</span>
          </Label>
          <DateInputBE
            id='date'
            value={form.watch('date')}
            onChange={(v) => form.setValue('date', v, { shouldDirty: true, shouldValidate: true })}
            hasError={!!errors.date}
          />
          {errors.date && <FieldError>{errors.date.message}</FieldError>}
        </div>

        <div>
          <Label htmlFor='amount'>
            ยอดรับ (บาท) <span className='text-destructive'>*</span>
          </Label>
          <Input
            id='amount'
            type='number'
            inputMode='decimal'
            step='0.01'
            {...form.register('amount', { valueAsNumber: true })}
            className={cn(errors.amount && 'border-destructive')}
          />
          {errors.amount && <FieldError>{errors.amount.message}</FieldError>}
        </div>

        <div>
          <Label htmlFor='payerName'>ชื่อผู้โอน</Label>
          <Input id='payerName' {...form.register('payerName')} placeholder='ชื่อตามสลิป' />
        </div>

        <div>
          <Label htmlFor='receiptNo'>เลขใบเสร็จ (ออกอัตโนมัติถ้าว่าง)</Label>
          <Input id='receiptNo' {...form.register('receiptNo')} placeholder='REC-20260525-001' />
        </div>
      </section>

      {/* Section 3: จับคู่ใบแจ้งหนี้ */}
      {contractId && contractId !== 'none' && (
        <section>
          <Label className='mb-2 block'>จับคู่ใบแจ้งหนี้ (เลือกได้หลายใบ)</Label>
          {visibleInvoices.length === 0 ? (
            <p className='text-muted-foreground text-sm'>ไม่มีใบแจ้งหนี้ค้างชำระสำหรับสัญญานี้</p>
          ) : (
            <div className='space-y-2 rounded-md border p-3'>
              {visibleInvoices.map((iv) => {
                const outstanding = Number(iv.data?.remaining_amount ?? iv.data?.total ?? 0)
                const isSelected = selectedInvoiceIds.includes(iv.id)
                return (
                  <label
                    key={iv.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 transition-colors',
                      isSelected ? 'bg-primary/5' : 'hover:bg-muted/50',
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleInvoice(iv.id)}
                    />
                    <div className='flex flex-1 items-center justify-between gap-2 text-sm'>
                      <span className='font-medium'>{iv.data?.invoiceNo ?? iv.id}</span>
                      <span className='text-muted-foreground'>{iv.data?.description ?? iv.data?.month ?? ''}</span>
                      <span className='font-semibold'>{amt(outstanding, { decimal: 0 })} บาท</span>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* Section 4: Notes */}
      <section>
        <Label htmlFor='notes'>หมายเหตุ</Label>
        <Textarea id='notes' {...form.register('notes')} rows={2} placeholder='รายละเอียดเพิ่มเติม' />
      </section>

      {/* Actions */}
      <div className='flex gap-2'>
        <Button type='submit' disabled={submitting}>
          {submitting && <Loader2 className='size-4 animate-spin' />}
          บันทึกรับเงิน
        </Button>
        <Button type='button' variant='outline' onClick={onCancel}>ยกเลิก</Button>
      </div>
    </form>
  )
}
