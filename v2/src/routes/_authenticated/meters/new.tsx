import { createFileRoute } from '@tanstack/react-router'
import { MeterNew } from '@/features/meters/meter-new'

export const Route = createFileRoute('/_authenticated/meters/new')({
  component: MeterNew,
})
