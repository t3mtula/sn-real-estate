import { createFileRoute, useParams } from '@tanstack/react-router'
import { InvoiceDetail } from '@/features/invoices/invoice-detail'

function RouteComponent() {
  const { id } = useParams({ from: '/_authenticated/invoices/$id/' })
  return <InvoiceDetail id={id} />
}

export const Route = createFileRoute('/_authenticated/invoices/$id/')({
  component: RouteComponent,
})
