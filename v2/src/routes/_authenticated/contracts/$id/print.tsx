import { createFileRoute, useParams } from '@tanstack/react-router'
import { ContractPrint } from '@/features/contracts/contract-print'

function RouteComponent() {
  const { id } = useParams({ from: '/_authenticated/contracts/$id/print' })
  return <ContractPrint id={id} />
}

export const Route = createFileRoute('/_authenticated/contracts/$id/print')({
  component: RouteComponent,
})
