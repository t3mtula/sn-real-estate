import { useState } from 'react'
import { Loader2, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { signInWithGoogle } from '@/lib/yh-auth'

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {
  redirectTo?: string
}

/**
 * Yonghua sign-in · ใช้ Supabase Auth + Google OAuth เท่านั้น
 *
 * Tem & ลูกน้องใช้ Google Workspace ของบริษัท · ไม่ต้องมี password
 * Domain restriction ผ่าน VITE_AUTH_ALLOWED_DOMAIN
 */
export function UserAuthForm({
  className,
  redirectTo,
  ...props
}: UserAuthFormProps) {
  const [isLoading, setIsLoading] = useState(false)

  async function handleGoogleSignIn() {
    setIsLoading(true)
    try {
      const callback = redirectTo
        ? `${window.location.origin}/auth-callback?redirect=${encodeURIComponent(redirectTo)}`
        : `${window.location.origin}/auth-callback`
      await signInWithGoogle(callback)
      // ส่วนใหญ่ browser จะ redirect ไป Google ทันที · ถ้ายังอยู่หน้านี้ = error
    } catch (err) {
      setIsLoading(false)
      toast.error('เข้าสู่ระบบไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return (
    <div className={cn('grid gap-3', className)} {...props}>
      <Button
        type='button'
        className='w-full'
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        size='lg'
      >
        {isLoading ? <Loader2 className='animate-spin' /> : <LogIn />}
        เข้าสู่ระบบด้วย Google
      </Button>
      <p className='text-center text-xs text-muted-foreground'>
        ใช้บัญชี Google ของบริษัท
      </p>
    </div>
  )
}
