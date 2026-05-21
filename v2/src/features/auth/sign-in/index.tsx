import { useSearch } from '@tanstack/react-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { UserAuthForm } from './components/user-auth-form'

export function SignIn() {
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })

  return (
    <AuthLayout>
      <Card className='max-w-sm gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>เข้าสู่ระบบ</CardTitle>
          <CardDescription>
            ใช้บัญชี Google ของบริษัท · admin จะตั้งสิทธิ์ให้ก่อนเข้าใช้ได้
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserAuthForm redirectTo={redirect} />
        </CardContent>
        <CardFooter>
          <p className='px-8 text-center text-sm text-muted-foreground'>
            หากเข้าสู่ระบบไม่ได้ ให้ติดต่อ admin
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
