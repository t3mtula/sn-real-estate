import { createFileRoute } from '@tanstack/react-router'
import { WysiwygSpike } from '@/features/doc-editor/wysiwyg-spike'

export const Route = createFileRoute('/_authenticated/lab/wysiwyg')({
  component: WysiwygSpike,
})
