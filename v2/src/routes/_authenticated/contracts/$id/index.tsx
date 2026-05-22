import { createFileRoute } from '@tanstack/react-router'
import { ContractDetail } from '@/features/contracts/contract-detail'

export const Route = createFileRoute('/_authenticated/contracts/$id/')({
  component: ContractDetailRoute,
})

function ContractDetailRoute() {
  const { id } = Route.useParams()
  return <ContractDetail id={id} />
}
