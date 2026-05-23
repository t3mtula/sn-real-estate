import { useInvoice } from '@/features/invoices/queries'
import { useContract } from '@/features/contracts/queries'
import { useLandlord } from '@/features/landlords/queries'
import { PromptPayQR } from './promptpay-qr'

interface Props {
  invoiceId: string
  total?: number
}

export function PromptPayQRCard({ invoiceId, total }: Props) {
  const { data: invoice } = useInvoice(invoiceId)
  const { data: contract } = useContract(invoice?.contract_id ?? undefined)
  const { data: landlord } = useLandlord(contract?.data?.landlord_id)
  const ppId = landlord?.data?.promptPayId?.trim()

  if (!ppId) return null

  return (
    <div className='rounded-md border bg-card p-4 space-y-2'>
      <p className='text-xs font-semibold text-muted-foreground'>PromptPay QR</p>
      <div className='flex items-start gap-3'>
        <PromptPayQR promptPayId={ppId} amount={total} size={120} txId={invoiceId} />
        <div className='text-xs space-y-1 text-muted-foreground'>
          <p className='font-medium text-foreground'>{landlord?.data?.promptPayName || ppId}</p>
          {landlord?.data?.promptPayBank && <p>{landlord.data.promptPayBank}</p>}
          {total && <p className='font-semibold text-foreground'>{total.toLocaleString('th-TH')} บาท</p>}
          <p className='text-[10px]'>สแกนเพื่อชำระ</p>
        </div>
      </div>
    </div>
  )
}
