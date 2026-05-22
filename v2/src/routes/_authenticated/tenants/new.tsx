import { createFileRoute } from '@tanstack/react-router'
import { TenantNew } from '@/features/tenants/tenant-new'

export const Route = createFileRoute('/_authenticated/tenants/new')({
  component: TenantNew,
})
