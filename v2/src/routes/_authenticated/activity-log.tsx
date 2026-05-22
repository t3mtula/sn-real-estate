import { createFileRoute } from '@tanstack/react-router'
import { ActivityLog } from '@/features/activity-log/activity-log'

export const Route = createFileRoute('/_authenticated/activity-log')({
  component: ActivityLog,
})
