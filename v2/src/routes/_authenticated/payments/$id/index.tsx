import { createFileRoute } from '@tanstack/react-router'
import { PaymentDetail } from '@/features/payments/payment-detail'

export const Route = createFileRoute('/_authenticated/payments/$id/')({
  component: function PaymentPage() {
    const { id } = Route.useParams()
    return <PaymentDetail id={id} />
  },
})
