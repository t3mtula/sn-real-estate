/**
 * Per-contract clause editor
 *
 * Stores a full clause snapshot in contract.data.contractClauses[]
 * (each item: { text: string, sub?: string[] })
 *
 * On first open → initialize from active template (or DEFAULT_TEMPLATE).
 * User can edit main text + every sub-clause independently.
 * Print will prefer contractClauses over template.
 */
import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, RotateCcw, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useActiveContractTemplate as useActiveTemplate } from '@/features/templates/queries'
import { useUpdateContractClausesFull } from '@/features/contracts/mutations'
import { DEFAULT_CLAUSES } from '@/features/contracts/print/default-template'
import type { Contract } from '@/features/contracts/types'

type Clause = { text: string; sub: string[] }

function normalize(raw: Array<{ text: string; sub?: string[] }>): Clause[] {
  return raw.map((c) => ({ text: c.text ?? '', sub: c.sub ? [...c.sub] : [] }))
}

interface Props {
  contract: Contract
}

export function ClauseOverridePanel({ contract }: Props) {
  const [open, setOpen] = useState(false)
  const { data: tpl } = useActiveTemplate()
  const update = useUpdateContractClausesFull(contract.id)

  // ── source of truth: contract snapshot → fallback template → fallback default ──
  const stored = contract.data?.contractClauses
  const templateClauses = tpl?.data?.clauses ?? DEFAULT_CLAUSES
  const source = stored ? normalize(stored) : normalize(templateClauses)

  const [clauses, setClauses] = useState<Clause[]>(source)
  const [dirty, setDirty] = useState(false)
  const hasSnapshot = !!stored

  // sync if contract reloads (after save)
  useEffect(() => {
    const next = contract.data?.contractClauses
    if (next) {
      setClauses(normalize(next))
      setDirty(false)
    }
  }, [contract.data?.contractClauses])

  function setMainText(i: number, val: string) {
    setClauses((prev) => prev.map((c, idx) => idx === i ? { ...c, text: val } : c))
    setDirty(true)
  }

  function setSubText(i: number, j: number, val: string) {
    setClauses((prev) =>
      prev.map((c, idx) => {
        if (idx !== i) return c
        const sub = [...c.sub]
        sub[j] = val
        return { ...c, sub }
      }),
    )
    setDirty(true)
  }

  function addSub(i: number) {
    setClauses((prev) =>
      prev.map((c, idx) => idx === i ? { ...c, sub: [...c.sub, ''] } : c),
    )
    setDirty(true)
  }

  function removeSub(i: number, j: number) {
    setClauses((prev) =>
      prev.map((c, idx) => {
        if (idx !== i) return c
        const sub = c.sub.filter((_, si) => si !== j)
        return { ...c, sub }
      }),
    )
    setDirty(true)
  }

  function addClause() {
    setClauses((prev) => [...prev, { text: '', sub: [] }])
    setDirty(true)
  }

  function removeClause(i: number) {
    setClauses((prev) => prev.filter((_, idx) => idx !== i))
    setDirty(true)
  }

  function resetToTemplate() {
    setClauses(normalize(templateClauses))
    setDirty(true)
  }

  function handleSave() {
    update.mutate(clauses, {
      onSuccess: () => {
        toast.success('บันทึกข้อสัญญาฉบับนี้แล้ว')
        setDirty(false)
      },
      onError: (e) => toast.error('บันทึกไม่สำเร็จ', { description: String(e) }),
    })
  }

  return (
    <div className='rounded-md border'>
      {/* ── Header ── */}
      <button
        type='button'
        className='flex w-full items-center gap-3 px-4 py-3 text-left'
        onClick={() => setOpen((v) => !v)}
      >
        <span className='text-sm font-semibold'>ข้อสัญญา (ปรับเฉพาะฉบับ)</span>
        {hasSnapshot && (
          <Badge variant='outline' className='text-indigo-600 dark:text-indigo-400'>
            แก้ไขเฉพาะฉบับนี้ {clauses.length} ข้อ
          </Badge>
        )}
        {dirty && <Badge variant='outline' className='text-amber-600'>ยังไม่บันทึก</Badge>}
        {open
          ? <ChevronUp className='ml-auto size-4 text-muted-foreground' />
          : <ChevronDown className='ml-auto size-4 text-muted-foreground' />}
      </button>

      {/* ── Body ── */}
      {open && (
        <div className='border-t px-4 pb-4 pt-3 space-y-1'>
          <div className='flex items-center justify-between mb-3'>
            <p className='text-xs text-muted-foreground'>
              {hasSnapshot
                ? 'แก้ข้อสัญญาเฉพาะสัญญาฉบับนี้ · ไม่กระทบ template หลัก'
                : 'ครั้งแรกที่บันทึก ระบบจะ copy ข้อสัญญาจาก template มาให้แก้เฉพาะฉบับนี้'}
            </p>
            <Button
              size='sm'
              variant='ghost'
              className='h-7 px-2 text-xs text-muted-foreground shrink-0'
              onClick={resetToTemplate}
              title='รีเซ็ตกลับไปใช้ template หลัก'
            >
              <RotateCcw className='size-3 mr-1' />
              คืนค่า template
            </Button>
          </div>

          <div className='space-y-4'>
            {clauses.map((clause, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: index is clause identity
              <div key={i} className='rounded border bg-muted/20 p-3 space-y-2'>
                {/* Main clause */}
                <div className='flex items-start gap-2'>
                  <span className='mt-2 shrink-0 text-xs font-bold text-muted-foreground w-10'>
                    ข้อ {i + 1}.
                  </span>
                  <Textarea
                    value={clause.text}
                    onChange={(e) => setMainText(i, e.target.value)}
                    rows={2}
                    placeholder='ข้อความข้อสัญญาหลัก…'
                    className='text-sm flex-1'
                  />
                  <Button
                    size='icon'
                    variant='ghost'
                    className='size-7 shrink-0 text-muted-foreground hover:text-destructive mt-1'
                    onClick={() => removeClause(i)}
                    title='ลบข้อนี้'
                  >
                    <Trash2 className='size-3.5' />
                  </Button>
                </div>

                {/* Sub-clauses */}
                {clause.sub.map((sub, j) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: index is sub identity
                  <div key={j} className='flex items-start gap-2 pl-10'>
                    <span className='mt-2 shrink-0 text-xs font-semibold text-muted-foreground w-8'>
                      {i + 1}.{j + 1}
                    </span>
                    <Textarea
                      value={sub}
                      onChange={(e) => setSubText(i, j, e.target.value)}
                      rows={2}
                      placeholder={`ข้อย่อย ${i + 1}.${j + 1}…`}
                      className='text-sm flex-1'
                    />
                    <Button
                      size='icon'
                      variant='ghost'
                      className='size-7 shrink-0 text-muted-foreground hover:text-destructive mt-1'
                      onClick={() => removeSub(i, j)}
                      title='ลบข้อย่อย'
                    >
                      <Trash2 className='size-3.5' />
                    </Button>
                  </div>
                ))}

                {/* Add sub-clause */}
                <div className='pl-10'>
                  <Button
                    size='sm'
                    variant='ghost'
                    className='h-6 px-2 text-xs text-muted-foreground'
                    onClick={() => addSub(i)}
                  >
                    <Plus className='size-3 mr-1' />
                    เพิ่มข้อย่อย
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Add clause */}
          <div className='pt-1'>
            <Button
              size='sm'
              variant='outline'
              className='w-full text-xs'
              onClick={addClause}
            >
              <Plus className='size-3 mr-1' />
              เพิ่มข้อสัญญา
            </Button>
          </div>

          {/* Save */}
          <div className='flex justify-end pt-2'>
            <Button
              size='sm'
              onClick={handleSave}
              disabled={update.isPending || !dirty}
            >
              {update.isPending ? 'กำลังบันทึก…' : 'บันทึกสัญญาฉบับนี้'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
