import { createFileRoute } from '@tanstack/react-router'
import { ContractTemplates } from '@/features/templates/templates'

export const Route = createFileRoute('/_authenticated/settings/templates/')({
  component: ContractTemplates,
})
