import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { TenantForm } from '@/features/tenants/components/tenant-form'
import { DuplicateTaxIdError, useCreateTenant } from '@/features/tenants/mutations'

export function TenantNew() {
  const create = useCreateTenant()
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
            <Link to='/tenants' aria-label='กลับ'>
              <ArrowLeft className='size-4' />
            </Link>
          </Button>
          <div>
            <h1 className='text-2xl font-semibold tracking-tight'>
              เพิ่มผู้เช่ารายใหม่
            </h1>
            <p className='text-muted-foreground text-sm'>กรอกข้อมูลผู้เช่า</p>
          </div>
        </header>

        <div className='max-w-4xl'>
          <TenantForm
            mode='create'
            onCancel={() => navigate({ to: '/tenants' })}
            submitting={create.isPending}
            onSubmit={async (values) => {
              try {
                const { id } = await create.mutateAsync(values)
                navigate({ to: '/tenants/$id', params: { id } })
              } catch (err) {
                if (err instanceof DuplicateTaxIdError) {
                  toast.error('เลขผู้เสียภาษีซ้ำ', {
                    description: `มีอยู่แล้วในชื่อ "${err.conflictName}"`,
                    action: {
                      label: 'ดู',
                      onClick: () =>
                        navigate({
                          to: '/tenants/$id',
                          params: { id: err.conflictId },
                        }),
                    },
                  })
                  return // suppress generic error toast in form
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
