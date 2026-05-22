import { createFileRoute, useParams } from '@tanstack/react-router'
import { ContractTemplateEditor } from '@/features/templates/template-editor'

function RouteComponent() {
  const { id } = useParams({ from: '/_authenticated/settings/templates/$id' })
  return <ContractTemplateEditor id={id} />
}

export const Route = createFileRoute('/_authenticated/settings/templates/$id')({
  component: RouteComponent,
})
