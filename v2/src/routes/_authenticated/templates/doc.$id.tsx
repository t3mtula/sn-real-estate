import { createFileRoute, useParams } from '@tanstack/react-router'
import { TemplateDocEditor } from '@/features/templates/template-doc-editor'

function RouteComponent() {
  const { id } = useParams({ from: '/_authenticated/templates/doc/$id' })
  return <TemplateDocEditor id={id} />
}

export const Route = createFileRoute('/_authenticated/templates/doc/$id')({
  component: RouteComponent,
})
