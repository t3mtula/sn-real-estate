import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ContractNew } from '@/features/contracts/contract-new'

const searchSchema = z.object({
  renewFrom: z.string().optional(),
  copyFrom: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/contracts/new')({
  validateSearch: searchSchema,
  component: ContractNew,
})
