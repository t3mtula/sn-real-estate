import { useNavigate } from '@tanstack/react-router'
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
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
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  DEFAULT_CLAUSES,
  DEFAULT_CLOSING,
  DEFAULT_INTRO,
} from '@/features/contracts/print/default-template'
import { TemplateA4Preview } from './template-a4-preview'
import { useContractTemplate, useContractTemplates } from './queries'
import { useCreateTemplate, useUpdateTemplate } from './mutations'
import {
  DEFAULT_ATTACHMENTS,
  type ContractClause,
  type TemplateAttachment,
  type TemplateData,
} from './types'
import { BackButton } from '@/components/yonghua/back-button'

type Mode = 'new' | 'edit'

/* ── Sortable clause card ── */

type ClauseCardProps = {
  id: string
  clause: ContractClause
  index: number
  onUpdate: (patch: Partial<ContractClause>) => void
  onRemove: () => void
  onAddSub: () => void
  onUpdateSub: (subIdx: number, value: string) => void
  onRemoveSub: (subIdx: number) => void
}

function ClauseCard({
  id, clause, index,
  onUpdate, onRemove, onAddSub, onUpdateSub, onRemoveSub,
}: ClauseCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-md border bg-card p-4 space-y-3',
        isDragging && 'opacity-50 ring-2 ring-primary',
      )}
    >
      <div className='flex items-start gap-2'>
        <button
          type='button'
          className='mt-1 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing'
          aria-label='ลากเพื่อเรียงลำดับ'
          {...attributes}
          {...listeners}
        >
          <GripVertical className='size-4' />
        </button>

        <div className='flex-1 space-y-2'>
          <div className='flex items-center gap-2'>
            <Badge variant='outline' className='font-semibold'>
              ข้อ {index + 1}
            </Badge>
            <Button
              size='sm'
              variant='ghost'
              className='ms-auto text-destructive hover:bg-destructive/10 hover:text-destructive'
              onClick={onRemove}
            >
              <Trash2 className='size-3' />
              ลบข้อ
            </Button>
          </div>
          <Textarea
            value={clause.text}
            onChange={(e) => onUpdate({ text: e.target.value })}
            rows={3}
            placeholder='เนื้อข้อสัญญา...'
          />
          {(clause.sub ?? []).map((sub, j) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: order is identity
            <div key={`s-${index}-${j}`} className='flex gap-2'>
              <Badge variant='outline' className='mt-1 h-6 font-normal'>
                {index + 1}.{j + 1}
              </Badge>
              <Textarea
                value={sub}
                onChange={(e) => onUpdateSub(j, e.target.value)}
                rows={2}
                placeholder='ข้อย่อย...'
                className='flex-1'
              />
              <Button
                size='icon'
                variant='ghost'
                className='mt-1 text-destructive hover:bg-destructive/10 hover:text-destructive'
                onClick={() => onRemoveSub(j)}
                aria-label='ลบข้อย่อย'
              >
                <Trash2 className='size-3' />
              </Button>
            </div>
          ))}
          <Button
            size='sm'
            variant='ghost'
            onClick={onAddSub}
            className='ml-7 text-muted-foreground'
          >
            <Plus className='size-3' />
            เพิ่มข้อย่อย
          </Button>
        </div>
      </div>
    </div>
  )
}

export function ContractTemplateEditor({ id }: { id?: string }) {
  const mode: Mode = !id || id === 'new' ? 'new' : 'edit'
  const navigate = useNavigate()
  const { data: existing, isLoading } = useContractTemplate(
    mode === 'edit' ? id : undefined,
  )
  const create = useCreateTemplate()
  const update = useUpdateTemplate(id ?? '')
  const { data: allTemplates } = useContractTemplates()

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
    showWitnesses: true,
    witnessCount: 2,
    showAttachments: true,
    attachments: DEFAULT_ATTACHMENTS.map((a) => ({ ...a })),
    showMap: false,
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
        // Footer config — fall back to safe defaults for older templates
        // saved before these fields existed.
        showWitnesses: existing.data.showWitnesses !== false,
        witnessCount: existing.data.witnessCount === 4 ? 4 : 2,
        showAttachments: existing.data.showAttachments !== false,
        attachments:
          existing.data.attachments && existing.data.attachments.length > 0
            ? existing.data.attachments.map((a) => ({ ...a }))
            : DEFAULT_ATTACHMENTS.map((a) => ({ ...a })),
        showMap: existing.data.showMap === true,
      })
      setDirty(false)
    }
  }, [existing, mode])

  const submitting = create.isPending || update.isPending

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleClauseDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = parseInt(String(active.id).replace('c-', ''))
    const to = parseInt(String(over.id).replace('c-', ''))
    if (isNaN(from) || isNaN(to)) return
    setDirty(true)
    setDraft((d) => ({ ...d, clauses: arrayMove(d.clauses, from, to) }))
  }

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

  /* ── footer-config helpers ── */

  function patch(p: Partial<TemplateData>) {
    setDirty(true)
    setDraft((d) => ({ ...d, ...p }))
  }

  function patchAttachments(fn: (rows: TemplateAttachment[]) => TemplateAttachment[]) {
    setDirty(true)
    setDraft((d) => ({
      ...d,
      attachments: fn(d.attachments ?? []),
    }))
  }

  function addAttachment() {
    patchAttachments((rows) => [...rows, { label: '', checked: true }])
  }

  function updateAttachment(i: number, p: Partial<TemplateAttachment>) {
    patchAttachments((rows) => rows.map((a, idx) => (idx === i ? { ...a, ...p } : a)))
  }

  function removeAttachment(i: number) {
    patchAttachments((rows) => rows.filter((_, idx) => idx !== i))
  }

  function resetAttachments() {
    patchAttachments(() => DEFAULT_ATTACHMENTS.map((a) => ({ ...a })))
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
          to: '/templates/$id',
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
          <BackButton fallback='/templates' />
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
                <Label>เปลี่ยนแบบ / สร้างใหม่</Label>
                <Select
                  value={mode === 'edit' && id ? id : '__new__'}
                  onValueChange={(v) => {
                    if (v === '__new__') {
                      navigate({ to: '/templates/new' })
                    } else if (v !== id) {
                      navigate({ to: '/templates/$id', params: { id: v } })
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='__new__'>
                      <span className='flex items-center gap-1.5 text-primary'>
                        <Plus className='size-3' />
                        สร้างแบบใหม่
                      </span>
                    </SelectItem>
                    {(allTemplates ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.data?.name || '(ไม่ระบุชื่อ)'}
                        {t.is_active ? ' ✓' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Intro */}
            <div className='space-y-2'>
              <Label htmlFor='intro'>คำนำสัญญา</Label>
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

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleClauseDragEnd}
              >
                <SortableContext
                  items={draft.clauses.map((_, i) => `c-${i}`)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className='space-y-3'>
                    {draft.clauses.map((c, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: order is the identity here
                      <ClauseCard
                        key={`c-${i}`}
                        id={`c-${i}`}
                        clause={c}
                        index={i}
                        onUpdate={(patch) => updateClause(i, patch)}
                        onRemove={() => removeClause(i)}
                        onAddSub={() => addSub(i)}
                        onUpdateSub={(j, v) => updateSub(i, j, v)}
                        onRemoveSub={(j) => removeSub(i, j)}
                      />
                    ))}
                    {draft.clauses.length === 0 && (
                      <div className='rounded-md border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground'>
                        ยังไม่มีข้อ · กด "เพิ่มข้อ" เพื่อเริ่ม
                      </div>
                    )}
                  </div>
                </SortableContext>
              </DndContext>
            </section>

            {/* Closing */}
            <div className='space-y-2'>
              <Label htmlFor='closing'>คำปิดสัญญา</Label>
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

            {/* ─── ส่วนท้ายสัญญา ─── */}
            <section className='space-y-3 rounded-md border bg-card p-4'>
              <h2 className='text-lg font-semibold'>ส่วนท้ายสัญญา</h2>

              {/* "ทำที่ ... วันที่ ..." — always on, can't disable */}
              <div className='flex items-start gap-3 rounded-md border border-dashed bg-muted/30 p-3'>
                <Checkbox checked disabled className='mt-0.5' aria-label='แสดงพื้นที่ "ทำที่ ... วันที่ ..."' />
                <div className='flex-1'>
                  <div className='text-sm font-medium'>
                    แสดงพื้นที่ "ทำที่ ... วันที่ ..."
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    บังคับแสดงเสมอ · ค่าจะมาจากตัวสัญญาตอนปริ้น
                  </p>
                </div>
              </div>

              {/* Signatures toggle + witness count */}
              <div className='space-y-3 rounded-md border p-3'>
                <div className='flex items-center justify-between'>
                  <div>
                    <Label htmlFor='showWitnesses' className='text-sm font-medium'>
                      แสดงตารางลายเซ็น
                    </Label>
                    <p className='text-xs text-muted-foreground'>
                      ผู้ให้เช่า · ผู้เช่า · พยาน
                    </p>
                  </div>
                  <Switch
                    id='showWitnesses'
                    checked={draft.showWitnesses !== false}
                    onCheckedChange={(v) => patch({ showWitnesses: v })}
                  />
                </div>

                {draft.showWitnesses !== false && (
                  <div className='space-y-2 border-t pt-3'>
                    <Label className='text-sm'>จำนวนพยาน</Label>
                    <RadioGroup
                      value={String(draft.witnessCount ?? 2)}
                      onValueChange={(v) =>
                        patch({ witnessCount: v === '4' ? 4 : 2 })
                      }
                      className='flex gap-6'
                    >
                      <div className='flex items-center gap-2'>
                        <RadioGroupItem value='2' id='wit-2' />
                        <Label htmlFor='wit-2' className='font-normal'>
                          2 คน (มาตรฐาน)
                        </Label>
                      </div>
                      <div className='flex items-center gap-2'>
                        <RadioGroupItem value='4' id='wit-4' />
                        <Label htmlFor='wit-4' className='font-normal'>
                          4 คน (2 คนต่อฝ่าย)
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}
              </div>

              {/* Attachments checklist */}
              <div className='space-y-3 rounded-md border p-3'>
                <div className='flex items-center justify-between'>
                  <div>
                    <Label htmlFor='showAttachments' className='text-sm font-medium'>
                      แสดงรายการเอกสารแนบท้าย
                    </Label>
                    <p className='text-xs text-muted-foreground'>
                      ☐ เช็คลิสต์เอกสารประกอบ (สำเนาบัตร / โฉนด / ฯลฯ)
                    </p>
                  </div>
                  <Switch
                    id='showAttachments'
                    checked={draft.showAttachments !== false}
                    onCheckedChange={(v) => patch({ showAttachments: v })}
                  />
                </div>

                {draft.showAttachments !== false && (
                  <div className='space-y-2 border-t pt-3'>
                    <div className='flex items-center justify-between'>
                      <Label className='text-sm'>
                        รายการเอกสาร ({(draft.attachments ?? []).length})
                      </Label>
                      <div className='flex gap-2'>
                        <Button
                          size='sm'
                          variant='ghost'
                          type='button'
                          onClick={resetAttachments}
                          className='h-7 text-xs text-muted-foreground'
                        >
                          คืนค่าเริ่มต้น
                        </Button>
                        <Button
                          size='sm'
                          variant='outline'
                          type='button'
                          onClick={addAttachment}
                          className='h-7'
                        >
                          <Plus className='size-3' />
                          เพิ่ม
                        </Button>
                      </div>
                    </div>

                    <div className='space-y-1.5'>
                      {(draft.attachments ?? []).map((a, i) => (
                        <div
                          // biome-ignore lint/suspicious/noArrayIndexKey: order is identity
                          key={`att-${i}`}
                          className='flex items-center gap-2'
                        >
                          <span className='w-5 text-right text-xs text-muted-foreground'>
                            {i + 1}.
                          </span>
                          <Checkbox
                            checked={a.checked}
                            onCheckedChange={(v) =>
                              updateAttachment(i, { checked: v === true })
                            }
                            aria-label='ติ๊กดีฟอลต์'
                          />
                          <Input
                            value={a.label}
                            onChange={(e) =>
                              updateAttachment(i, { label: e.target.value })
                            }
                            placeholder='เช่น สำเนาบัตรประชาชน ผู้เช่า'
                            className='h-8 flex-1'
                          />
                          <Button
                            size='icon'
                            variant='ghost'
                            type='button'
                            onClick={() => removeAttachment(i)}
                            className='size-7 text-destructive hover:bg-destructive/10 hover:text-destructive'
                            aria-label='ลบ'
                          >
                            <Trash2 className='size-3' />
                          </Button>
                        </div>
                      ))}
                      {(draft.attachments ?? []).length === 0 && (
                        <div className='rounded-md border border-dashed bg-muted/30 p-3 text-center text-xs text-muted-foreground'>
                          ไม่มีรายการ · กด "เพิ่ม" หรือ "คืนค่าเริ่มต้น"
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Property map placeholder */}
              <div className='flex items-center justify-between rounded-md border p-3'>
                <div>
                  <Label htmlFor='showMap' className='text-sm font-medium'>
                    แสดงพื้นที่สำหรับผังที่ตั้งทรัพย์สิน
                  </Label>
                  <p className='text-xs text-muted-foreground'>
                    เว้นกรอบไว้สำหรับติด/วาด ผังที่ตั้ง
                  </p>
                </div>
                <Switch
                  id='showMap'
                  checked={draft.showMap === true}
                  onCheckedChange={(v) => patch({ showMap: v })}
                />
              </div>
            </section>

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
