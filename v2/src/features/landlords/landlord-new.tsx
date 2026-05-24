import { useNavigate  } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { LandlordForm } from '@/features/landlords/components/landlord-form'
import {
  DuplicateTaxIdError,
  useCreateLandlord,
} from '@/features/landlords/mutations'
import { BackButton } from '@/components/yonghua/back-button'

export function LandlordNew() {
  const create = useCreateLandlord()
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
          <BackButton fallback='/landlords' />
          <div>
            <h1 className='text-2xl font-semibold tracking-tight'>
              เพิ่มผู้ให้เช่ารายใหม่
            </h1>
            <p className='text-muted-foreground text-sm'>
              กรอกข้อมูลผู้ให้เช่า · ที่อยู่ · บัญชีธนาคาร · VAT · PromptPay
            </p>
          </div>
        </header>

        <div className='max-w-4xl'>
          <LandlordForm
            mode='create'
            onCancel={() => navigate({ to: '/landlords' })}
            submitting={create.isPending}
            onSubmit={async (values) => {
              try {
                const { id } = await create.mutateAsync(values)
                navigate({ to: '/landlords/$id', params: { id } })
              } catch (err) {
                if (err instanceof DuplicateTaxIdError) {
                  toast.error('เลขผู้เสียภาษีซ้ำ', {
                    description: `มีอยู่แล้วในชื่อ "${err.conflictName}"`,
                    action: {
                      label: 'ดู',
                      onClick: () =>
                        navigate({
                          to: '/landlords/$id',
                          params: { id: err.conflictId },
                        }),
                    },
                  })
                  return
                }
                throw err
              }
            }}
          />
        </div>
      </Main>
    </>
  )
}
