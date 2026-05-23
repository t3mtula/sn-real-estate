import { createFileRoute, useParams } from '@tanstack/react-router'
import { DepositReturnPrint } from '@/features/contracts/components/deposit-return-print'

function RouteComponent() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { id } = useParams({ strict: false } as any)
  return <DepositReturnPrint id={id as string} />
}

export const Route = createFileRoute('/_authenticated/contracts/$id/deposit-return' as never)({
  component: RouteComponent,
})
