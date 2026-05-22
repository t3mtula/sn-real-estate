import { createFileRoute } from '@tanstack/react-router'
import { Landlords } from '@/features/landlords/landlords'

export const Route = createFileRoute('/_authenticated/landlords/')({
  component: Landlords,
})
