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

// รองรับหลาย domain คั่นด้วย comma เช่น "sstpconstruction.com,sombatnapa.com"
const allowedDomainsRaw = import.meta.env.VITE_AUTH_ALLOWED_DOMAIN as string | undefined
const allowedDomains: string[] = allowedDomainsRaw
  ? allowedDomainsRaw.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean)
  : []

// รองรับ specific emails คั่นด้วย comma เช่น "owner@gmail.com,admin@gmail.com"
const allowedEmailsRaw = import.meta.env.VITE_AUTH_ALLOWED_EMAILS as string | undefined
const allowedEmails: string[] = allowedEmailsRaw
  ? allowedEmailsRaw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  : []

export async function signInWithGoogle(redirectTo?: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo ?? `${window.location.origin}/auth/callback`,
      // ไม่ lock hd เพราะมีหลาย domain — Google จะให้เลือก account ได้ตามปกติ
    },
  })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/**
 * Domain + specific email check (run หลัง login · enforce restriction)
 * - ถ้าไม่ตั้ง VITE_AUTH_ALLOWED_DOMAIN เลย → ทุกคนเข้าได้
 * - ถ้าตั้ง VITE_AUTH_ALLOWED_DOMAIN → เฉพาะ domain นั้น
 * - VITE_AUTH_ALLOWED_EMAILS → เพิ่ม specific email นอก domain (เช่น เจ้าของ gmail)
 */
export function isAllowedUser(user: User | null): boolean {
  if (!user) return false
  const email = user.email?.toLowerCase() ?? ""
  if (allowedEmails.includes(email)) return true
  if (allowedDomains.length === 0) return true
  return allowedDomains.some((domain) => email.endsWith(`@${domain}`))
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
