import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { InvoiceNew } from '@/features/invoices/invoice-new'

const searchSchema = z.object({
  contract: z.string().optional(),
  month: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/invoices/new')({
  component: InvoiceNew,
  validateSearch: searchSchema,
})
