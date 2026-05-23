/**
 * Per-contract clause override editor
 * Stores overrides in contract.data.clauseOverrides: Record<clauseIndex, overriddenText>
 * Empty string = use template default
 */
import { useState } from 'react'
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useActiveContractTemplate as useActiveTemplate } from '@/features/templates/queries'
import { useUpdateContractClauses } from '@/features/contracts/mutations'
import type { Contract } from '@/features/contracts/types'

interface Props {
  contract: Contract
}

export function ClauseOverridePanel({ contract }: Props) {
  const [open, setOpen] = useState(false)
  const { data: tpl } = useActiveTemplate()
  const update = useUpdateContractClauses(contract.id)
  const overrides: Record<string, string> = (contract.data?.clauseOverrides ?? {}) as Record<string, string>
  const [local, setLocal] = useState<Record<string, string>>(overrides)
  const [dirty, setDirty] = useState(false)

  const clauses = tpl?.data?.clauses ?? []
  const overrideCount = Object.values(local).filter((v) => v.trim()).length

  function setOverride(idx: number, val: string) {
    setLocal((prev) => ({ ...prev, [String(idx)]: val }))
    setDirty(true)
  }

  function handleSave() {
    const cleaned: Record<string, string> = {}
    for (const [k, v] of Object.entries(local)) {
      if (v.trim()) cleaned[k] = v.trim()
    }
    update.mutate(cleaned, {
      onSuccess: () => { toast.success('บันทึก clause override แล้ว'); setDirty(false) },
      onError: (e) => toast.error('บันทึกไม่สำเร็จ', { description: String(e) }),
    })
  }

  return (
    <div className='rounded-md border'>
      <button
        type='button'
        className='flex w-full items-center gap-3 px-4 py-3 text-left'
        onClick={() => setOpen((v) => !v)}
      >
        <span className='text-sm font-semibold'>ข้อสัญญา (ปรับเฉพาะฉบับ)</span>
        {overrideCount > 0 && (
          <Badge variant='outline' className='text-indigo-600 dark:text-indigo-400'>
            แก้แล้ว {overrideCount} ข้อ
          </Badge>
        )}
        {dirty && <Badge variant='outline' className='text-amber-600'>ยังไม่บันทึก</Badge>}
        {open ? <ChevronUp className='ml-auto size-4 text-muted-foreground' /> : <ChevronDown className='ml-auto size-4 text-muted-foreground' />}
      </button>

      {open && (
        <div className='border-t px-4 pb-4 pt-3 space-y-4'>
          <p className='text-xs text-muted-foreground'>
            แก้ข้อสัญญาเฉพาะสัญญาฉบับนี้ · ถ้าว่างไว้จะใช้ข้อความจาก template
          </p>

          {clauses.length === 0 && (
            <p className='text-sm text-muted-foreground'>ยังไม่มี template ที่ active</p>
          )}

          {clauses.map((clause, i) => {
            const overridden = local[String(i)]?.trim()
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: index is identity
              <div key={i} className='space-y-1'>
                <div className='flex items-center gap-2'>
                  <Badge variant='outline' className='text-xs font-semibold'>ข้อ {i + 1}</Badge>
                  {overridden && (
                    <Button
                      size='sm'
                      variant='ghost'
                      className='h-6 px-2 text-xs text-muted-foreground'
                      onClick={() => { setOverride(i, ''); }}
                      title='คืนค่าจาก template'
                    >
                      <RotateCcw className='size-3' />
                      คืนค่า
                    </Button>
                  )}
                </div>
                {!overridden && (
                  <p className='rounded bg-muted/50 px-3 py-2 text-xs text-muted-foreground line-clamp-2'>
                    {clause.text || '(ว่าง)'}
                  </p>
                )}
                <Textarea
                  value={local[String(i)] ?? ''}
                  onChange={(e) => setOverride(i, e.target.value)}
                  rows={overridden ? 3 : 1}
                  placeholder='พิมพ์ข้อความแทนที่…'
                  className='text-sm'
                />
              </div>
            )
          })}

          {clauses.length > 0 && (
            <div className='flex justify-end'>
              <Button size='sm' onClick={handleSave} disabled={update.isPending || !dirty}>
                บันทึก
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
