import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { MeterForm } from '@/features/meters/meter-form'
import { useCreateMeterReading } from '@/features/meters/mutations'
import { METER_READING_FORM_DEFAULTS } from '@/features/meters/schema'

export function MeterNew() {
  const create = useCreateMeterReading()
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
            <Link to='/meters' aria-label='กลับ'>
              <ArrowLeft className='size-4' />
            </Link>
          </Button>
          <div>
            <h1 className='text-2xl font-semibold tracking-tight'>
              เพิ่มการอ่านมิเตอร์
            </h1>
            <p className='text-muted-foreground text-sm'>
              บันทึกค่ามิเตอร์น้ำ/ไฟฟ้า · ระบบคำนวณหน่วยและยอดให้อัตโนมัติ
            </p>
          </div>
        </header>

        <div className='max-w-3xl'>
          <MeterForm
            mode='create'
            defaultValues={METER_READING_FORM_DEFAULTS}
            submitting={create.isPending}
            onCancel={() => navigate({ to: '/meters' })}
            onSubmit={async (values) => {
              const { id } = await create.mutateAsync(values)
              navigate({ to: '/meters/$id', params: { id } })
            }}
          />
        </div>
      </Main>
    </>
  )
}
