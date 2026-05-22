import { createFileRoute } from '@tanstack/react-router'
import { BankAccountNew } from '@/features/bank-accounts/bank-account-new'

export const Route = createFileRoute('/_authenticated/bank-accounts/new')({
  component: BankAccountNew,
})
