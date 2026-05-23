import { useCompanySettings } from '@/features/settings/queries'
import { PromptPayQR } from './promptpay-qr'

interface Props {
  invoiceId: string
  total?: number
}

export function PromptPayQRCard({ total }: Props) {
  const { data: company } = useCompanySettings()
  const ppId = company?.promptPayId?.trim()

  if (!ppId) return null

  return (
    <div className='rounded-md border bg-card p-4 space-y-2'>
      <p className='text-xs font-semibold text-muted-foreground'>PromptPay QR</p>
      <div className='flex items-start gap-3'>
        <PromptPayQR promptPayId={ppId} amount={total} size={120} />
        <div className='text-xs space-y-1 text-muted-foreground'>
          <p className='font-medium text-foreground'>{company?.promptPayName || ppId}</p>
          {company?.bankName && <p>{company.bankName}</p>}
          {total && <p className='font-semibold text-foreground'>{total.toLocaleString('th-TH')} บาท</p>}
          <p className='text-[10px]'>สแกนเพื่อชำระ</p>
        </div>
      </div>
    </div>
  )
}
