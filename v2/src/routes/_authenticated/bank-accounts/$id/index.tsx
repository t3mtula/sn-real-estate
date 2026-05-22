import { createFileRoute } from '@tanstack/react-router'
import { BankAccountDetail } from '@/features/bank-accounts/bank-account-detail'

export const Route = createFileRoute('/_authenticated/bank-accounts/$id/')({
  component: BankAccountDetailRoute,
})

function BankAccountDetailRoute() {
  const { id } = Route.useParams()
  return <BankAccountDetail id={id} />
}
