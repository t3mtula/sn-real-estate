import { createFileRoute } from '@tanstack/react-router'
import { OutstandingReport } from '@/features/reports/outstanding-report'

export const Route = createFileRoute('/_authenticated/reports/outstanding')({
  component: OutstandingReport,
})
