import { useEffect } from "react"
import { Navigate } from "react-router-dom"
import { isAllowedUser, signOut, useSession } from "@/lib/auth"
import { toast } from "sonner"

/**
 * /auth/callback · Google OAuth redirect lands here
 * Supabase JS handles the session detection automatically (detectSessionInUrl)
 * เรา enforce domain restriction หลัง session มา
 */
export function AuthCallbackPage() {
  const { session, loading } = useSession()

  useEffect(() => {
    if (loading) return
    if (!session) return
    if (!isAllowedUser(session.user)) {
      toast.error("Email ไม่อยู่ในโดเมนที่อนุญาต")
      void signOut()
    }
  }, [loading, session])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        กำลังเข้าสู่ระบบ...
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  if (!isAllowedUser(session.user)) return <Navigate to="/login" replace />
  return <Navigate to="/" replace />
}
