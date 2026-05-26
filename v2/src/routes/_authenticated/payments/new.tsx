import { createFileRoute } from '@tanstack/react-router'
import { PaymentNew } from '@/features/payments/payment-new'

export const Route = createFileRoute('/_authenticated/payments/new')({
  component: PaymentNew,
})
