import { useNavigate, useRouter } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export function NotFoundError() {
  const navigate = useNavigate()
  const { history } = useRouter()
  return (
    <div className='h-svh'>
      <div className='m-auto flex h-full w-full flex-col items-center justify-center gap-2'>
        <h1 className='text-[7rem] leading-tight font-bold'>404</h1>
        <span className='font-medium'>ไม่พบหน้านี้</span>
        <p className='text-center text-muted-foreground'>
          เผลอเข้าผิด URL หรือลิงก์เก่า · <br />
          ลองย้อนกลับหรือกลับหน้าแรก
        </p>
        <div className='mt-6 flex gap-4'>
          <Button variant='outline' onClick={() => history.go(-1)}>
            ย้อนกลับ
          </Button>
          <Button onClick={() => navigate({ to: '/' })}>หน้าแรก</Button>
        </div>
      </div>
    </div>
  )
}
