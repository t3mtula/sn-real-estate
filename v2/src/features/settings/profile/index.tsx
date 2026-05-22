import { LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/yh-auth'
import { useAuthStore } from '@/stores/auth-store'
import { ContentSection } from '../components/content-section'

export function SettingsProfile() {
  const user = useAuthStore((s) => s.auth.user)

  async function handleSignOut() {
    try {
      await signOut()
      window.location.assign('/sign-in')
    } catch (err) {
      toast.error('ออกจากระบบไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return (
    <ContentSection
      title='บัญชี'
      desc='ข้อมูลบัญชีที่ใช้เข้าระบบ · ถ้าต้องเปลี่ยนชื่อ/อีเมล ต้องแก้ที่ Google Workspace'
    >
      <div className='space-y-4'>
        <div className='space-y-2'>
          <p className='text-sm text-muted-foreground'>อีเมลที่ใช้เข้าระบบ</p>
          <p className='text-base font-medium'>{user?.email || '—'}</p>
        </div>

        {Array.isArray(user?.role) && user.role.length > 0 && (
          <div className='space-y-2'>
            <p className='text-sm text-muted-foreground'>บทบาท</p>
            <p className='text-sm'>{user.role.join(', ')}</p>
          </div>
        )}

        <div className='pt-4'>
          <Button variant='outline' onClick={handleSignOut}>
            <LogOut className='size-4' />
            ออกจากระบบ
          </Button>
        </div>
      </div>
    </ContentSection>
  )
}
