import { useEffect } from 'react'
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { isAllowedUser, signOut, useSession } from '@/lib/yh-auth'
import { useAuthStore } from '@/stores/auth-store'

const searchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/auth-callback')({
  component: AuthCallbackPage,
  validateSearch: searchSchema,
})

/**
 * /auth-callback · landing เมื่อ Google OAuth redirect กลับมา
 * Supabase JS auto-detect session ผ่าน URL hash (detectSessionInUrl: true)
 * เรา enforce domain check + populate auth-store + redirect
 */
function AuthCallbackPage() {
  const { session, loading } = useSession()
  const { redirect } = useSearch({ from: '/(auth)/auth-callback' })
  const navigate = useNavigate()
  const { auth } = useAuthStore()

  useEffect(() => {
    if (loading) return

    if (!session) {
      // No session yet · Supabase อาจกำลัง process · รออีกหน่อย
      const timer = setTimeout(() => {
        if (!session) navigate({ to: '/sign-in', replace: true })
      }, 3000)
      return () => clearTimeout(timer)
    }

    if (!isAllowedUser(session.user)) {
      toast.error('Email ไม่อยู่ในโดเมนที่อนุญาต')
      void signOut().then(() => navigate({ to: '/sign-in', replace: true }))
      return
    }

    // Populate auth-store จาก Supabase session
    auth.setUser({
      accountNo: session.user.id,
      email: session.user.email ?? '',
      role: (session.user.app_metadata?.role as string[]) ?? ['user'],
      exp: session.expires_at ? session.expires_at * 1000 : Date.now() + 86400000,
    })
    auth.setAccessToken(session.access_token)

    navigate({ to: redirect || '/', replace: true })
  }, [loading, session, redirect, navigate, auth])

  return (
    <div className='flex min-h-screen items-center justify-center text-muted-foreground'>
      <Loader2 className='mr-2 size-5 animate-spin' />
      <span>กำลังเข้าสู่ระบบ...</span>
    </div>
  )
}
