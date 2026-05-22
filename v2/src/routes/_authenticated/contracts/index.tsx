import { createFileRoute } from '@tanstack/react-router'
import { Contracts } from '@/features/contracts/contracts'

export const Route = createFileRoute('/_authenticated/contracts/')({
  component: Contracts,
})
