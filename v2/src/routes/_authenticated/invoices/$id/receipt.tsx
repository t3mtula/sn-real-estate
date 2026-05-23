import { createFileRoute } from '@tanstack/react-router'
import { InvoiceReceipt } from '@/features/invoices/invoice-receipt'

export const Route = createFileRoute('/_authenticated/invoices/$id/receipt')({
  component: InvoiceReceipt,
})
