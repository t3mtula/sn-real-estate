import { AlertTriangle, Check, Loader2, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  useCascadingFilter,
  FilterBar,
  type FilterField,
} from '@/components/yonghua/cascading-filter'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useBatchGeneratePreview,
  useGenerateMonthlyInvoices,
  type BatchGeneratePreview,
} from '@/features/invoices/mutations'
import { formatMonth } from '@/features/invoices/queries'
import { useContractTags } from '@/features/contracts/queries'
import { TagInput } from '@/components/yonghua/tag-input'
import { amt } from '@/lib/thai'

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function buildMonthOptions(): string[] {
  const out: string[] = []
  const now = new Date()
  for (let offset = 2; offset >= -12; offset--) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

const SKIP_REASON_LABEL: Record<
  BatchGeneratePreview['willSkip'][number]['reason'],
  string
> = {
  existing: 'มีใบของเดือนนี้แล้ว',
  cancelled: 'สัญญายกเลิก',
  not_due: 'ไม่ตรงรอบ',
  no_dates: 'ไม่มีวันเริ่ม/สิ้นสุด',
  no_rate: 'ไม่มีค่าเช่า',
}

/** มิติกรองในกล่อง review (cascade) — reuse ได้ทั้งแอป */
const FILTER_FIELDS: FilterField<CreateRowData>[] = [
  { key: 'landlord', label: 'ผู้ให้เช่า', get: (r) => r.landlord },
  { key: 'bank', label: 'บัญชีรับเงิน', get: (r) => r.bankName || r.bankLabel },
  { key: 'freq', label: 'รอบบิล', get: (r) => r.freqLabel },
  { key: 'property', label: 'ทรัพย์สิน', get: (r) => r.property },
]
const filterSearchText = (r: CreateRowData) =>
  `${r.contractNo} ${r.tenant} ${r.property} ${r.propertyLocation} ${r.landlord} ${r.bankLabel}`

export function GenerateMonthlyDialog({
  open,
  onOpenChange,
  contractIds,
  onGenerated,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  /** ถ้าระบุ = สร้างเฉพาะสัญญาเหล่านี้ (จากการเลือกในหน้ารายการ) · ซ่อน tag filter */
  contractIds?: string[]
  onGenerated?: () => void
}) {
  const scoped = !!contractIds && contractIds.length > 0
  const [month, setMonth] = useState<string>(currentMonth())
  const [filterTags, setFilterTags] = useState<string[]>([])
  const monthOptions = buildMonthOptions()
  const { data: tagSuggestions } = useContractTags()
  const preview = useBatchGeneratePreview(month)
  const generate = useGenerateMonthlyInvoices()
  const [stage, setStage] = useState<'preview' | 'review' | 'done'>('preview')
  const [result, setResult] = useState<{
    created: number
    skipped: number
    errors: number
  } | null>(null)
  // ใบที่ "ติ๊กออก" (default = เลือกหมด · เก็บเฉพาะที่ไม่เลือก)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const toggleExcluded = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // Reset stage on open/month change
  useEffect(() => {
    if (!open) {
      setStage('preview')
      setResult(null)
      preview.reset()
      generate.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    setStage('preview')
    setResult(null)
    setExcluded(new Set())
    preview.reset()
    generate.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, filterTags])

  async function handleReview() {
    try {
      await preview.mutateAsync({
        tags: scoped ? [] : filterTags,
        contractIds: scoped ? contractIds : undefined,
      })
      setStage('review')
    } catch (err) {
      toast.error('ตรวจสอบไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  async function handleConfirm(selectedIds: string[]) {
    try {
      // สร้างเฉพาะใบที่ผ่านตัวกรอง + ติ๊กเลือกไว้ (ส่ง id ชัดเจน)
      const res = await generate.mutateAsync({
        month,
        tags: [],
        contractIds: selectedIds,
      })
      setResult({
        created: res.created,
        skipped: res.skipped,
        errors: res.errors.length,
      })
      setStage('done')
      onGenerated?.()
      if (res.errors.length === 0) {
        toast.success(`สร้างใบแจ้งหนี้แล้ว ${res.created} ใบ`, {
          description: res.skipped > 0 ? `ข้าม ${res.skipped} ที่ไม่ตรงเงื่อนไข` : undefined,
        })
      } else {
        toast.warning(`สร้างแล้ว ${res.created} ใบ · ผิดพลาด ${res.errors.length} ใบ`)
      }
    } catch (err) {
      toast.error('สร้างไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const prev = preview.data

  // จัดกลุ่มใบที่จะสร้าง ตามผลการเทียบใบรอบก่อน
  const createRows = prev?.willCreate ?? []
  // ตัวกรอง cascade (ผู้ให้เช่า/บัญชี/รอบ/ทรัพย์ + ค้นหา) — ทำงานบนชุดที่กรองแล้ว
  const filter = useCascadingFilter(createRows, FILTER_FIELDS, filterSearchText)
  const visibleRows = filter.filtered
  const isSel = (id: string) => !excluded.has(id)
  const selectedRows = visibleRows.filter((r) => isSel(r.contractId))
  const selectedCount = selectedRows.length
  const sumAmount = selectedRows.reduce((s, x) => s + x.amount, 0)
  const allSelected =
    visibleRows.length > 0 && selectedCount === visibleRows.length
  const setAll = (on: boolean) =>
    setExcluded((prevEx) => {
      const next = new Set(prevEx)
      for (const r of visibleRows) {
        if (on) next.delete(r.contractId)
        else next.add(r.contractId)
      }
      return next
    })

  // สรุปยอดตามบัญชีรับเงิน (เฉพาะใบที่เลือก) — เงินเข้าบัญชีไหนกี่ใบ กี่บาท
  const byAccount = (() => {
    const m = new Map<string, { count: number; total: number; name: string }>()
    for (const r of selectedRows) {
      const noAcct = !r.bankLabel || r.bankLabel === '—'
      const key = noAcct ? '— ไม่ระบุบัญชี' : r.bankLabel
      const cur = m.get(key) ?? { count: 0, total: 0, name: noAcct ? '' : r.bankName }
      cur.count += 1
      cur.total += r.amount
      m.set(key, cur)
    }
    return Array.from(m.entries())
      .map(([label, v]) => ({ label, ...v }))
      .sort((a, b) => b.total - a.total)
  })()
  const needReview = visibleRows.filter(
    (r) =>
      r.compareStatus === 'diff' ||
      r.hasFreqConflict ||
      r.maybeMissingUtility ||
      r.rateAmbiguous,
  )
  const newRows = visibleRows.filter(
    (r) =>
      r.compareStatus === 'new' &&
      !r.hasFreqConflict &&
      !r.maybeMissingUtility &&
      !r.rateAmbiguous,
  )
  const matchedRows = visibleRows.filter(
    (r) =>
      r.compareStatus === 'match' &&
      !r.hasFreqConflict &&
      !r.maybeMissingUtility &&
      !r.rateAmbiguous,
  )

  // แยกกล่อง "ข้าม" — ข้อมูลมีปัญหา (ต้องแก้) vs ข้ามปกติ
  const skipRows = prev?.willSkip ?? []
  const dataProblems = skipRows.filter(
    (s) => s.reason === 'no_rate' || s.reason === 'no_dates',
  )
  const normalSkips = skipRows.filter(
    (s) => s.reason !== 'no_rate' && s.reason !== 'no_dates',
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='w-[min(98vw,80rem)] max-w-[min(98vw,80rem)] sm:max-w-[min(98vw,80rem)] max-h-[calc(100dvh-2rem)] grid-rows-[auto_1fr_auto] overflow-hidden'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Sparkles className='size-5 text-amber-500' />
            สร้างใบแจ้งหนี้รายเดือน (ทั้งระบบ)
          </DialogTitle>
          <DialogDescription>
            เลือกเดือน · ระบบจะสร้างใบแจ้งให้ทุกสัญญาที่ถึงรอบและยังไม่ออก
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 overflow-y-auto min-h-0'>
          <div className='flex items-end gap-3'>
            <div className='flex-1 space-y-2'>
              <Label htmlFor='gen-month'>เดือน</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger id='gen-month'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                    <SelectItem key={m} value={m}>
                      {formatMonth(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {stage === 'preview' && (
              <Button onClick={handleReview} disabled={preview.isPending}>
                {preview.isPending && <Loader2 className='size-4 animate-spin' />}
                ตรวจสอบ
              </Button>
            )}
          </div>

          {scoped ? (
            <div className='rounded-md border bg-sky-500/10 px-3 py-2 text-sm text-sky-700 dark:text-sky-300'>
              สร้างเฉพาะ {contractIds!.length} สัญญาที่เลือกไว้
            </div>
          ) : (
            <div className='space-y-2'>
              <Label>เฉพาะกลุ่ม (tag)</Label>
              <TagInput
                value={filterTags}
                onChange={setFilterTags}
                suggestions={tagSuggestions ?? []}
                placeholder='ทั้งระบบ — เลือก tag เพื่อสร้างเฉพาะกลุ่ม'
              />
              <p className='text-xs text-muted-foreground'>
                {filterTags.length === 0
                  ? 'ไม่เลือก = สร้างให้ทุกสัญญาที่ถึงรอบ'
                  : `สร้างเฉพาะสัญญาที่มี tag: ${filterTags.join(', ')}`}
              </p>
            </div>
          )}

          {stage === 'review' && prev && (
            <div className='space-y-3'>
              {/* สรุป 3 กลุ่ม — ระบบเช็คให้แล้ว เหลือดูเฉพาะที่ผิดปกติ */}
              <div className='grid grid-cols-3 gap-2 text-center'>
                <div className='rounded-md border border-amber-500/40 bg-amber-500/10 p-3'>
                  <div className='text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-300'>
                    {needReview.length.toLocaleString('th-TH')}
                  </div>
                  <div className='text-xs text-amber-700 dark:text-amber-300'>
                    ⚠️ ต้องตรวจ
                  </div>
                </div>
                <div className='rounded-md border border-sky-500/40 bg-sky-500/10 p-3'>
                  <div className='text-2xl font-bold tabular-nums text-sky-700 dark:text-sky-300'>
                    {newRows.length.toLocaleString('th-TH')}
                  </div>
                  <div className='text-xs text-sky-700 dark:text-sky-300'>🆕 ใหม่</div>
                </div>
                <div className='rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3'>
                  <div className='text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300'>
                    {matchedRows.length.toLocaleString('th-TH')}
                  </div>
                  <div className='text-xs text-emerald-700 dark:text-emerald-300'>
                    ✅ ตรงรอบก่อน
                  </div>
                </div>
              </div>

              {createRows.length === 0 ? (
                <div className='rounded-md border bg-muted/20 p-4 text-center text-sm text-muted-foreground'>
                  ไม่มีสัญญาที่ต้องออกใบใหม่ — เดือนนี้สร้างครบแล้ว
                </div>
              ) : (
                <>
                  {/* ตัวกรอง cascade — ผู้ให้เช่า/บัญชี/รอบ/ทรัพย์ + ค้นหา */}
                  <FilterBar
                    filter={filter}
                    searchPlaceholder='ค้น เลขที่ · ผู้เช่า · อาคาร...'
                  />

                  {/* กระทบยอดทั้งรอบ vs เดือนก่อน */}
                  <div className='rounded-md border bg-muted/30 px-4 py-2.5'>
                    <div className='flex items-center justify-between text-sm font-semibold'>
                      <span>
                        เลือกสร้าง {selectedCount.toLocaleString('th-TH')} /{' '}
                        {visibleRows.length.toLocaleString('th-TH')} ใบ
                        {filter.activeCount > 0
                          ? ` (กรองจาก ${createRows.length.toLocaleString('th-TH')})`
                          : ''}
                      </span>
                      <span className='tabular-nums'>{amt(sumAmount)}</span>
                    </div>
                    <div className='mt-1 flex items-center justify-between text-xs text-muted-foreground'>
                      <span>
                        เดือนก่อน ({formatMonth(prev.prevRun.month)}) ออก{' '}
                        {prev.prevRun.count.toLocaleString('th-TH')} ใบ
                      </span>
                      <span className='tabular-nums'>{amt(prev.prevRun.total)}</span>
                    </div>
                  </div>

                  {/* สรุปยอดตามบัญชีรับเงิน — เงินเข้าบัญชีไหนกี่ใบ กี่บาท (ตามที่เลือก) */}
                  {byAccount.length > 0 && (
                    <details open className='overflow-hidden rounded-md border bg-card'>
                      <summary className='cursor-pointer bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                        สรุปตามบัญชีรับเงิน ({byAccount.length} บัญชี) — เงินเข้าแต่ละบัญชีรอบนี้
                      </summary>
                      <div className='max-h-56 overflow-y-auto border-t'>
                        {byAccount.map((a) => {
                          const noAcct = a.label.startsWith('—')
                          return (
                            <div
                              key={a.label}
                              className='flex items-center justify-between gap-3 border-b px-4 py-1.5 text-sm last:border-b-0'
                            >
                              <div className='min-w-0'>
                                <span
                                  className={`block truncate font-medium ${noAcct ? 'text-red-600 dark:text-red-400' : ''}`}
                                  title={a.name || a.label}
                                >
                                  {a.name || a.label}
                                </span>
                                {a.name && (
                                  <span
                                    className='block truncate text-xs text-muted-foreground'
                                    title={a.label}
                                  >
                                    {a.label}
                                  </span>
                                )}
                              </div>
                              <span className='shrink-0 text-muted-foreground'>
                                {a.count.toLocaleString('th-TH')} ใบ ·{' '}
                                <span className='font-semibold tabular-nums text-foreground'>
                                  {amt(a.total, { decimal: 0 })}
                                </span>
                              </span>
                            </div>
                          )
                        })}
                      </div>
                      {/* แถวรวม — กระทบยอดกับ run รวม */}
                      <div className='flex items-center justify-between gap-3 border-t bg-muted/40 px-4 py-2 text-sm font-semibold'>
                        <span>รวมทุกบัญชี</span>
                        <span>
                          {selectedCount.toLocaleString('th-TH')} ใบ ·{' '}
                          <span className='tabular-nums'>{amt(sumAmount, { decimal: 0 })}</span>
                        </span>
                      </div>
                    </details>
                  )}

                  {/* สัญญาที่เดือนก่อนออก แต่เดือนนี้หายไป */}
                  {prev.missing.length > 0 && (
                    <details className='overflow-hidden rounded-md border border-amber-400/60 bg-amber-500/5'>
                      <summary className='cursor-pointer bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300'>
                        ⚠️ เดือนก่อนออก แต่เดือนนี้ยังไม่มีใบ ({prev.missing.length}) —
                        เช็คว่าหมดสัญญา/ยกเลิก หรือตกหล่น
                      </summary>
                      <div className='max-h-44 overflow-y-auto border-t'>
                        {prev.missing.slice(0, 100).map((m) => (
                          <div
                            key={m.contractId}
                            className='flex items-center justify-between gap-3 border-b px-4 py-1.5 text-xs last:border-b-0'
                          >
                            <span className='truncate font-medium'>{m.contractNo}</span>
                            <span className='shrink-0 text-muted-foreground tabular-nums'>
                              เดือนก่อน {amt(m.lastAmount, { decimal: 0 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {/* ตัวกรองซ่อนหมด */}
                  {visibleRows.length === 0 && (
                    <div className='rounded-md border bg-muted/20 p-4 text-center text-sm text-muted-foreground'>
                      ไม่พบใบที่ตรงกับตัวกรอง — ลองล้างตัวกรอง
                    </div>
                  )}

                  {/* ⚠️ ต้องตรวจ — ยอดต่างจากรอบก่อน หรือรอบชำระไม่ตรง */}
                  {needReview.length > 0 && (
                    <div className='overflow-hidden rounded-md border border-amber-400/60 bg-card'>
                      <div className='border-b border-amber-400/40 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300'>
                        ⚠️ ต้องตรวจก่อนสร้าง ({needReview.length})
                      </div>
                      <CreateRowHeader allSelected={allSelected} onToggleAll={setAll} />
                      <div>
                        {needReview.slice(0, 200).map((row) => (
                          <CreateRow
                            key={row.contractId}
                            row={row}
                            selected={isSel(row.contractId)}
                            onToggle={toggleExcluded}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 🆕 ใหม่ ไม่มีประวัติ */}
                  {newRows.length > 0 && (
                    <div className='overflow-hidden rounded-md border border-sky-400/50 bg-card'>
                      <div className='border-b border-sky-400/30 bg-sky-500/10 px-4 py-2 text-xs font-semibold text-sky-700 dark:text-sky-300'>
                        🆕 ใหม่ ไม่มีใบรอบก่อน ({newRows.length}) — ดูยอดสักนิด
                      </div>
                      <CreateRowHeader allSelected={allSelected} onToggleAll={setAll} />
                      <div>
                        {newRows.slice(0, 200).map((row) => (
                          <CreateRow
                            key={row.contractId}
                            row={row}
                            selected={isSel(row.contractId)}
                            onToggle={toggleExcluded}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ✅ ตรงรอบก่อน — ยุบไว้ เชื่อได้ */}
                  {matchedRows.length > 0 && (
                    <details className='overflow-hidden rounded-md border bg-card'>
                      <summary className='cursor-pointer bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300'>
                        ✅ ตรงกับใบรอบก่อน ({matchedRows.length}) — เชื่อได้ · กดดูรายละเอียด
                      </summary>
                      <CreateRowHeader allSelected={allSelected} onToggleAll={setAll} />
                      <div className='max-h-[28rem] overflow-y-auto border-t'>
                        {matchedRows.slice(0, 200).map((row) => (
                          <CreateRow
                            key={row.contractId}
                            row={row}
                            selected={isSel(row.contractId)}
                            onToggle={toggleExcluded}
                          />
                        ))}
                      </div>
                    </details>
                  )}
                </>
              )}

              {/* ❗ ข้อมูลมีปัญหา — ต้องไปแก้สัญญาก่อน (ชูให้เห็น) */}
              {dataProblems.length > 0 && (
                <div className='overflow-hidden rounded-md border border-red-400/60 bg-red-500/5'>
                  <div className='border-b border-red-400/40 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-700 dark:text-red-300'>
                    ❗ ข้อมูลมีปัญหา ({dataProblems.length}) — แก้สัญญาก่อน ถึงจะออกใบได้
                  </div>
                  <div className='max-h-40 overflow-y-auto'>
                    {dataProblems.slice(0, 80).map((row) => (
                      <div
                        key={row.contractId + row.reason}
                        className='flex items-center justify-between gap-3 border-b px-4 py-1.5 text-xs last:border-b-0'
                      >
                        <span className='truncate font-medium'>{row.contractNo}</span>
                        <span className='shrink-0 text-red-600 dark:text-red-400'>
                          {SKIP_REASON_LABEL[row.reason]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ข้ามปกติ — ออกไปแล้ว / ยกเลิก / ไม่ตรงรอบ (ยุบไว้) */}
              {normalSkips.length > 0 && (
                <details className='overflow-hidden rounded-md border bg-muted/20'>
                  <summary className='cursor-pointer px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                    ข้ามปกติ ({normalSkips.length}) — ออกไปแล้ว / ยกเลิก / ไม่ตรงรอบ
                  </summary>
                  <div className='max-h-40 overflow-y-auto border-t'>
                    {normalSkips.slice(0, 80).map((row) => (
                      <div
                        key={row.contractId + row.reason}
                        className='flex items-center justify-between gap-3 px-4 py-1.5 text-xs'
                      >
                        <span className='truncate'>{row.contractNo}</span>
                        <span className='shrink-0 text-muted-foreground'>
                          {SKIP_REASON_LABEL[row.reason]}
                          {row.existingNo ? ` (${row.existingNo})` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {stage === 'done' && result && (
            <div className='rounded-md border bg-emerald-500/10 p-4'>
              <p className='text-sm font-medium text-emerald-800 dark:text-emerald-200'>
                สร้างใบแจ้งหนี้สำเร็จ {result.created} ใบ
              </p>
              <p className='mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80'>
                ข้าม {result.skipped} ใบ
                {result.errors > 0 ? ` · ผิดพลาด ${result.errors} ใบ` : ''}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {stage === 'review' && (
            <Button
              variant='ghost'
              onClick={() => setStage('preview')}
              disabled={generate.isPending}
            >
              ย้อนกลับ
            </Button>
          )}
          <DialogClose asChild>
            <Button variant='outline' disabled={generate.isPending}>
              {stage === 'done' ? 'ปิด' : 'ยกเลิก'}
            </Button>
          </DialogClose>
          {stage === 'review' && prev && prev.willCreate.length > 0 && (
            <Button
              onClick={() =>
                handleConfirm(selectedRows.map((r) => r.contractId))
              }
              disabled={generate.isPending || selectedCount === 0}
            >
              {generate.isPending && <Loader2 className='size-4 animate-spin' />}
              สร้าง {selectedCount.toLocaleString('th-TH')} ใบ
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type CreateRowData = BatchGeneratePreview['willCreate'][number]

/** chip รอบบิล — รายเดือนเงียบ · ไม่ใช่รายเดือนสีเด่น (ให้สะดุดตาในมุม ops) */
const FREQ_CHIP: Record<string, { label: string; cls: string }> = {
  monthly: { label: 'รายเดือน', cls: 'bg-muted text-muted-foreground' },
  quarterly: {
    label: 'ไตรมาส',
    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
  semi: {
    label: 'ครึ่งปี',
    cls: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  },
  yearly: {
    label: 'รายปี',
    cls: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  },
  lump: {
    label: 'ครั้งเดียว',
    cls: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  },
}

function FreqChip({ type, months }: { type: string; months: number }) {
  const c = FREQ_CHIP[type] ?? FREQ_CHIP.monthly
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ${c.cls}`}
    >
      {c.label}
      {months > 1 ? ` ·${months}ด.` : ''}
    </span>
  )
}

/** column template ใช้ร่วมกัน header + row · โซนขวา (รอบ·สถานะ·ยอด) = จุดตัดสินใจ */
const ROW_GRID =
  'grid grid-cols-[1.5rem_6.5rem_minmax(0,1.4fr)_minmax(0,1.2fr)_6.5rem_minmax(7rem,10rem)_6.5rem] items-center gap-x-3'

/** หัวตารางในแต่ละกลุ่ม */
function CreateRowHeader({
  allSelected,
  onToggleAll,
}: {
  allSelected: boolean
  onToggleAll: (on: boolean) => void
}) {
  return (
    <div
      className={`${ROW_GRID} border-b bg-muted/20 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground`}
    >
      <Checkbox
        checked={allSelected}
        onCheckedChange={(v) => onToggleAll(!!v)}
        aria-label='เลือกทั้งหมด'
      />
      <span>เลขที่</span>
      <span>ผู้เช่า / ทรัพย์สิน</span>
      <span>ผู้ให้เช่า / บัญชี</span>
      <span>รอบ</span>
      <span>สถานะ</span>
      <span className='text-right'>ยอด</span>
    </div>
  )
}

/** แถวใบที่จะสร้าง — ตารางแนวนอน · กางกล่อง breakdown ใต้แถวเมื่อมี VAT/ค่าน้ำไฟ */
function CreateRow({
  row,
  selected,
  onToggle,
}: {
  row: CreateRowData
  selected: boolean
  onToggle: (id: string) => void
}) {
  const flagged =
    row.hasFreqConflict ||
    row.compareStatus === 'diff' ||
    row.maybeMissingUtility ||
    row.rateAmbiguous
  const hasBreakdown = row.vatAmount > 0 || row.utilityLines.length > 0
  const rateNote =
    [
      row.rateNote,
      row.rentMonths > 1 ? `× ${row.rentMonths} ด.` : '',
      row.freqLabel,
    ]
      .filter(Boolean)
      .join(' · ') || '—'
  return (
    <div
      className={`border-b px-4 py-2 text-sm last:border-b-0 ${flagged ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''} ${selected ? '' : 'opacity-45'}`}
    >
      <div className={`${ROW_GRID} items-start`}>
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggle(row.contractId)}
          aria-label={`เลือก ${row.contractNo}`}
          className='mt-0.5'
        />
        <span className='truncate font-medium' title={row.contractNo}>
          {row.contractNo}
        </span>
        <div className='min-w-0'>
          <span className='block truncate' title={row.tenant}>
            {row.tenant}
          </span>
          <span
            className='block truncate text-xs text-muted-foreground'
            title={
              row.propertyLocation
                ? `${row.property} · ${row.propertyLocation}`
                : row.property
            }
          >
            {row.property}
            {row.propertyLocation && ` · ${row.propertyLocation}`}
          </span>
        </div>
        <div className='min-w-0'>
          <span className='block truncate' title={row.landlord}>
            {row.landlord}
          </span>
          <span
            className='block truncate text-xs text-muted-foreground'
            title={row.bankLabel}
          >
            {row.bankLabel}
          </span>
        </div>
        <FreqChip type={row.freqType} months={row.rentMonths} />
        <CompareNote row={row} />
        <div className='text-right'>
          <span className='block font-semibold tabular-nums'>
            {amt(row.amount, { decimal: 0 })}
          </span>
          {row.utilityLines.length > 0 && (
            <span className='block text-xs text-sky-600 dark:text-sky-400'>
              + น้ำ/ไฟ {row.utilityLines.length}
            </span>
          )}
        </div>
      </div>
      {hasBreakdown && (
        <div className='mt-1.5 space-y-0.5 rounded-sm bg-muted/40 px-3 py-1.5 text-xs'>
          <div className='flex justify-between gap-2'>
            <span className='text-muted-foreground'>ค่าเช่า · {rateNote}</span>
            <span className='tabular-nums'>
              {amt(row.rentBase, { symbol: false, decimal: 0 })}
            </span>
          </div>
          {row.vatAmount > 0 && (
            <div className='flex justify-between gap-2'>
              <span className='text-muted-foreground'>VAT {row.vatRate}%</span>
              <span className='tabular-nums'>
                {amt(row.vatAmount, { symbol: false, decimal: 0 })}
              </span>
            </div>
          )}
          {row.utilityLines.map((u, i) => (
            <div key={i} className='flex justify-between gap-2'>
              <span className='text-muted-foreground'>
                {u.label}
                {u.units
                  ? ` · ${u.units.toLocaleString('th-TH')} หน่วย × ${u.ratePerUnit}${u.fixedFee ? ` + ${u.fixedFee}` : ''}`
                  : ''}
                {u.readingDate ? ` · จด ${u.readingDate}` : ''}
              </span>
              <span className='tabular-nums'>
                {amt(u.amount, { symbol: false, decimal: 0 })}
              </span>
            </div>
          ))}
          <div className='mt-0.5 flex justify-between gap-2 border-t pt-0.5 font-medium'>
            <span>รวมทั้งใบ</span>
            <span className='tabular-nums'>
              {amt(row.amount, { symbol: false, decimal: 0 })}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

/** คอลัมน์เทียบกับใบรอบก่อน — หัวใจของ "ระบบเช็คให้" (กระชับ พอดีคอลัมน์) */
function CompareNote({ row }: { row: CreateRowData }) {
  if (row.rateAmbiguous) {
    return (
      <span className='flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400'>
        <AlertTriangle className='mt-0.5 size-3 shrink-0' />
        ค่าเช่าในสัญญาไม่ตรงกัน — ตรวจ
      </span>
    )
  }
  if (row.hasFreqConflict) {
    return (
      <span className='flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400'>
        <AlertTriangle className='mt-0.5 size-3 shrink-0' />
        รอบชำระอาจไม่ตรง
      </span>
    )
  }
  if (row.maybeMissingUtility) {
    return (
      <span className='flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400'>
        <AlertTriangle className='mt-0.5 size-3 shrink-0' />
        เดือนก่อนมีค่าน้ำ/ไฟ — อาจยังไม่จดมิเตอร์
      </span>
    )
  }
  if (row.compareStatus === 'diff' && row.prevAmount != null) {
    const diff = row.amount - row.prevAmount
    return (
      <span className='flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400'>
        <AlertTriangle className='mt-0.5 size-3 shrink-0' />
        <span>
          ใบก่อน {amt(row.prevAmount, { symbol: false, decimal: 0 })}
          {row.prevMonth ? ` (${formatMonth(row.prevMonth)})` : ''} ·{' '}
          {diff > 0 ? 'มากขึ้น' : 'น้อยลง'} {amt(Math.abs(diff), { symbol: false, decimal: 0 })}
        </span>
      </span>
    )
  }
  if (row.compareStatus === 'match' && row.prevAmount != null) {
    return (
      <span className='flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400'>
        <Check className='size-3 shrink-0' />
        ตรงรอบก่อน
      </span>
    )
  }
  return (
    <span className='flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400'>
      <Sparkles className='size-3 shrink-0' />
      ตามค่าเช่าในสัญญา
    </span>
  )
}
