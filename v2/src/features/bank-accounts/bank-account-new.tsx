import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { BankAccountForm } from '@/features/bank-accounts/components/bank-account-form'
import { useCreateBankAccount } from '@/features/bank-accounts/mutations'
import {
  BANK_ACCOUNT_FORM_DEFAULTS,
  type BankAccountFormValues,
} from '@/features/bank-accounts/schema'

export function BankAccountNew() {
  const create = useCreateBankAccount()
  const navigate = useNavigate()
  // Pre-fill ownerLandlordId from query (?owner=xxx) — used when adding from landlord-detail
  const search = useSearch({ strict: false }) as { owner?: string }
  const ownerFromQuery = search?.owner ?? ''

  const defaults: BankAccountFormValues = {
    ...BANK_ACCOUNT_FORM_DEFAULTS,
    ownerLandlordId: ownerFromQuery,
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
        <header className='flex items-center gap-3'>
          <Button variant='ghost' size='icon' asChild>
            <Link to='/bank-accounts' aria-label='กลับ'>
              <ArrowLeft className='size-4' />
            </Link>
          </Button>
          <div>
            <h1 className='text-2xl font-semibold tracking-tight'>
              เพิ่มบัญชีธนาคาร
            </h1>
            <p className='text-muted-foreground text-sm'>
              บัญชีนี้ใช้ได้กับสัญญาใดก็ได้ · เจ้าของบัญชีเป็นเพียงข้อมูลอ้างอิง
            </p>
          </div>
        </header>

        <div className='max-w-3xl'>
          <BankAccountForm
            mode='create'
            onCancel={() => navigate({ to: '/bank-accounts' })}
            defaultValues={defaults}
            submitting={create.isPending}
            onSubmit={async (values) => {
              const { id } = await create.mutateAsync(values)
              navigate({ to: '/bank-accounts/$id', params: { id } })
            }}
          />
        </div>
      </Main>
    </>
  )
}
