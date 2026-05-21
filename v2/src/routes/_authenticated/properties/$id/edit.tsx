import { createFileRoute } from '@tanstack/react-router'
import { PropertyEdit } from '@/features/properties/property-edit'

export const Route = createFileRoute('/_authenticated/properties/$id/edit')({
  component: PropertyEditRoute,
})

function PropertyEditRoute() {
  const { id } = Route.useParams()
  return <PropertyEdit id={id} />
}
