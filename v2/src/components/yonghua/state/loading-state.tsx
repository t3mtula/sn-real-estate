import { Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface LoadingStateProps {
  /** "table" = skeleton rows · "card" = skeleton cards · "spinner" = simple spinner */
  variant?: 'table' | 'card' | 'spinner'
  /** Number of skeleton items · default 5 */
  rows?: number
  /** Optional label (e.g., "กำลังโหลดลูกค้า...") · only used with spinner */
  label?: string
  className?: string
}

/**
 * LoadingState · placeholder ตอนกำลังดึงข้อมูล
 *
 * Usage:
 *   {customers.isLoading ? (
 *     <LoadingState variant="table" rows={8} />
 *   ) : ( <Table data={customers.data} /> )}
 *
 *   <LoadingState variant="spinner" label="กำลังโหลด..." />
 */
export function LoadingState({
  variant = 'table',
  rows = 5,
  label,
  className,
}: LoadingStateProps) {
  if (variant === 'spinner') {
    return (
      <div className={cn('flex items-center justify-center gap-3 p-12 text-muted-foreground', className)}>
        <Loader2 className='size-5 animate-spin' />
        {label && <span className='text-sm'>{label}</span>}
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
            key={i}
            className='space-y-2 rounded-lg border bg-card p-4'
          >
            <Skeleton className='h-4 w-3/4' />
            <Skeleton className='h-3 w-1/2' />
            <Skeleton className='h-16 w-full' />
          </div>
        ))}
      </div>
    )
  }

  // table variant
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
          key={i}
          className='flex items-center gap-4 rounded-md border bg-card p-3'
        >
          <Skeleton className='size-8 rounded-full' />
          <Skeleton className='h-4 flex-1 max-w-sm' />
          <Skeleton className='h-4 w-24' />
          <Skeleton className='h-4 w-16' />
        </div>
      ))}
    </div>
  )
}
