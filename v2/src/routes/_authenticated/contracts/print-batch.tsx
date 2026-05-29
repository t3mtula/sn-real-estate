import { createFileRoute } from '@tanstack/react-router'
import { ContractsBatchPrint } from '@/features/contracts/contracts-batch-print'

type BatchPrintSearch = { ids: string }

export const Route = createFileRoute('/_authenticated/contracts/print-batch')({
  validateSearch: (search: Record<string, unknown>): BatchPrintSearch => ({
    ids: typeof search.ids === 'string' ? search.ids : '',
  }),
  component: RouteComponent,
})

function RouteComponent() {
  const { ids } = Route.useSearch()
  const list = ids.split(',').map((s) => s.trim()).filter(Boolean)
  return <ContractsBatchPrint ids={list} />
}
