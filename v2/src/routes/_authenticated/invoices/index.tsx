import { createFileRoute } from '@tanstack/react-router'
import { Invoices } from '@/features/invoices/invoices'

export const Route = createFileRoute('/_authenticated/invoices/')({
  component: Invoices,
})
