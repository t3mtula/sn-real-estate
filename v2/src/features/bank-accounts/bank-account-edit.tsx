import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { BankAccountForm } from '@/features/bank-accounts/components/bank-account-form'
import { useBankAccount } from '@/features/bank-accounts/queries'
import { useUpdateBankAccount } from '@/features/bank-accounts/mutations'
import {
  BANK_ACCOUNT_FORM_DEFAULTS,
  type BankAccountFormValues,
} from '@/features/bank-accounts/schema'

export function BankAccountEdit({ id }: { id: string }) {
  const ba = useBankAccount(id)
  const update = useUpdateBankAccount(id)
  const navigate = useNavigate()

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
          <Button variant='ghost' size='icon' asChild>
            <Link to='/bank-accounts/$id' params={{ id }} aria-label='กลับ'>
              <ArrowLeft className='size-4' />
            </Link>
          </Button>
          <div>
            <h1 className='text-2xl font-semibold tracking-tight'>
              แก้ไขบัญชีธนาคาร
            </h1>
            <p className='text-muted-foreground text-sm'>
              {ba.data?.data?.bank ?? 'กำลังโหลด...'}
            </p>
          </div>
        </header>

        <div className='max-w-3xl'>
          {ba.isLoading ? (
            <Skeleton className='h-96 w-full' />
          ) : !ba.data ? (
            <Card>
              <CardHeader>
                <CardTitle>ไม่พบบัญชี</CardTitle>
              </CardHeader>
              <CardContent className='text-sm text-muted-foreground'>
                บัญชี ID{' '}
                <code className='rounded bg-muted px-1.5 py-0.5'>{id}</code>{' '}
                ไม่มีในระบบ
              </CardContent>
            </Card>
          ) : (
            (() => {
              const b = ba.data.data
              const defaults: BankAccountFormValues = {
                ...BANK_ACCOUNT_FORM_DEFAULTS,
                bank: b.bank ?? '',
                branch: b.branch ?? '',
                acctNo: b.acctNo ?? '',
                accountName: b.accountName ?? '',
                label: b.label ?? '',
                ownerLandlordId: b.ownerLandlordId ?? '',
                active: b.active !== false,
                notes: b.notes ?? '',
              }
              return (
                <BankAccountForm
                  mode='edit'
                  cancelTo='/bank-accounts/$id'
                  defaultValues={defaults}
                  submitting={update.isPending}
                  onSubmit={async (values) => {
                    await update.mutateAsync(values)
                    navigate({ to: '/bank-accounts/$id', params: { id } })
                  }}
                />
              )
            })()
          )}
        </div>
      </Main>
    </>
  )
}
