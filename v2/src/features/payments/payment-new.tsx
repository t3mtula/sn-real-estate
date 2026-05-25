import { useNavigate } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { BackButton } from '@/components/yonghua/back-button'
import { useCreatePayment } from './mutations'
import { PaymentForm } from './payment-form'

export function PaymentNew() {
  const create = useCreatePayment()
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
          <BackButton fallback='/payments' />
          <div>
            <h1 className='text-2xl font-semibold tracking-tight'>บันทึกรับเงิน</h1>
            <p className='text-muted-foreground text-sm'>
              เลือกสัญญา → กรอกยอด → จับคู่ใบแจ้งหนี้
            </p>
          </div>
        </header>

        <div className='max-w-2xl'>
          <PaymentForm
            submitting={create.isPending}
            onCancel={() => navigate({ to: '/payments' })}
            onSubmit={async (values) => {
              const payment = await create.mutateAsync(values)
              navigate({ to: '/payments/$id', params: { id: payment.id } })
            }}
          />
        </div>
      </Main>
    </>
  )
}
