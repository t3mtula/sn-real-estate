import { createFileRoute } from '@tanstack/react-router'
import { AgingReport } from '@/features/reports/aging-report'

export const Route = createFileRoute('/_authenticated/reports/aging')({
  component: AgingReport,
})
