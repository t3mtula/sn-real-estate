import { createFileRoute } from '@tanstack/react-router'
import { LandlordEdit } from '@/features/landlords/landlord-edit'

export const Route = createFileRoute('/_authenticated/landlords/$id/edit')({
  component: LandlordEditRoute,
})

function LandlordEditRoute() {
  const { id } = Route.useParams()
  return <LandlordEdit id={id} />
}
