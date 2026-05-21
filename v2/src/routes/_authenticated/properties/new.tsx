import { createFileRoute } from '@tanstack/react-router'
import { PropertyNew } from '@/features/properties/property-new'

export const Route = createFileRoute('/_authenticated/properties/new')({
  component: PropertyNew,
})
