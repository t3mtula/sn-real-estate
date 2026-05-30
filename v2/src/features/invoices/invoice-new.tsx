import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useSearch  } from '@tanstack/react-router'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useBankAccounts } from '@/features/bank-accounts/queries'
import { useBankAccountsForLandlord } from '@/features/landlord-banks/queries'
import { useContract, useContracts } from '@/features/contracts/queries'
import { useLandlord } from '@/features/landlords/queries'
import { useProperty } from '@/features/properties/queries'
import { useTenant } from '@/features/tenants/queries'
import {
  DuplicateInvoiceError,
  fetchUnbilledUtilitiesByContract,
  useGenerateInvoiceFromContract,
} from '@/features/invoices/mutations'
import {
  formatMonth,
  getInvoiceAmount,
  getPaymentFreq,
} from '@/features/invoices/queries'
import {
  GENERATE_INVOICE_DEFAULTS,
  generateInvoiceFormSchema,
  type GenerateInvoiceFormValues,
} from '@/features/invoices/schema'
import { amt } from '@/lib/thai'
import { BackButton } from '@/components/yonghua/back-button'

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function buildMonthOptions(): string[] {
  const out: string[] = []
  const now = new Date()
  // 6 months ahead + current + 12 months back
  for (let offset = 6; offset >= -12; offset--) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

export function InvoiceNew() {
  const navigate = useNavigate()
  const search = useSearch({ from: '/_authenticated/invoices/new' }) as {
    contract?: string
    month?: string
  }
  const { data: contracts } = useContracts()
  const { data: banks } = useBankAccounts()
  const create = useGenerateInvoiceFromContract()

  const form = useForm<GenerateInvoiceFormValues>({
    resolver: zodResolver(generateInvoiceFormSchema),
    defaultValues: {
      ...GENERATE_INVOICE_DEFAULTS,
      contract_id: search?.contract ?? '',
      month: search?.month ?? currentMonth(),
    },
    mode: 'onBlur',
  })

  const contractId = form.watch('contract_id')
  const month = form.watch('month')
  const category = form.watch('category')
  const amountOverride = form.watch('amount')

  const { data: contract } = useContract(contractId || undefined)
  const tenantId = contract?.data?.tenant_id
  const landlordId = contract?.data?.landlord_id
  const propertyKey =
    contract?.data?.pid_property != null ? String(contract.data.pid_property) : undefined
  const { data: tenant } = useTenant(tenantId)
  const { data: landlord } = useLandlord(landlordId)
  const { data: property } = useProperty(propertyKey)

  // Auto-fill bank from contract on contract change
  useEffect(() => {
    if (!contract?.data?.bankAccountId) return
    if (form.getValues('bankAccountId')) return
    form.setValue('bankAccountId', contract.data.bankAccountId as string)
  }, [contract, form])

  const activeContracts = useMemo(() => {
    if (!contracts) return []
    return contracts
      .filter((c) => !c.data?.cancelled)
      .sort((a, b) => {
        const an = (a.data?.no ?? '').trim()
        const bn = (b.data?.no ?? '').trim()
        return an < bn ? 1 : an > bn ? -1 : 0
      })
  }, [contracts])

  const monthOptions = useMemo(() => buildMonthOptions(), [])
  const { data: landlordBanks } = useBankAccountsForLandlord(landlordId)
  const banksByOwner = useMemo(() => {
    if (!banks) return []
    if (!landlordId) return banks
    return landlordBanks && landlordBanks.length > 0 ? landlordBanks : banks
  }, [banks, landlordBanks, landlordId])

  const freq = getPaymentFreq(contract?.data)
  const computedAmount =
    category === 'deposit'
      ? Number(contract?.data?.deposit) || 0
      : getInvoiceAmount(
          contract?.data?.rate as number | undefined,
          contract?.data,
        )
  const finalAmount = Number(amountOverride ?? computedAmount) || computedAmount

  // รายการเพิ่ม (ค่าน้ำ/ไฟ/ค่าอื่น) — กรอกมือ
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'extraItems',
  })
  const extraItems = form.watch('extraItems') ?? []
  const extrasSum = extraItems.reduce(
    (s, it) => s + (Number(it?.amount) || 0),
    0,
  )

  // มิเตอร์ที่จะเข้าใบนี้ (preview · เฉพาะค่าเช่า · เดือน X ← จดเดือน X-1)
  const { data: utilMap } = useQuery({
    queryKey: ['util-preview', contractId, month, category],
    queryFn: () => fetchUnbilledUtilitiesByContract([contract!], month),
    enabled: !!contract && category === 'rent' && !!month,
  })
  const previewUtils = (contract ? utilMap?.get(contract.id) : undefined) ?? []
  const utilSum = previewUtils.reduce((s, u) => s + u.amount, 0)
  const grandTotal = finalAmount + utilSum + extrasSum

  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(values: GenerateInvoiceFormValues) {
    if (!contract) {
      toast.error('ไม่พบสัญญา')
      return
    }
    setSubmitting(true)
    try {
      // ยอดดึงอัตโนมัติจากสัญญาเสมอ (ช่องยอด read-only) — กัน NaN/พิมพ์ผิด
      const { id } = await create.mutateAsync({
        values: { ...values, amount: finalAmount },
        contract,
        tenant: tenant ?? null,
        landlord: landlord ?? null,
        property: property ?? null,
      })
      toast.success('ออกใบแจ้งหนี้แล้ว')
      navigate({ to: '/invoices/$id', params: { id } })
    } catch (err) {
      if (err instanceof DuplicateInvoiceError) {
        toast.error('ใบแจ้งของเดือนนี้มีอยู่แล้ว', {
          description: `ใบ ${err.conflictNo}`,
          action: {
            label: 'ดู',
            onClick: () =>
              navigate({ to: '/invoices/$id', params: { id: err.conflictId } }),
          },
        })
      } else {
        toast.error('ออกใบแจ้งไม่สำเร็จ', {
          description: err instanceof Error ? err.message : String(err),
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const errors = form.formState.errors

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-6'>
        <header className='flex items-center gap-3'>
          <BackButton fallback='/invoices' />
          <div>
            <h1 className='text-2xl font-semibold tracking-tight'>ออกใบแจ้งหนี้ใหม่</h1>
            <p className='text-muted-foreground text-sm'>
              เลือกสัญญา + เดือน · ระบบคำนวณยอด/วันครบกำหนดอัตโนมัติจากสัญญา
            </p>
          </div>
        </header>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className='grid max-w-3xl gap-5'
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
              e.preventDefault()
            }
          }}
        >
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2 sm:col-span-2'>
              <Label htmlFor='contract'>
                สัญญา <span className='text-destructive'>*</span>
              </Label>
              <Select
                value={form.watch('contract_id')}
                onValueChange={(v) => form.setValue('contract_id', v)}
              >
                <SelectTrigger id='contract'>
                  <SelectValue placeholder='เลือกสัญญา...' />
                </SelectTrigger>
                <SelectContent>
                  {activeContracts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className='font-medium'>{c.data?.no || `#${c.id}`}</span>
                      <span className='ml-2 text-muted-foreground'>
                        · {c.data?.tenant || '—'}
                        {c.data?.property ? ` · ${c.data.property}` : ''}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.contract_id && (
                <p className='text-xs text-destructive'>{errors.contract_id.message}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='month'>
                เดือนที่ออกใบ <span className='text-destructive'>*</span>
              </Label>
              <Select
                value={form.watch('month')}
                onValueChange={(v) => form.setValue('month', v)}
              >
                <SelectTrigger id='month'>
                  <SelectValue placeholder='เลือกเดือน...' />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                    <SelectItem key={m} value={m}>
                      {formatMonth(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.month && (
                <p className='text-xs text-destructive'>{errors.month.message}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='category'>ประเภท</Label>
              <Select
                value={form.watch('category')}
                onValueChange={(v) =>
                  form.setValue('category', v as 'rent' | 'deposit')
                }
              >
                <SelectTrigger id='category'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='rent'>ค่าเช่า</SelectItem>
                  <SelectItem value='deposit'>เงินประกัน</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='dueDay'>วันครบกำหนด (วันที่ของเดือน)</Label>
              <Input
                id='dueDay'
                type='number'
                min={1}
                max={31}
                {...form.register('dueDay', { valueAsNumber: true })}
              />
              {errors.dueDay && (
                <p className='text-xs text-destructive'>{errors.dueDay.message}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='amount'>ยอด (บาท)</Label>
              <Input
                id='amount'
                type='text'
                readOnly
                tabIndex={-1}
                value={amt(finalAmount, { symbol: false })}
                className='bg-muted/50 cursor-default font-medium'
              />
              <p className='text-xs text-muted-foreground'>
                {category === 'deposit'
                  ? `เงินประกันตามสัญญา ${amt(computedAmount)}`
                  : `ยอดอัตโนมัติจากสัญญา = ค่าเช่า × งวด ${freq.months} เดือน = ${amt(computedAmount)}`}
              </p>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='bank'>บัญชีรับเงิน</Label>
              <Select
                value={form.watch('bankAccountId') || ''}
                onValueChange={(v) => form.setValue('bankAccountId', v === '__none' ? '' : v)}
              >
                <SelectTrigger id='bank'>
                  <SelectValue placeholder='ใช้บัญชีตามสัญญา' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__none'>(ไม่ระบุ)</SelectItem>
                  {banksByOwner.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.data?.bank ? `${b.data.bank} · ` : ''}
                      {b.data?.acctNo || b.id}
                      {b.data?.accountName ? ` · ${b.data.accountName}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2 sm:col-span-2'>
              <Label htmlFor='note'>คำอธิบายเพิ่มเติม (ถ้าต้องการแทนข้อความมาตรฐาน)</Label>
              <Textarea
                id='note'
                rows={2}
                placeholder='เว้นว่าง = ใช้คำบรรยายมาตรฐาน "ค่าเช่าประจำเดือน..."'
                {...form.register('note')}
              />
            </div>

            <div className='space-y-2 sm:col-span-2'>
              <div className='flex items-center justify-between'>
                <Label>รายการเพิ่ม (ค่าน้ำ · ค่าไฟ · ค่าอื่น)</Label>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => append({ desc: '', amount: 0 })}
                >
                  <Plus className='size-4' />
                  เพิ่มรายการ
                </Button>
              </div>
              {fields.length === 0 ? (
                <p className='text-xs text-muted-foreground'>
                  ยังไม่มีรายการเพิ่ม · เช่น ค่าน้ำ/ค่าไฟ — กด "เพิ่มรายการ"
                </p>
              ) : (
                <div className='space-y-2'>
                  {fields.map((f, i) => (
                    <div key={f.id} className='flex items-start gap-2'>
                      <Input
                        placeholder='รายการ เช่น ค่าน้ำเดือน พ.ค.'
                        className='flex-1'
                        {...form.register(`extraItems.${i}.desc` as const)}
                      />
                      <Input
                        type='number'
                        min={0}
                        step='0.01'
                        placeholder='ยอด'
                        className='w-32'
                        {...form.register(`extraItems.${i}.amount` as const, {
                          valueAsNumber: true,
                        })}
                      />
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        className='shrink-0 text-destructive'
                        onClick={() => remove(i)}
                        aria-label='ลบรายการ'
                      >
                        <Trash2 className='size-4' />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className='rounded-md border bg-muted/30 p-4 text-sm'>
            <h3 className='mb-2 text-sm font-medium'>สรุปก่อนออก</h3>
            {contract ? (
              <ul className='space-y-1 text-muted-foreground'>
                <li>
                  สัญญา: <span className='text-foreground'>{contract.data?.no || `#${contract.id}`}</span>
                </li>
                <li>
                  ผู้เช่า:{' '}
                  <span className='text-foreground'>
                    {tenant?.data?.name || contract.data?.tenant || '—'}
                  </span>
                </li>
                <li>
                  ผู้ให้เช่า:{' '}
                  <span className='text-foreground'>
                    {landlord?.data?.name || contract.data?.landlord || '—'}
                  </span>
                </li>
                <li>
                  ทรัพย์สิน:{' '}
                  <span className='text-foreground'>
                    {property?.data?.name || String(contract.data?.property ?? '') || '—'}
                  </span>
                </li>
                <li>
                  เดือน: <span className='text-foreground'>{formatMonth(month)}</span>
                </li>
                <li>
                  {category === 'deposit' ? 'เงินประกัน' : 'ค่าเช่า'}:{' '}
                  <span className='text-foreground'>{amt(finalAmount)}</span>
                </li>
                {previewUtils.map((u, i) => (
                  <li key={`util-${i}`}>
                    {u.label} ({u.units} หน่วย):{' '}
                    <span className='text-foreground'>{amt(u.amount)}</span>
                  </li>
                ))}
                {extraItems
                  .filter(
                    (it) =>
                      (it?.desc?.trim() || '') !== '' &&
                      (Number(it?.amount) || 0) > 0,
                  )
                  .map((it, i) => (
                    <li key={i}>
                      {it.desc}:{' '}
                      <span className='text-foreground'>
                        {amt(Number(it.amount) || 0)}
                      </span>
                    </li>
                  ))}
                <li className='font-medium'>
                  รวมทั้งใบ:{' '}
                  <span className='text-foreground'>{amt(grandTotal)}</span>
                </li>
              </ul>
            ) : (
              <p className='text-muted-foreground'>เลือกสัญญาก่อนเพื่อดูสรุป</p>
            )}
          </div>

          <div className='flex justify-end gap-2'>
            <Button
              type='button'
              variant='ghost'
              onClick={() => navigate({ to: '/invoices' })}
              disabled={submitting}
            >
              ยกเลิก
            </Button>
            <Button type='submit' disabled={submitting || !contract}>
              {submitting && <Loader2 className='size-4 animate-spin' />}
              ออกใบแจ้ง
            </Button>
          </div>
        </form>
      </Main>
    </>
  )
}
