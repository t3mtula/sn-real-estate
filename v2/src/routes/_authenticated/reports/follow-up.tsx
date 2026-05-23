import { createFileRoute } from '@tanstack/react-router'
import { FollowUpDashboard } from '@/features/reports/follow-up-dashboard'

export const Route = createFileRoute('/_authenticated/reports/follow-up')({
  component: FollowUpDashboard,
})
