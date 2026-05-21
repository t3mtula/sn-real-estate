import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  /** Optional custom fallback · default = AppErrorFallback */
  fallback?: (error: Error, reset: () => void) => ReactNode
  /** Called when error caught · ส่งไป Sentry · log ฯลฯ */
  onError?: (error: Error, info: ErrorInfo) => void
}

interface State {
  error: Error | null
}

/**
 * ErrorBoundary · กัน white-screen-of-death
 *
 * ครอบ route · ครอบส่วน risky · ดักจับ error · แสดง fallback UI
 *
 * Usage:
 *   <ErrorBoundary onError={(err) => Sentry.captureException(err)}>
 *     <App />
 *   </ErrorBoundary>
 *
 * Note: caught error เฉพาะ render-time · ไม่ catch event handler/async/setTimeout
 * - event handler: try/catch ใน function
 * - async: TanStack Query มี onError
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // log to console + custom handler
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, info)
    this.props.onError?.(error, info)
  }

  reset = () => {
    this.setState({ error: null })
  }

  override render() {
    const { error } = this.state
    if (!error) return this.props.children

    if (this.props.fallback) return this.props.fallback(error, this.reset)
    return <AppErrorFallback error={error} reset={this.reset} />
  }
}

interface AppErrorFallbackProps {
  error: Error
  reset: () => void
}

export function AppErrorFallback({ error, reset }: AppErrorFallbackProps) {
  return (
    <div className='flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center'>
      <div className='flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive'>
        <AlertTriangle className='size-8' />
      </div>
      <div className='space-y-2'>
        <h1 className='text-2xl font-semibold'>เกิดข้อผิดพลาด</h1>
        <p className='text-muted-foreground'>
          ระบบทำงานไม่ได้ชั่วคราว · กดปุ่มด้านล่างเพื่อโหลดใหม่
        </p>
      </div>
      {import.meta.env.DEV && (
        <details className='max-w-2xl rounded-md bg-muted p-4 text-left text-xs'>
          <summary className='cursor-pointer font-medium'>รายละเอียด (dev)</summary>
          <pre className='mt-2 overflow-auto whitespace-pre-wrap'>
            {error.name}: {error.message}
            {'\n\n'}
            {error.stack}
          </pre>
        </details>
      )}
      <div className='flex gap-2'>
        <Button type='button' onClick={reset} variant='default'>
          <RefreshCw className='size-4' />
          ลองใหม่
        </Button>
        <Button
          type='button'
          variant='outline'
          onClick={() => {
            window.location.href = '/'
          }}
        >
          <Home className='size-4' />
          กลับหน้าหลัก
        </Button>
      </div>
    </div>
  )
}
