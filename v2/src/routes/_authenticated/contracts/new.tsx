import { createFileRoute } from '@tanstack/react-router'
import { ContractNew } from '@/features/contracts/contract-new'

export const Route = createFileRoute('/_authenticated/contracts/new')({
  component: ContractNew,
})
