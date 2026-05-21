import { createFileRoute } from '@tanstack/react-router'
import { Properties } from '@/features/properties/properties'

export const Route = createFileRoute('/_authenticated/properties/')({
  component: Properties,
})
