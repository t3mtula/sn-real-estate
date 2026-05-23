import { createFileRoute, useParams } from '@tanstack/react-router'
import { DepositReturnPrint } from '@/features/contracts/components/deposit-return-print'

function RouteComponent() {
  const { id } = useParams({ from: '/_authenticated/contracts/$id/deposit-return' })
  return <DepositReturnPrint id={id} />
}

export const Route = createFileRoute('/_authenticated/contracts/$id/deposit-return')({
  component: RouteComponent,
})
