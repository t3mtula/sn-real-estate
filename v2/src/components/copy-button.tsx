import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface Props {
  text: string
  label?: string // tooltip
  className?: string
}

export function CopyButton({ text, label = 'คัดลอก', className }: Props) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type='button'
      variant='ghost'
      size='icon'
      className={`size-6 ${className ?? ''}`}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        navigator.clipboard.writeText(text)
        setCopied(true)
        toast.success('คัดลอกแล้ว', { description: text })
        setTimeout(() => setCopied(false), 2000)
      }}
      title={label}
      aria-label={label}
    >
      {copied ? (
        <Check className='size-3 text-emerald-600' />
      ) : (
        <Copy className='size-3' />
      )}
    </Button>
  )
}
