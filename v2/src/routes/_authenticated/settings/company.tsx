import { createFileRoute } from '@tanstack/react-router'
import { CompanySettingsSection } from '@/features/settings/company'

export const Route = createFileRoute('/_authenticated/settings/company')({
  component: CompanySettingsSection,
})
