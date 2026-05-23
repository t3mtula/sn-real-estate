import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Properties } from '@/features/properties/properties'

const searchSchema = z.object({
  province: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/properties/')({
  component: Properties,
  validateSearch: searchSchema,
})
