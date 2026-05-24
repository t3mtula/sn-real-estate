/**
 * BackButton — "กลับ" button that respects browser history.
 *
 * If the user got to this page via in-app navigation, clicking back uses
 * `router.history.back()` to return to where they came from (e.g. invoice
 * detail → property detail → BACK returns to invoice detail).
 *
 * If they landed via direct URL / refresh / bookmark, the browser history
 * has no in-app entry behind us, so we fall back to a sensible default
 * (usually the list page for that entity).
 *
 * Replaces the old pattern of `<Link to='/list'>` which always jumped to
 * the list regardless of how the user arrived.
 *
 * Two visual variants:
 *   - 'icon' (default) — round ghost icon button for headers
 *   - 'text' — ghost button with icon + "กลับ" text · for error / not-found states
 */

import { Link, useCanGoBack, useRouter } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  /** Where to go if there's no app history to go back to (direct URL landing) */
  fallback: string
  /** 'icon' = round icon button (header) · 'text' = ghost button with text */
  variant?: 'icon' | 'text'
  className?: string
  /** Override the aria-label · default "กลับ" */
  ariaLabel?: string
}

export function BackButton({
  fallback,
  variant = 'icon',
  className,
  ariaLabel = 'กลับ',
}: Props) {
  const router = useRouter()
  const canGoBack = useCanGoBack()

  const isIcon = variant === 'icon'
  const buttonProps = isIcon
    ? { variant: 'ghost' as const, size: 'icon' as const }
    : { variant: 'ghost' as const, size: 'sm' as const }
  const defaultClass = isIcon ? 'mt-0.5' : 'self-start'

  const content = (
    <>
      <ArrowLeft className='size-4' />
      {!isIcon && 'กลับ'}
    </>
  )

  if (canGoBack) {
    return (
      <Button
        {...buttonProps}
        aria-label={isIcon ? ariaLabel : undefined}
        className={cn(defaultClass, className)}
        onClick={() => router.history.back()}
      >
        {content}
      </Button>
    )
  }

  return (
    <Button {...buttonProps} asChild className={cn(defaultClass, className)}>
      <Link to={fallback} aria-label={isIcon ? ariaLabel : undefined}>
        {content}
      </Link>
    </Button>
  )
}
