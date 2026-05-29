// TEMPORARY public route for visual verification of the Phase 0 spike only.
// Delete before merging — the real route is /_authenticated/lab/wysiwyg.
import { createFileRoute } from '@tanstack/react-router'
import { SidebarProvider } from '@/components/ui/sidebar'
import { WysiwygSpike } from '@/features/doc-editor/wysiwyg-spike'

export const Route = createFileRoute('/spike')({
  component: () => (
    <SidebarProvider>
      <WysiwygSpike />
    </SidebarProvider>
  ),
})
