import { createFileRoute } from '@tanstack/react-router'
import { InvoiceSettingsSection } from '@/features/settings/invoice-settings'

export const Route = createFileRoute('/_authenticated/settings/invoice-docs')({
  component: InvoiceSettingsSection,
})
