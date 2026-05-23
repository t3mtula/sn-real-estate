import { MessageCircle, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/copy-button'

interface Props {
  phone: string | null | undefined
}

/**
 * Display a phone number with tap-to-call link, LINE quick-message button,
 * and copy button. Falls back to em-dash if no phone.
 */
export function PhoneActions({ phone }: Props) {
  const raw = (phone ?? '').trim()
  if (!raw) return <p className='text-sm'>—</p>
  // Strip spaces/dashes for tel: + LINE deeplink
  const cleaned = raw.replace(/[\s-]/g, '')
  return (
    <div className='flex items-center gap-1'>
      <a
        href={`tel:${cleaned}`}
        className='text-sm font-medium text-primary underline-offset-4 hover:underline'
      >
        {raw}
      </a>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='size-6'
        asChild
        title='โทร'
      >
        <a href={`tel:${cleaned}`} aria-label='โทร'>
          <Phone className='size-3' />
        </a>
      </Button>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='size-6 text-emerald-600 hover:text-emerald-700'
        asChild
        title='เปิด LINE'
      >
        <a
          href='line://msg/?text='
          target='_blank'
          rel='noopener noreferrer'
          aria-label='เปิด LINE'
        >
          <MessageCircle className='size-3' />
        </a>
      </Button>
      <CopyButton text={cleaned} label='คัดลอกเบอร์' />
    </div>
  )
}
