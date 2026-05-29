/**
 * Edit a contract template as a Word-like document (<DocEditor>).
 * Loads the template, seeds the editor from its stored Plate `doc` (or, first
 * time, from the legacy structured fields via structuredToPlate), and saves
 * the document back to `data.doc` — additive, leaving the structured fields
 * intact so nothing in the existing print path breaks.
 */
import { useEffect, useState } from 'react'
import type { Value } from 'platejs'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Button } from '@/components/ui/button'
import { BackButton } from '@/components/yonghua/back-button'
import { DocEditor } from '@/components/yonghua/doc-editor'
import { SAMPLE_VALUES } from '@/features/doc-editor/doc-fields'
import { useContractTemplate } from './queries'
import { useUpdateTemplate } from './mutations'
import { structuredToPlate } from './structured-to-plate'

export function TemplateDocEditor({ id }: { id: string }) {
  const { data: template, isLoading } = useContractTemplate(id)
  const update = useUpdateTemplate(id)
  const [value, setValue] = useState<Value | null>(null)
  const [dirty, setDirty] = useState(false)

  // Seed the editor once the template loads.
  useEffect(() => {
    if (template && value === null) {
      setValue(template.data.doc ?? structuredToPlate(template.data))
    }
  }, [template, value])

  async function handleSave() {
    if (!value) return
    await update.mutateAsync({ data: { doc: value } })
    setDirty(false)
    toast.success('บันทึกเอกสารแล้ว')
  }

  if (isLoading || value === null) {
    return (
      <>
        <Header fixed />
        <Main>
          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
            <Loader2 className='size-4 animate-spin' />
            กำลังโหลดเอกสาร…
          </div>
        </Main>
      </>
    )
  }

  return (
    <>
      <Header fixed>
        <BackButton fallback={`/templates/${id}`} />
        <h1 className='ml-2 truncate text-base font-semibold'>
          แก้เอกสาร · {template?.data.name || 'แบบสัญญา'}
        </h1>
        <div className='ml-auto'>
          <Button onClick={handleSave} disabled={!dirty || update.isPending}>
            <Save className='size-4' />
            {update.isPending ? 'กำลังบันทึก…' : 'บันทึก'}
          </Button>
        </div>
      </Header>
      <Main>
        <p className='mb-3 text-xs text-muted-foreground'>
          แก้เอกสารแบบ Word บนหน้า A4 · กด "แทรกข้อมูล" เพื่อใส่ช่องที่เติมค่าจริงให้อัตโนมัติ ·
          แผงขวาคือพรีวิวหน้ากระดาษ (ใช้ข้อมูลตัวอย่าง)
        </p>
        <DocEditor
          value={value}
          previewData={SAMPLE_VALUES}
          onChange={(v) => {
            setValue(v)
            setDirty(true)
          }}
        />
      </Main>
    </>
  )
}
