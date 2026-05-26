/**
 * Per-contract clause editor — accordion style
 *
 * Stores full clause snapshot in contract.data.contractClauses[]
 * On first open → initialize from active template.
 * Each clause collapses/expands independently.
 * Modified clauses show a badge vs master template.
 */
import { useState, useEffect, useCallback } from 'react'
import {
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useActiveContractTemplate as useActiveTemplate } from '@/features/templates/queries'
import { useUpdateContractClausesFull } from '@/features/contracts/mutations'
import { DEFAULT_CLAUSES } from '@/features/contracts/print/default-template'
import type { Contract } from '@/features/contracts/types'

type Clause = { text: string; sub: string[] }

function normalize(raw: Array<{ text: string; sub?: string[] }>): Clause[] {
  return raw.map((c) => ({ text: c.text ?? '', sub: c.sub ? [...c.sub] : [] }))
}

function clauseModified(a: Clause, b: Clause | undefined): boolean {
  if (!b) return true
  if (a.text !== b.text) return true
  if (a.sub.length !== b.sub.length) return true
  return a.sub.some((s, i) => s !== b.sub[i])
}

function preview(text: string, maxLen = 72): string {
  const t = text.trim()
  return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t || '(ว่าง)'
}

interface Props {
  contract: Contract
}

export function ClauseOverridePanel({ contract }: Props) {
  const [panelOpen, setPanelOpen] = useState(false)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const { data: tpl } = useActiveTemplate()
  const update = useUpdateContractClausesFull(contract.id)

  const stored = contract.data?.contractClauses
  const masterClauses = normalize(tpl?.data?.clauses ?? DEFAULT_CLAUSES)
  const source = stored ? normalize(stored) : masterClauses

  const [clauses, setClauses] = useState<Clause[]>(source)
  const [dirty, setDirty] = useState(false)
  const hasSnapshot = !!stored

  const modifiedCount = clauses.filter((c, i) => clauseModified(c, masterClauses[i])).length

  useEffect(() => {
    const next = contract.data?.contractClauses
    if (next) {
      setClauses(normalize(next))
      setDirty(false)
    }
  }, [contract.data?.contractClauses])

  const setMainText = useCallback((i: number, val: string) => {
    setClauses((prev) => prev.map((c, idx) => idx === i ? { ...c, text: val } : c))
    setDirty(true)
  }, [])

  const setSubText = useCallback((i: number, j: number, val: string) => {
    setClauses((prev) =>
      prev.map((c, idx) => {
        if (idx !== i) return c
        const sub = [...c.sub]
        sub[j] = val
        return { ...c, sub }
      }),
    )
    setDirty(true)
  }, [])

  const addSub = useCallback((i: number) => {
    setClauses((prev) =>
      prev.map((c, idx) => idx === i ? { ...c, sub: [...c.sub, ''] } : c),
    )
    setDirty(true)
  }, [])

  const removeSub = useCallback((i: number, j: number) => {
    setClauses((prev) =>
      prev.map((c, idx) => {
        if (idx !== i) return c
        return { ...c, sub: c.sub.filter((_, si) => si !== j) }
      }),
    )
    setDirty(true)
  }, [])

  const addClause = useCallback(() => {
    setClauses((prev) => [...prev, { text: '', sub: [] }])
    setDirty(true)
    setExpandedIdx((prev) => (prev === null ? clauses.length : prev))
  }, [clauses.length])

  const removeClause = useCallback((i: number) => {
    setClauses((prev) => prev.filter((_, idx) => idx !== i))
    setExpandedIdx(null)
    setDirty(true)
  }, [])

  const resetClause = useCallback((i: number) => {
    const master = masterClauses[i]
    if (!master) return
    setClauses((prev) => prev.map((c, idx) => idx === i ? { ...master } : c))
    setDirty(true)
  }, [masterClauses])

  const resetAll = useCallback(() => {
    setClauses(masterClauses)
    setDirty(true)
  }, [masterClauses])

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
    <div className='rounded-lg border bg-card'>
      {/* ── Panel header ── */}
      <button
        type='button'
        className='flex w-full items-center gap-3 px-5 py-4 text-left'
        onClick={() => setPanelOpen((v) => !v)}
      >
        <div className='flex flex-1 items-center gap-2.5 min-w-0'>
          <span className='text-sm font-semibold'>ข้อสัญญา (ปรับเฉพาะฉบับ)</span>
          {hasSnapshot && modifiedCount > 0 && (
            <Badge variant='secondary' className='text-indigo-600 dark:text-indigo-400 shrink-0'>
              <Pencil className='size-2.5 mr-1' />
              แก้ {modifiedCount} ข้อ
            </Badge>
          )}
          {!hasSnapshot && (
            <Badge variant='outline' className='text-muted-foreground shrink-0 font-normal'>
              ใช้ template หลัก
            </Badge>
          )}
          {dirty && (
            <Badge variant='outline' className='text-amber-600 shrink-0'>
              ยังไม่บันทึก
            </Badge>
          )}
        </div>
        {panelOpen
          ? <ChevronUp className='size-4 text-muted-foreground shrink-0' />
          : <ChevronDown className='size-4 text-muted-foreground shrink-0' />}
      </button>

      {/* ── Panel body ── */}
      {panelOpen && (
        <div className='border-t'>
          {/* Toolbar */}
          <div className='flex items-center justify-between px-5 py-2.5 border-b bg-muted/30'>
            <p className='text-xs text-muted-foreground'>
              {hasSnapshot
                ? `${clauses.length} ข้อ · แก้เฉพาะสัญญาฉบับนี้ ไม่กระทบ template หลัก`
                : 'กด แก้ไข ที่ข้อใดก็ได้ ระบบจะ copy จาก template ให้อัตโนมัติ'}
            </p>
            <Button
              size='sm'
              variant='ghost'
              className='h-7 px-2 text-xs text-muted-foreground'
              onClick={resetAll}
            >
              <RotateCcw className='size-3 mr-1' />
              คืนค่าทั้งหมด
            </Button>
          </div>

          {/* Clause list */}
          <div className='divide-y'>
            {clauses.map((clause, i) => {
              const isExpanded = expandedIdx === i
              const isModified = clauseModified(clause, masterClauses[i])
              const canReset = isModified && masterClauses[i] !== undefined

              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: index is clause identity
                <div key={i} className={cn('transition-colors', isExpanded && 'bg-muted/20')}>
                  {/* Clause row header */}
                  <div className='flex items-center gap-3 px-5 py-3'>
                    {/* Clause number */}
                    <span className='shrink-0 text-xs font-bold text-muted-foreground w-12'>
                      ข้อ {i + 1}.
                    </span>

                    {/* Preview text */}
                    <button
                      type='button'
                      className='flex-1 text-left text-sm text-foreground/80 truncate hover:text-foreground transition-colors'
                      onClick={() => setExpandedIdx(isExpanded ? null : i)}
                    >
                      {preview(clause.text)}
                    </button>

                    {/* Modified badge */}
                    {isModified && (
                      <Badge
                        variant='outline'
                        className='shrink-0 text-xs text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                      >
                        แก้ไขแล้ว
                      </Badge>
                    )}
                    {!isModified && hasSnapshot && (
                      <span className='shrink-0 flex items-center gap-1 text-xs text-muted-foreground'>
                        <CheckCircle2 className='size-3 text-green-500' />
                        ต้นฉบับ
                      </span>
                    )}

                    {/* Expand toggle */}
                    <Button
                      size='sm'
                      variant='ghost'
                      className='h-7 px-2 text-xs shrink-0'
                      onClick={() => setExpandedIdx(isExpanded ? null : i)}
                    >
                      {isExpanded ? 'ย่อ' : 'แก้ไข'}
                    </Button>
                  </div>

                  {/* Expanded editor */}
                  {isExpanded && (
                    <div className='px-5 pb-4 space-y-3 border-t bg-background'>
                      {/* Main clause textarea */}
                      <div className='pt-3 space-y-1'>
                        <label className='text-xs font-semibold text-muted-foreground uppercase tracking-wide'>
                          ข้อ {i + 1} — ข้อความหลัก
                        </label>
                        <Textarea
                          value={clause.text}
                          onChange={(e) => setMainText(i, e.target.value)}
                          rows={3}
                          placeholder='ข้อความข้อสัญญาหลัก…'
                          className='text-sm resize-none'
                        />
                      </div>

                      {/* Sub-clauses */}
                      {clause.sub.length > 0 && (
                        <div className='space-y-2'>
                          <label className='text-xs font-semibold text-muted-foreground uppercase tracking-wide'>
                            ข้อย่อย
                          </label>
                          {clause.sub.map((sub, j) => (
                            // biome-ignore lint/suspicious/noArrayIndexKey: index is sub identity
                            <div key={j} className='flex items-start gap-2'>
                              <span className='mt-2.5 shrink-0 text-xs font-semibold text-muted-foreground w-8'>
                                {i + 1}.{j + 1}
                              </span>
                              <Textarea
                                value={sub}
                                onChange={(e) => setSubText(i, j, e.target.value)}
                                rows={2}
                                placeholder={`ข้อย่อย ${i + 1}.${j + 1}…`}
                                className='text-sm flex-1 resize-none'
                              />
                              <Button
                                size='icon'
                                variant='ghost'
                                className='size-7 shrink-0 mt-1 text-muted-foreground hover:text-destructive'
                                onClick={() => removeSub(i, j)}
                              >
                                <Trash2 className='size-3.5' />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Clause actions */}
                      <div className='flex items-center justify-between pt-1'>
                        <div className='flex gap-2'>
                          <Button
                            size='sm'
                            variant='outline'
                            className='h-7 px-2.5 text-xs'
                            onClick={() => addSub(i)}
                          >
                            <Plus className='size-3 mr-1' />
                            เพิ่มข้อย่อย
                          </Button>
                          {canReset && (
                            <Button
                              size='sm'
                              variant='ghost'
                              className='h-7 px-2.5 text-xs text-muted-foreground'
                              onClick={() => resetClause(i)}
                            >
                              <RotateCcw className='size-3 mr-1' />
                              คืนต้นฉบับข้อนี้
                            </Button>
                          )}
                        </div>
                        <Button
                          size='sm'
                          variant='ghost'
                          className='h-7 px-2.5 text-xs text-muted-foreground hover:text-destructive'
                          onClick={() => removeClause(i)}
                        >
                          <Trash2 className='size-3 mr-1' />
                          ลบข้อนี้
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className='px-5 py-3 border-t flex items-center justify-between gap-3 bg-muted/20'>
            <Button
              size='sm'
              variant='outline'
              className='text-xs'
              onClick={addClause}
            >
              <Plus className='size-3 mr-1' />
              เพิ่มข้อสัญญา
            </Button>
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
