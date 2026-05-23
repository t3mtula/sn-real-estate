import { createFileRoute } from '@tanstack/react-router'
import { StaffSettingsSection } from '@/features/settings/staff'

export const Route = createFileRoute('/_authenticated/settings/staff')({
  component: StaffSettingsSection,
})
