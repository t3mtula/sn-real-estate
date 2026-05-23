import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Invoices } from '@/features/invoices/invoices'

const searchSchema = z.object({
  /** Open the side sheet for this invoice id (preserves list context) */
  id: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/invoices/')({
  component: Invoices,
  validateSearch: searchSchema,
})
