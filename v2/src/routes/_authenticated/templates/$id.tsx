import { createFileRoute, useParams } from '@tanstack/react-router'
import { ContractTemplateEditor } from '@/features/templates/template-editor'

function RouteComponent() {
  const { id } = useParams({ from: '/_authenticated/templates/$id' })
  return <ContractTemplateEditor id={id} />
}

export const Route = createFileRoute('/_authenticated/templates/$id')({
  component: RouteComponent,
})
