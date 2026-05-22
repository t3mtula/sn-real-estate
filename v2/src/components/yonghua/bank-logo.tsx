import { useState } from 'react'
import { Landmark } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fallbackAbbr, findBank } from '@/lib/bank-logo'

type Size = 'sm' | 'md' | 'lg'

const SIZE_CLASS: Record<Size, string> = {
  sm: 'size-6',
  md: 'size-8',
  lg: 'size-10',
}

const SIZE_ABBR_CLASS: Record<Size, string> = {
  sm: 'text-[9px]',
  md: 'text-[10px]',
  lg: 'text-xs',
}

/**
 * Show a Thai bank's official logo (PNG, self-hosted /public/bank-logos/),
 * falling back to a generic Landmark icon + abbreviation when the bank
 * doesn't match any known entry or the image fails to load.
 */
export function BankLogo({
  name,
  size = 'sm',
  className,
}: {
  name: string | null | undefined
  size?: Size
  className?: string
}) {
  const match = findBank(name)
  const [failed, setFailed] = useState(false)

  const wrapClass = cn(
    'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-card',
    SIZE_CLASS[size],
    className,
  )

  if (match && !failed) {
    return (
      <span className={wrapClass} title={match.nameLong}>
        <img
          src={match.logoUrl}
          alt={match.nameLong}
          className='size-full object-contain'
          loading='lazy'
          onError={() => setFailed(true)}
        />
      </span>
    )
  }

  // Fallback: generic icon + abbr
  const abbr = fallbackAbbr(name)
  return (
    <span
      className={cn(wrapClass, 'bg-muted text-muted-foreground')}
      title={name ?? ''}
    >
      {abbr.length <= 2 ? (
        <Landmark className='size-3' />
      ) : (
        <span className={cn('font-bold tabular-nums', SIZE_ABBR_CLASS[size])}>
          {abbr}
        </span>
      )}
    </span>
  )
}
