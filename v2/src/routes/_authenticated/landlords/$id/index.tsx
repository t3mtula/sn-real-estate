import { createFileRoute } from '@tanstack/react-router'
import { LandlordDetail } from '@/features/landlords/landlord-detail'

export const Route = createFileRoute('/_authenticated/landlords/$id/')({
  component: LandlordDetailRoute,
})

function LandlordDetailRoute() {
  const { id } = Route.useParams()
  return <LandlordDetail id={id} />
}
