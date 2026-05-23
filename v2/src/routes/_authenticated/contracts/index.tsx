import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Contracts } from '@/features/contracts/contracts'

const searchSchema = z.object({
  /** Open the side sheet for this contract id (preserves list context) */
  id: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/contracts/')({
  component: Contracts,
  validateSearch: searchSchema,
})
