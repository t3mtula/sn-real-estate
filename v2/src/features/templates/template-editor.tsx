import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Loader2,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  DEFAULT_CLAUSES,
  DEFAULT_CLOSING,
  DEFAULT_INTRO,
} from '@/features/contracts/print/default-template'
import { TemplateA4Preview } from './template-a4-preview'
import { useContractTemplate } from './queries'
import { useCreateTemplate, useUpdateTemplate } from './mutations'
import type { ContractClause, TemplateData } from './types'

type Mode = 'new' | 'edit'

export function ContractTemplateEditor({ id }: { id?: string }) {
  const mode: Mode = !id || id === 'new' ? 'new' : 'edit'
  const navigate = useNavigate()
  const { data: existing, isLoading } = useContractTemplate(
    mode === 'edit' ? id : undefined,
  )
  const create = useCreateTemplate()
  const update = useUpdateTemplate(id ?? '')

  const [draft, setDraft] = useState<TemplateData>(() => ({
    name: '',
    intro: DEFAULT_INTRO,
    closing: DEFAULT_CLOSING,
    clauses: DEFAULT_CLAUSES.map((c) => ({
      text: c.text,
      sub: c.sub ? [...c.sub] : [],
    })),
    version: '',
    notes: '',
  }))
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (mode === 'edit' && existing) {
      setDraft({
        name: existing.data.name ?? '',
        intro: existing.data.intro ?? '',
        closing: existing.data.closing ?? '',
        clauses: (existing.data.clauses ?? []).map((c) => ({
          text: c.text,
          sub: c.sub ? [...c.sub] : [],
        })),
        version: existing.data.version ?? '',
        notes: existing.data.notes ?? '',
      })
      setDirty(false)
    }
  }, [existing, mode])

  const submitting = create.isPending || update.isPending

  function updateClause(i: number, patch: Partial<ContractClause>) {
    setDirty(true)
    setDraft((d) => ({
      ...d,
      clauses: d.clauses.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    }))
  }

  function addClause() {
    setDirty(true)
    setDraft((d) => ({ ...d, clauses: [...d.clauses, { text: '', sub: [] }] }))
  }

  function removeClause(i: number) {
    setDirty(true)
    setDraft((d) => ({ ...d, clauses: d.clauses.filter((_, idx) => idx !== i) }))
  }

  function moveClause(i: number, dir: -1 | 1) {
    const target = i + dir
    if (target < 0 || target >= draft.clauses.length) return
    setDirty(true)
    setDraft((d) => {
      const next = [...d.clauses]
      const a = next[i]
      const b = next[target]
      if (!a || !b) return d
      next[i] = b
      next[target] = a
      return { ...d, clauses: next }
    })
  }

  function addSub(clauseIdx: number) {
    setDirty(true)
    setDraft((d) => ({
      ...d,
      clauses: d.clauses.map((c, i) =>
        i === clauseIdx ? { ...c, sub: [...(c.sub ?? []), ''] } : c,
      ),
    }))
  }

  function updateSub(clauseIdx: number, subIdx: number, value: string) {
    setDirty(true)
    setDraft((d) => ({
      ...d,
      clauses: d.clauses.map((c, i) =>
        i !== clauseIdx
          ? c
          : {
              ...c,
              sub: (c.sub ?? []).map((s, j) => (j === subIdx ? value : s)),
            },
      ),
    }))
  }

  function removeSub(clauseIdx: number, subIdx: number) {
    setDirty(true)
    setDraft((d) => ({
      ...d,
      clauses: d.clauses.map((c, i) =>
        i !== clauseIdx
          ? c
          : { ...c, sub: (c.sub ?? []).filter((_, j) => j !== subIdx) },
      ),
    }))
  }

  async function handleSave(makeActive = false) {
    if (!draft.name.trim()) {
      toast.error('ใส่ชื่อแบบสัญญาก่อน')
      return
    }
    try {
      if (mode === 'new') {
        const r = await create.mutateAsync({ data: draft, active: makeActive })
        toast.success('สร้างแบบสัญญาแล้ว')
        navigate({
          to: '/settings/templates/$id',
          params: { id: r.id },
          replace: true,
        })
      } else {
        await update.mutateAsync({ data: draft })
        toast.success('บันทึกแล้ว')
        setDirty(false)
      }
    } catch (err) {
      toast.error('บันทึกไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  if (mode === 'edit' && isLoading) {
    return (
      <>
        <Header fixed />
        <Main>
          <Skeleton className='mb-4 h-8 w-64' />
          <Skeleton className='h-96 w-full' />
        </Main>
      </>
    )
  }

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main fixed className='flex flex-1 flex-col overflow-hidden'>
        <header className='mb-4 flex flex-wrap items-start gap-3'>
          <Button variant='ghost' size='icon' asChild>
            <Link to='/settings/templates' aria-label='กลับ'>
              <ArrowLeft className='size-4' />
            </Link>
          </Button>
          <div className='flex-1'>
            <div className='flex flex-wrap items-center gap-2'>
              <h1 className='text-2xl font-semibold tracking-tight'>
                {mode === 'new' ? 'สร้างแบบสัญญาใหม่' : draft.name || 'แก้ไขแบบสัญญา'}
              </h1>
              {mode === 'edit' && existing?.is_active && (
                <Badge className='bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'>
                  ใช้งานอยู่
                </Badge>
              )}
              {dirty && (
                <Badge variant='outline' className='text-amber-700 dark:text-amber-300'>
                  ยังไม่บันทึก
                </Badge>
              )}
            </div>
            <p className='mt-1 text-sm text-muted-foreground'>
              เนื้อความสัญญา · ใช้ {'{{tenant}}'} {'{{landlord}}'} เพื่อให้ชื่อ
              คู่สัญญามาเองตอนปริ้น · ใช้ &lt;strong&gt;...&lt;/strong&gt; ตัวหนา
            </p>
          </div>
          <div className='flex gap-2'>
            {mode === 'new' && (
              <Button
                variant='outline'
                onClick={() => handleSave(true)}
                disabled={submitting}
              >
                บันทึก + ใช้แบบนี้
              </Button>
            )}
            <Button onClick={() => handleSave(false)} disabled={submitting}>
              {submitting && <Loader2 className='size-4 animate-spin' />}
              <Save className='size-4' />
              บันทึก
            </Button>
          </div>
        </header>

        {/* Split: left = editor form · right = A4 preview */}
        <div className='flex min-h-0 flex-1 gap-4 overflow-hidden'>

          {/* ─── Left: editor ─── */}
          <div className='flex w-1/2 flex-col gap-4 overflow-y-auto pb-6 pr-1'>

            {/* Meta */}
            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='name'>
                  ชื่อแบบสัญญา <span className='text-destructive'>*</span>
                </Label>
                <Input
                  id='name'
                  value={draft.name}
                  onChange={(e) => {
                    setDirty(true)
                    setDraft((d) => ({ ...d, name: e.target.value }))
                  }}
                  placeholder='เช่น แบบมาตรฐาน · ปรับ ก.พ. 69'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='version'>เวอร์ชั่น (ไม่บังคับ)</Label>
                <Input
                  id='version'
                  value={draft.version ?? ''}
                  onChange={(e) => {
                    setDirty(true)
                    setDraft((d) => ({ ...d, version: e.target.value }))
                  }}
                  placeholder='เช่น v2.1 · 2569-ก.พ.'
                />
              </div>
            </div>

            {/* Intro */}
            <div className='space-y-2'>
              <Label htmlFor='intro'>คำนำสัญญา (Intro)</Label>
              <Textarea
                id='intro'
                value={draft.intro}
                onChange={(e) => {
                  setDirty(true)
                  setDraft((d) => ({ ...d, intro: e.target.value }))
                }}
                rows={4}
                placeholder='สัญญาฉบับนี้ทำขึ้นระหว่าง {{landlord}} ซึ่งต่อไปนี้เรียกว่า "ผู้ให้เช่า"...'
              />
            </div>

            {/* Clauses */}
            <section className='space-y-3'>
              <div className='flex items-center justify-between'>
                <h2 className='text-lg font-semibold'>ข้อสัญญา ({draft.clauses.length})</h2>
                <Button size='sm' variant='outline' onClick={addClause}>
                  <Plus className='size-4' />
                  เพิ่มข้อ
                </Button>
              </div>

              <div className='space-y-3'>
                {draft.clauses.map((c, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: order is the identity here
                  <div
                    key={`c-${i}`}
                    className='rounded-md border bg-card p-4 space-y-3'
                  >
                    <div className='flex items-start gap-2'>
                      <div className='flex flex-col gap-1 pt-1'>
                        <Button
                          size='icon'
                          variant='ghost'
                          className='size-6'
                          onClick={() => moveClause(i, -1)}
                          disabled={i === 0}
                          aria-label='ขึ้น'
                        >
                          <ChevronUp className='size-3' />
                        </Button>
                        <span
                          className='inline-flex items-center justify-center'
                          title='ลำดับ'
                        >
                          <GripVertical className='size-3 text-muted-foreground' />
                        </span>
                        <Button
                          size='icon'
                          variant='ghost'
                          className='size-6'
                          onClick={() => moveClause(i, 1)}
                          disabled={i === draft.clauses.length - 1}
                          aria-label='ลง'
                        >
                          <ChevronDown className='size-3' />
                        </Button>
                      </div>
                      <div className='flex-1 space-y-2'>
                        <div className='flex items-center gap-2'>
                          <Badge variant='outline' className='font-semibold'>
                            ข้อ {i + 1}
                          </Badge>
                          <Button
                            size='sm'
                            variant='ghost'
                            className='ms-auto text-destructive hover:bg-destructive/10 hover:text-destructive'
                            onClick={() => removeClause(i)}
                          >
                            <Trash2 className='size-3' />
                            ลบข้อ
                          </Button>
                        </div>
                        <Textarea
                          value={c.text}
                          onChange={(e) =>
                            updateClause(i, { text: e.target.value })
                          }
                          rows={3}
                          placeholder='เนื้อข้อสัญญา...'
                        />
                        {(c.sub ?? []).map((sub, j) => (
                          // biome-ignore lint/suspicious/noArrayIndexKey: order is identity
                          <div key={`s-${i}-${j}`} className='flex gap-2'>
                            <Badge variant='outline' className='mt-1 h-6 font-normal'>
                              {i + 1}.{j + 1}
                            </Badge>
                            <Textarea
                              value={sub}
                              onChange={(e) => updateSub(i, j, e.target.value)}
                              rows={2}
                              placeholder='ข้อย่อย...'
                              className='flex-1'
                            />
                            <Button
                              size='icon'
                              variant='ghost'
                              className='mt-1 text-destructive hover:bg-destructive/10 hover:text-destructive'
                              onClick={() => removeSub(i, j)}
                              aria-label='ลบข้อย่อย'
                            >
                              <Trash2 className='size-3' />
                            </Button>
                          </div>
                        ))}
                        <Button
                          size='sm'
                          variant='ghost'
                          onClick={() => addSub(i)}
                          className='ml-7 text-muted-foreground'
                        >
                          <Plus className='size-3' />
                          เพิ่มข้อย่อย
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {draft.clauses.length === 0 && (
                  <div className='rounded-md border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground'>
                    ยังไม่มีข้อ · กด "เพิ่มข้อ" เพื่อเริ่ม
                  </div>
                )}
              </div>
            </section>

            {/* Closing */}
            <div className='space-y-2'>
              <Label htmlFor='closing'>คำปิดสัญญา (Closing)</Label>
              <Textarea
                id='closing'
                value={draft.closing}
                onChange={(e) => {
                  setDirty(true)
                  setDraft((d) => ({ ...d, closing: e.target.value }))
                }}
                rows={3}
                placeholder='สัญญานี้ทำขึ้นเป็นสองฉบับ...'
              />
            </div>

            {/* Notes (internal) */}
            <div className='space-y-2'>
              <Label htmlFor='notes'>หมายเหตุภายใน (ไม่ขึ้นในสัญญา)</Label>
              <Textarea
                id='notes'
                value={draft.notes ?? ''}
                onChange={(e) => {
                  setDirty(true)
                  setDraft((d) => ({ ...d, notes: e.target.value }))
                }}
                rows={2}
                placeholder='เช่น แก้ข้อ 3 ตามที่ทนายแนะ · 22 พ.ค. 69'
              />
            </div>

          </div>{/* end left */}

          {/* ─── Right: A4 preview ─── */}
          <div className='flex w-1/2 flex-col overflow-hidden border-l pl-4'>
            <TemplateA4Preview draft={draft} />
          </div>

        </div>{/* end split */}

      </Main>
    </>
  )
}
