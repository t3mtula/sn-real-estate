import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useConfirm } from '@/hooks/use-confirm'
import {
  BANK_ACCOUNT_FORM_DEFAULTS,
  type BankAccountFormValues,
  bankAccountFormSchema,
} from '@/features/bank-accounts/schema'
import { useLandlords } from '@/features/landlords/queries'

type BankAccountFormProps = {
  mode: 'create' | 'edit'
  defaultValues?: BankAccountFormValues
  onSubmit: (values: BankAccountFormValues) => Promise<void> | void
  submitting?: boolean
  cancelTo: string
}

export function BankAccountForm({
  mode,
  defaultValues,
  onSubmit,
  submitting = false,
  cancelTo,
}: BankAccountFormProps) {
  const form = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountFormSchema),
    defaultValues: defaultValues ?? BANK_ACCOUNT_FORM_DEFAULTS,
    mode: 'onBlur',
  })
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { data: landlords } = useLandlords()

  const ownerLandlordId = form.watch('ownerLandlordId')
  const active = form.watch('active')

  async function handleSubmit(values: BankAccountFormValues) {
    try {
      await onSubmit(values)
      toast.success(
        mode === 'create' ? 'เพิ่มบัญชีธนาคารสำเร็จ' : 'บันทึกการแก้ไขแล้ว',
      )
    } catch (err) {
      toast.error('บันทึกไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  async function handleCancel() {
    if (form.formState.isDirty) {
      const ok = await confirm({
        title: 'ยังไม่ได้บันทึก',
        description: 'ออกจากหน้านี้จะเสียข้อมูลที่กรอกไว้ · ออกจริงไหม?',
        confirmLabel: 'ออก',
        destructive: true,
      })
      if (!ok) return
    }
    navigate({ to: cancelTo })
  }

  const errors = form.formState.errors

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      className='flex flex-col gap-6'
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
          e.preventDefault()
        }
      }}
    >
      <section className='grid gap-4 sm:grid-cols-2'>
        <div className='sm:col-span-2'>
          <Label htmlFor='bank'>
            ธนาคาร + สาขา <span className='text-destructive'>*</span>
          </Label>
          <Input
            id='bank'
            {...form.register('bank')}
            placeholder='เช่น ธนาคารกรุงเทพ สาขาบ้านโป่ง'
            aria-invalid={!!errors.bank}
          />
          {errors.bank && (
            <FieldError>{errors.bank.message}</FieldError>
          )}
        </div>

        <div>
          <Label htmlFor='acctNo'>
            เลขบัญชี <span className='text-destructive'>*</span>
          </Label>
          <Input
            id='acctNo'
            {...form.register('acctNo')}
            placeholder='เช่น 276-428500-9'
            aria-invalid={!!errors.acctNo}
          />
          {errors.acctNo && (
            <FieldError>{errors.acctNo.message}</FieldError>
          )}
        </div>

        <div>
          <Label htmlFor='label'>ป้ายกำกับ</Label>
          <Input
            id='label'
            {...form.register('label')}
            placeholder='เช่น หลัก / ค่าน้ำค่าไฟ / สำรอง'
          />
          <p className='mt-1 text-xs text-muted-foreground'>
            แสดงใน dropdown ตอนทำสัญญา
          </p>
        </div>

        <div className='sm:col-span-2'>
          <Label htmlFor='accountName'>ชื่อบัญชี</Label>
          <Input
            id='accountName'
            {...form.register('accountName')}
            placeholder='ชื่อตามสมุดบัญชี (อาจไม่ตรงกับเจ้าของบัญชี)'
          />
          <p className='mt-1 text-xs text-muted-foreground'>
            เช่น บัญชีในนามกรรมการแม้บริษัทเป็นเจ้าของบัญชี · ปรากฏใน contract
          </p>
        </div>
      </section>

      <section className='rounded-md border bg-card p-4'>
        <p className='mb-3 text-sm font-medium'>เจ้าของบัญชี</p>
        <p className='mb-3 text-xs text-muted-foreground'>
          ผูกบัญชีกับผู้ให้เช่าหรือเจ้าของทรัพย์รายหนึ่ง · contract เลือกบัญชีใดก็ได้ (ไม่จำเป็นต้องของผู้ให้เช่าในสัญญา)
        </p>
        <div className='grid gap-3 sm:grid-cols-2'>
          <div>
            <Label htmlFor='ownerLandlordId'>เจ้าของบัญชี</Label>
            <Select
              value={ownerLandlordId || 'none'}
              onValueChange={(v) =>
                form.setValue('ownerLandlordId', v === 'none' ? '' : v, {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger id='ownerLandlordId'>
                <SelectValue placeholder='— ไม่ระบุ —' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='none'>— ไม่ระบุ —</SelectItem>
                {(landlords ?? []).map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.data?.name ?? '(ไม่มีชื่อ)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='flex items-end justify-between gap-3 rounded-md border bg-muted/30 p-3'>
            <div>
              <p className='text-sm font-medium'>เปิดใช้งาน</p>
              <p className='text-xs text-muted-foreground'>
                ปิดได้ถ้าเลิกใช้บัญชีแล้ว (ไม่ลบ)
              </p>
            </div>
            <Switch
              checked={active}
              onCheckedChange={(v) =>
                form.setValue('active', v, { shouldDirty: true })
              }
            />
          </div>
        </div>
      </section>

      <section>
        <Label htmlFor='notes'>หมายเหตุภายใน</Label>
        <Textarea
          id='notes'
          {...form.register('notes')}
          rows={3}
          placeholder='เช่น ใช้กับลูกค้ารายไหน · เงื่อนไขเฉพาะ · เปิดเมื่อ'
        />
      </section>

      <div className='flex items-center justify-end gap-2 border-t pt-4'>
        <Button
          type='button'
          variant='ghost'
          onClick={handleCancel}
          disabled={submitting}
        >
          ยกเลิก
        </Button>
        <Button type='submit' disabled={submitting}>
          {submitting && <Loader2 className='size-4 animate-spin' />}
          {mode === 'create' ? 'เพิ่มบัญชี' : 'บันทึก'}
        </Button>
      </div>
    </form>
  )
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className='mt-1.5 text-xs text-destructive'>{children}</p>
}
