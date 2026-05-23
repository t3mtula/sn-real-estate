import { createFileRoute } from '@tanstack/react-router'
import { ValidationPage } from '@/features/validation/validation-page'

export const Route = createFileRoute('/_authenticated/validation')({
  component: ValidationPage,
})
