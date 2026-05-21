import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { PropertyForm } from '@/features/properties/components/property-form'
import { useCreateProperty } from '@/features/properties/mutations'

export function PropertyNew() {
  const create = useCreateProperty()
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
            <Link to='/properties' aria-label='กลับ'>
              <ArrowLeft className='size-4' />
            </Link>
          </Button>
          <div>
            <h1 className='text-2xl font-semibold tracking-tight'>
              เพิ่มทรัพย์สินใหม่
            </h1>
            <p className='text-muted-foreground text-sm'>กรอกข้อมูลทรัพย์สิน</p>
          </div>
        </header>

        <div className='max-w-4xl'>
          <PropertyForm
            mode='create'
            cancelTo='/properties'
            submitting={create.isPending}
            onSubmit={async (values) => {
              const { id } = await create.mutateAsync(values)
              navigate({ to: '/properties/$id', params: { id } })
            }}
          />
        </div>
      </Main>
    </>
  )
}
