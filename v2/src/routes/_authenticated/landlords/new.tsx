import { createFileRoute } from '@tanstack/react-router'
import { LandlordNew } from '@/features/landlords/landlord-new'

export const Route = createFileRoute('/_authenticated/landlords/new')({
  component: LandlordNew,
})
