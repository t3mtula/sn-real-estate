import { createFileRoute } from '@tanstack/react-router'
import { Meters } from '@/features/meters/meters'

export const Route = createFileRoute('/_authenticated/meters/')({
  component: Meters,
})
