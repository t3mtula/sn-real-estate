import { createFileRoute, useParams } from '@tanstack/react-router'
import { TemplateDocEditor } from '@/features/templates/template-doc-editor'

function RouteComponent() {
  const { id } = useParams({ from: '/_authenticated/templates/$id/doc' })
  return <TemplateDocEditor id={id} />
}

export const Route = createFileRoute('/_authenticated/templates/$id/doc')({
  component: RouteComponent,
})
