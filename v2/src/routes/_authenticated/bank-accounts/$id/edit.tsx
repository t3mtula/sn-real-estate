import { createFileRoute } from '@tanstack/react-router'
import { BankAccountEdit } from '@/features/bank-accounts/bank-account-edit'

export const Route = createFileRoute('/_authenticated/bank-accounts/$id/edit')({
  component: BankAccountEditRoute,
})

function BankAccountEditRoute() {
  const { id } = Route.useParams()
  return <BankAccountEdit id={id} />
}
