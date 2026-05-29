import { AlertTriangle, Loader2, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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

const FREQ_SHORT: Record<string, string> = {
  monthly: 'รายเดือน',
  quarterly: 'รายไตรมาส',
  semi: 'ครึ่งปีละ',
  yearly: 'รายปี',
  lump: 'ครั้งเดียว',
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

export function GenerateMonthlyDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
}) {
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
    preview.reset()
    generate.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, filterTags])

  async function handleReview() {
    try {
      await preview.mutateAsync({ tags: filterTags })
      setStage('review')
    } catch (err) {
      toast.error('ตรวจสอบไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  async function handleConfirm() {
    try {
      const res = await generate.mutateAsync({ month, tags: filterTags })
      setResult({
        created: res.created,
        skipped: res.skipped,
        errors: res.errors.length,
      })
      setStage('done')
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
  const total = (prev?.willCreate.length ?? 0) + (prev?.willSkip.length ?? 0)
  const sumAmount = (prev?.willCreate ?? []).reduce((s, x) => s + x.amount, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='w-[min(95vw,42rem)] max-h-[calc(100dvh-4rem)] grid-rows-[auto_1fr_auto] overflow-hidden'>
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

          {stage === 'review' && prev && (
            <div className='space-y-3'>
              <div className='grid grid-cols-3 gap-2 text-center text-sm'>
                <div className='rounded-md border bg-emerald-500/10 p-3'>
                  <div className='text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300'>
                    {prev.willCreate.length.toLocaleString('th-TH')}
                  </div>
                  <div className='text-xs text-emerald-700 dark:text-emerald-300'>
                    จะสร้างใหม่
                  </div>
                </div>
                <div className='rounded-md border bg-muted/40 p-3'>
                  <div className='text-2xl font-bold tabular-nums text-muted-foreground'>
                    {prev.willSkip.length.toLocaleString('th-TH')}
                  </div>
                  <div className='text-xs text-muted-foreground'>ข้าม</div>
                </div>
                <div className='rounded-md border bg-sky-500/10 p-3'>
                  <div className='text-2xl font-bold tabular-nums text-sky-700 dark:text-sky-300'>
                    {total.toLocaleString('th-TH')}
                  </div>
                  <div className='text-xs text-sky-700 dark:text-sky-300'>
                    สัญญาทั้งหมด
                  </div>
                </div>
              </div>
              {prev.willCreate.length > 0 ? (
                <div className='rounded-md border bg-card overflow-hidden'>
                  <div className='flex items-center justify-between border-b bg-muted/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                    <span>{prev.willCreate.length} ใบที่จะสร้าง</span>
                    <span className='tabular-nums'>{amt(sumAmount)}</span>
                  </div>
                  <div className='max-h-56 overflow-y-auto'>
                    {prev.willCreate.slice(0, 50).map((row) => (
                      <div
                        key={row.contractId}
                        className={`flex items-center justify-between gap-3 border-b px-4 py-2 text-sm last:border-b-0 ${row.hasFreqConflict ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}`}
                      >
                        <div className='min-w-0'>
                          <p className='truncate font-medium flex items-center gap-1'>
                            {row.hasFreqConflict && (
                              <AlertTriangle className='size-3 shrink-0 text-amber-500' />
                            )}
                            {row.contractNo}
                          </p>
                          <p className='truncate text-xs text-muted-foreground'>
                            {row.tenant} · {row.property}
                          </p>
                          {(row.rateNote || row.freqType) && (
                            <p className={`truncate text-xs ${row.hasFreqConflict ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground/60'}`}>
                              {[row.rateNote, FREQ_SHORT[row.freqType]].filter(Boolean).join(' · ')}
                              {row.hasFreqConflict && ' ⚠️ ตรวจสอบรอบชำระ'}
                            </p>
                          )}
                        </div>
                        <span className='shrink-0 text-sm tabular-nums'>
                          {amt(row.amount, { decimal: 0 })}
                        </span>
                      </div>
                    ))}
                    {prev.willCreate.length > 50 && (
                      <div className='px-4 py-2 text-xs text-muted-foreground'>
                        ... และอีก {prev.willCreate.length - 50} ใบ
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className='rounded-md border bg-muted/20 p-4 text-center text-sm text-muted-foreground'>
                  ไม่มีสัญญาที่ต้องออกใบใหม่ — เดือนนี้สร้างครบแล้ว
                </div>
              )}
              {prev.willSkip.length > 0 && (
                <details className='rounded-md border bg-muted/20 overflow-hidden'>
                  <summary className='cursor-pointer px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                    ดูที่ข้าม ({prev.willSkip.length})
                  </summary>
                  <div className='max-h-40 overflow-y-auto border-t'>
                    {prev.willSkip.slice(0, 80).map((row) => (
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
            <Button onClick={handleConfirm} disabled={generate.isPending}>
              {generate.isPending && <Loader2 className='size-4 animate-spin' />}
              สร้าง {prev.willCreate.length} ใบ
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
