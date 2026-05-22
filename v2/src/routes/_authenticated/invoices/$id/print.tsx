import { createFileRoute, useParams } from '@tanstack/react-router'
import { InvoicePrint } from '@/features/invoices/invoice-print'

function RouteComponent() {
  const { id } = useParams({ from: '/_authenticated/invoices/$id/print' })
  return <InvoicePrint id={id} />
}

export const Route = createFileRoute('/_authenticated/invoices/$id/print')({
  component: RouteComponent,
})
