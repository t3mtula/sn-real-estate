import { createFileRoute } from '@tanstack/react-router'
import { MonthlySummary } from '@/features/reports/monthly-summary'

export const Route = createFileRoute('/_authenticated/reports/monthly')({
  component: MonthlySummary,
})
