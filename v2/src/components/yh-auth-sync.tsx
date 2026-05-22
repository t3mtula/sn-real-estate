import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth-store'

/**
 * YhAuthSync · keep Zustand auth-store in sync with Supabase session
 *
 * Mount ครั้งเดียวที่ App root · listen onAuthStateChange ของ Supabase
 * - login: populate store
 * - logout: clear store + clear cookie
 * - refresh: update access token
 *
 * นี่คือ "bridge" ระหว่าง satnaing auth-store + Yonghua Supabase Auth
 */
export function YhAuthSync() {
  // อ่าน store ผ่าน getState() ใน callback — ห้าม subscribe ที่ component level
  // ไม่งั้น auth ref change ทุก setState → effect re-run → leak Supabase listener
  useEffect(() => {
    let mounted = true
    const { auth } = useAuthStore.getState()

    // Initial sync — ตรวจ session ที่อาจมีอยู่แล้ว
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      const session = data.session
      if (session?.user) {
        auth.setUser({
          accountNo: session.user.id,
          email: session.user.email ?? '',
          role: (session.user.app_metadata?.role as string[]) ?? ['user'],
          exp: session.expires_at ? session.expires_at * 1000 : Date.now() + 86400000,
        })
        auth.setAccessToken(session.access_token)
      }
    })

    // Subscribe to changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      const { auth: currentAuth } = useAuthStore.getState()

      if (event === 'SIGNED_OUT' || !session) {
        currentAuth.reset()
        return
      }

      if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
        currentAuth.setUser({
          accountNo: session.user.id,
          email: session.user.email ?? '',
          role: (session.user.app_metadata?.role as string[]) ?? ['user'],
          exp: session.expires_at ? session.expires_at * 1000 : Date.now() + 86400000,
        })
        currentAuth.setAccessToken(session.access_token)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return null
}
