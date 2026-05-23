import { createFileRoute } from '@tanstack/react-router'
import { MeterDetail } from '@/features/meters/meter-detail'

export const Route = createFileRoute('/_authenticated/meters/$id/')({
  component: MeterDetailRoute,
})

function MeterDetailRoute() {
  const { id } = Route.useParams()
  return <MeterDetail id={id} />
}
