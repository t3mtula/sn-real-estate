import { createFileRoute } from '@tanstack/react-router'
import { PropertyDetail } from '@/features/properties/property-detail'

export const Route = createFileRoute('/_authenticated/properties/$id/')({
  component: PropertyDetailRoute,
})

function PropertyDetailRoute() {
  const { id } = Route.useParams()
  return <PropertyDetail id={id} />
}
