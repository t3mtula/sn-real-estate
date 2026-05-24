import { useNavigate  } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { ContractForm } from '@/features/contracts/components/contract-form'
import { CONTRACT_FORM_DEFAULTS } from '@/features/contracts/schema'
import {
  DuplicateContractNoError,
  useCreateContract,
} from '@/features/contracts/mutations'
import { BackButton } from '@/components/yonghua/back-button'

export function ContractNew() {
  const create = useCreateContract()
  const navigate = useNavigate()
  // Witness defaults will be filled from selected landlord/tenant (Phase 2)
  const defaultValues = CONTRACT_FORM_DEFAULTS

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
          <BackButton fallback='/contracts' />
          <div>
            <h1 className='text-2xl font-semibold tracking-tight'>
              สร้างสัญญาใหม่
            </h1>
            <p className='text-muted-foreground text-sm'>
              กรอกข้อมูลสัญญา · เลือกผู้เช่า/ผู้ให้เช่า/ทรัพย์/บัญชี
            </p>
          </div>
        </header>

        <div className='max-w-4xl'>
          <ContractForm
            mode='create'
            defaultValues={defaultValues}
            submitting={create.isPending}
            onCancel={() => navigate({ to: '/contracts' })}
            onSubmit={async (values, inline) => {
              try {
                const { id } = await create.mutateAsync({ values, inline })
                navigate({ to: '/contracts/$id', params: { id } })
              } catch (err) {
                if (err instanceof DuplicateContractNoError) {
                  toast.error('เลขสัญญาซ้ำ', {
                    description: `เลขนี้อยู่ในสัญญาของ "${err.conflictTenant}"`,
                    action: {
                      label: 'ดู',
                      onClick: () =>
                        navigate({
                          to: '/contracts/$id',
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
