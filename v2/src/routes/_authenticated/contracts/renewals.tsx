import { createFileRoute } from '@tanstack/react-router'
import { Renewals } from '@/features/contracts/renewals'

export const Route = createFileRoute('/_authenticated/contracts/renewals')({
  component: Renewals,
})
