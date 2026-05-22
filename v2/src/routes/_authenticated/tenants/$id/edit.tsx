import { createFileRoute } from '@tanstack/react-router'
import { TenantEdit } from '@/features/tenants/tenant-edit'

export const Route = createFileRoute('/_authenticated/tenants/$id/edit')({
  component: TenantEditRoute,
})

function TenantEditRoute() {
  const { id } = Route.useParams()
  return <TenantEdit id={id} />
}
