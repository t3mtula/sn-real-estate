import { useEffect, useState } from "react"
import { Navigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { signInWithGoogle, useSession } from "@/lib/auth"

export function LoginPage() {
  const { session, loading } = useSession()
  const [signingIn, setSigningIn] = useState(false)

  useEffect(() => {
    document.title = "เข้าสู่ระบบ · SN Real Estate"
  }, [])

  if (loading) return null
  if (session) return <Navigate to="/" replace />

  async function handleSignIn() {
    setSigningIn(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setSigningIn(false)
      toast.error("เข้าสู่ระบบไม่สำเร็จ", {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">เข้าสู่ระบบ</CardTitle>
          <CardDescription>ใช้บัญชี Google ของบริษัท</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            className="w-full"
            onClick={handleSignIn}
            disabled={signingIn}
          >
            {signingIn ? "กำลังเปิดหน้า Google..." : "เข้าสู่ระบบด้วย Google"}
          </Button>
        </CardContent>
        <CardFooter className="text-center text-xs text-muted-foreground">
          <p className="w-full">
            หากเข้าสู่ระบบไม่ได้ ให้ติดต่อผู้ดูแลระบบ
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
