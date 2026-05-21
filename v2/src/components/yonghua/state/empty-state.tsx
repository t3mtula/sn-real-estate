import { type LucideIcon, FileQuestion } from 'lucide-react'
import { type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  /** Icon · default FileQuestion */
  icon?: LucideIcon
  title: string
  description?: ReactNode
  /** Call-to-action button label · cta + onCta together */
  cta?: string
  onCta?: () => void
  /** Custom action (overrides cta button) */
  action?: ReactNode
  className?: string
}

/**
 * EmptyState · แสดงเมื่อ list/table ไม่มีข้อมูล
 *
 * Usage:
 *   {customers.length === 0 ? (
 *     <EmptyState
 *       icon={Users}
 *       title="ยังไม่มีลูกค้า"
 *       description="เพิ่มลูกค้ารายแรกเพื่อเริ่มต้น"
 *       cta="เพิ่มลูกค้า"
 *       onCta={() => setOpen(true)}
 *     />
 *   ) : ( ... )}
 */
export function EmptyState({
  icon: Icon = FileQuestion,
  title,
  description,
  cta,
  onCta,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 p-12 text-center',
        className,
      )}
    >
      <div className='flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground'>
        <Icon className='size-6' />
      </div>
      <div className='space-y-1'>
        <h3 className='font-semibold'>{title}</h3>
        {description && <p className='text-sm text-muted-foreground'>{description}</p>}
      </div>
      {action ?? (cta && onCta && (
        <Button type='button' onClick={onCta} size='sm' className='mt-2'>
          {cta}
        </Button>
      ))}
    </div>
  )
}
