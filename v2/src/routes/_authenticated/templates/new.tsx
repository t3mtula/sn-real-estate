import { createFileRoute } from '@tanstack/react-router'
import { ContractTemplateEditor } from '@/features/templates/template-editor'

function RouteComponent() {
  return <ContractTemplateEditor id={undefined} />
}

export const Route = createFileRoute('/_authenticated/templates/new')({
  component: RouteComponent,
})
