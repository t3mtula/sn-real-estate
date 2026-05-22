import { createFileRoute } from '@tanstack/react-router'
import { TenantDetail } from '@/features/tenants/tenant-detail'

export const Route = createFileRoute('/_authenticated/tenants/$id/')({
  component: TenantDetailRoute,
})

function TenantDetailRoute() {
  const { id } = Route.useParams()
  return <TenantDetail id={id} />
}
