import type { Session, User } from "@supabase/supabase-js"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

/**
 * Auth helpers · Google OAuth + optional domain restriction
 *
 * Setup:
 *   1. ตั้ง Supabase Auth → Providers → Google: enable
 *   2. ใส่ Authorized redirect URLs ใน Google Cloud Console:
 *      https://<your-app>.pages.dev/auth/callback
 *      http://localhost:5173/auth/callback (dev)
 *   3. (optional) restrict domain · ใส่ใน .env.local:
 *      VITE_AUTH_ALLOWED_DOMAIN=yonghua.co.th
 */

const allowedDomain = import.meta.env.VITE_AUTH_ALLOWED_DOMAIN as string | undefined

export async function signInWithGoogle(redirectTo?: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo ?? `${window.location.origin}/auth/callback`,
      queryParams: allowedDomain ? { hd: allowedDomain } : undefined,
    },
  })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/**
 * Domain check (run หลัง login · enforce restriction)
 */
export function isAllowedUser(user: User | null): boolean {
  if (!user) return false
  if (!allowedDomain) return true
  const email = user.email?.toLowerCase() ?? ""
  return email.endsWith(`@${allowedDomain.toLowerCase()}`)
}

/**
 * React hook: subscribe to auth state
 *
 * const { session, user, loading } = useSession()
 */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return
      setSession(newSession)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return { session, user: session?.user ?? null, loading }
}
