import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { ContractForm } from '@/features/contracts/components/contract-form'
import {
  DuplicateContractNoError,
  useCreateContract,
} from '@/features/contracts/mutations'

export function ContractNew() {
  const create = useCreateContract()
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
            <Link to='/contracts' aria-label='กลับ'>
              <ArrowLeft className='size-4' />
            </Link>
          </Button>
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
