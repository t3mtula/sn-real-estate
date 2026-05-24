/**
 * SlipBatchUpload — อัปโหลดสลิปหลายใบพร้อมกัน
 *
 * ผู้ใช้ drag-drop หรือ browse เลือกไฟล์รูปได้หลายไฟล์
 * จากนั้นเลือกใบแจ้งหนี้ที่ค้างชำระให้แต่ละสลิป แล้วบันทึก
 */
import { useCallback, useRef, useState } from 'react'
import { CloudUpload, FileImage, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import {
  daysOverdue,
  formatMonth,
  getEffectiveStatus,
  getInvoiceDisplay,
  useInvoices,
} from '@/features/invoices/queries'
import { cn } from '@/lib/utils'

// ---- types ----------------------------------------------------------------

type SlipFile = {
  /** Browser-unique key */
  key: string
  file: File
  previewUrl: string
  /** Invoice id chosen for this slip */
  invoiceId: string
  /** Status of save operation for this slip */
  saveStatus: 'idle' | 'saving' | 'done' | 'error'
}

// ---- helpers ---------------------------------------------------------------

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`
}

// ---- sub-components --------------------------------------------------------

function InvoiceSelector({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: Array<{ id: string; label: string }>
}) {
  return (
    <Select value={value || '__none__'} onValueChange={(v) => onChange(v === '__none__' ? '' : v)}>
      <SelectTrigger className='h-8 text-xs'>
        <SelectValue placeholder='เลือกใบแจ้งหนี้...' />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value='__none__'>— ยังไม่เลือก —</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ---- SlipRow ---------------------------------------------------------------

function SlipRow({
  slip,
  options,
  onChangeInvoice,
  onRemove,
  isDuplicate,
}: {
  slip: SlipFile
  options: Array<{ id: string; label: string }>
  onChangeInvoice: (invoiceId: string) => void
  onRemove: () => void
  isDuplicate?: boolean
}) {
  return (
    <div className='flex items-start gap-3 rounded-lg border bg-card p-3'>
      {/* Thumbnail */}
      <div className='relative shrink-0'>
        <img
          src={slip.previewUrl}
          alt={slip.file.name}
          className='h-20 w-16 rounded-md border object-cover'
          onClick={() => window.open(slip.previewUrl, '_blank')}
          style={{ cursor: 'zoom-in' }}
        />
        {slip.saveStatus === 'done' && (
          <div className='absolute inset-0 flex items-center justify-center rounded-md bg-emerald-500/70'>
            <span className='text-xs font-bold text-white'>บันทึกแล้ว</span>
          </div>
        )}
      </div>

      {/* Info + selector */}
      <div className='min-w-0 flex-1 space-y-1.5'>
        <div className='flex items-center gap-2'>
          <FileImage className='size-3.5 shrink-0 text-muted-foreground' />
          <span className='truncate text-xs text-muted-foreground' title={slip.file.name}>
            {slip.file.name}
          </span>
          <span className='ml-auto shrink-0 text-[10px] text-muted-foreground'>
            {(slip.file.size / 1024).toFixed(0)} KB
          </span>
        </div>

        <InvoiceSelector
          value={slip.invoiceId}
          onChange={onChangeInvoice}
          options={options}
        />

        {isDuplicate && (
          <p className='text-[11px] font-medium text-amber-600'>⚠ ใบแจ้งหนี้นี้ถูกเลือกซ้ำ</p>
        )}
        {slip.saveStatus === 'error' && (
          <p className='text-[11px] text-destructive'>บันทึกไม่สำเร็จ — ลองใหม่</p>
        )}
      </div>

      {/* Remove button (only when not saved) */}
      {slip.saveStatus !== 'done' && (
        <Button
          size='icon'
          variant='ghost'
          className='h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive'
          onClick={onRemove}
          disabled={slip.saveStatus === 'saving'}
          aria-label='ลบ'
        >
          <X className='size-3.5' />
        </Button>
      )}
    </div>
  )
}

// ---- DropZone ---------------------------------------------------------------

function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [over, setOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const accept = 'image/jpeg,image/png,image/webp'

  function processFiles(fileList: FileList | null) {
    if (!fileList) return
    const valid: File[] = []
    let skipped = 0
    for (const f of Array.from(fileList)) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
        skipped++
        continue
      }
      if (f.size > 5_000_000) {
        toast.warning(`${f.name} ใหญ่เกิน 5 MB — ข้าม`)
        skipped++
        continue
      }
      valid.push(f)
    }
    if (skipped > 0 && valid.length === 0) {
      toast.error('ไฟล์ที่รองรับ: JPEG, PNG, WebP (สูงสุด 5 MB)')
    }
    if (valid.length > 0) onFiles(valid)
  }

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setOver(false)
      processFiles(e.dataTransfer.files)
    },
    // processFiles is defined inline and stable within DropZone scope
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onFiles],
  )

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors',
        over
          ? 'border-primary bg-primary/5'
          : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-primary/5',
      )}
    >
      <CloudUpload className={cn('size-10', over ? 'text-primary' : 'text-muted-foreground')} />
      <div className='text-center'>
        <p className='text-sm font-medium'>
          {over ? 'ปล่อยไฟล์ที่นี่' : 'ลากรูปสลิปมาวาง หรือคลิกเพื่อเลือก'}
        </p>
        <p className='mt-1 text-xs text-muted-foreground'>JPEG · PNG · WebP · สูงสุด 5 MB ต่อไฟล์</p>
      </div>
      <input
        ref={inputRef}
        type='file'
        accept={accept}
        multiple
        className='hidden'
        onChange={(e) => processFiles(e.target.files)}
        // Reset input so re-selecting same files triggers onChange
        onClick={(e) => { (e.target as HTMLInputElement).value = '' }}
      />
    </div>
  )
}

// ---- save hook (imperative — direct Supabase write per slip) ---------------

function useSaveAll(
  slips: SlipFile[],
  setSlips: React.Dispatch<React.SetStateAction<SlipFile[]>>,
) {
  const qc = useQueryClient()
  const [isSaving, setIsSaving] = useState(false)

  async function run() {
    const targets = slips.filter((s) => s.invoiceId && s.saveStatus === 'idle')
    if (targets.length === 0) return

    // Dedup check: warn if same invoice assigned to multiple slips
    const invoiceIds = targets.map((s) => s.invoiceId)
    const dupIds = invoiceIds.filter((id, i) => invoiceIds.indexOf(id) !== i)
    if (dupIds.length > 0) {
      toast.warning('มีใบแจ้งหนี้ถูกเลือกซ้ำในหลาย slip · กรุณาตรวจสอบก่อนบันทึก')
      return
    }

    setIsSaving(true)

    // Mark all targets as saving
    setSlips((prev) =>
      prev.map((s) =>
        targets.some((t) => t.key === s.key) ? { ...s, saveStatus: 'saving' as const } : s,
      ),
    )

    let doneCount = 0
    let errCount = 0

    for (const slip of targets) {
      try {
        const dataUrl = await fileToDataUrl(slip.file)

        const { data: existing, error: readErr } = await supabase
          .from('invoices')
          .select('data')
          .eq('id', slip.invoiceId)
          .single()
        if (readErr) throw readErr

        const merged = { ...(existing?.data ?? {}), slipImage: dataUrl }

        const { error: writeErr } = await supabase
          .from('invoices')
          .update({ data: merged, updated_at: new Date().toISOString() })
          .eq('id', slip.invoiceId)
        if (writeErr) throw writeErr

        qc.invalidateQueries({ queryKey: ['invoices', slip.invoiceId] })
        qc.invalidateQueries({ queryKey: ['invoices'] })

        setSlips((prev) =>
          prev.map((s) => (s.key === slip.key ? { ...s, saveStatus: 'done' as const } : s)),
        )
        doneCount++
      } catch (_err) {
        setSlips((prev) =>
          prev.map((s) => (s.key === slip.key ? { ...s, saveStatus: 'error' as const } : s)),
        )
        errCount++
      }
    }

    setIsSaving(false)
    if (errCount === 0) {
      toast.success(`บันทึก slip สำเร็จ ${doneCount} ใบ`)
    } else {
      toast.warning(`สำเร็จ ${doneCount} · ล้มเหลว ${errCount} ใบ`)
    }
  }

  return { run, isSaving }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'))
    reader.readAsDataURL(file)
  })
}

// ---- main component --------------------------------------------------------

export function SlipBatchUpload() {
  const { data: allInvoices } = useInvoices()
  const [slips, setSlips] = useState<SlipFile[]>([])

  // Build list of outstanding invoices for selectors
  const outstandingOptions = (() => {
    if (!allInvoices) return []
    return allInvoices
      .filter((inv) => {
        const s = getEffectiveStatus(inv)
        return s === 'sent' || s === 'partial' || s === 'draft'
      })
      .map((inv) => {
        const overdue = daysOverdue(inv)
        const tenant = inv.data?.tenant?.trim() || '—'
        const month = formatMonth(inv.data?.month)
        const no = getInvoiceDisplay(inv)
        const label = `${no} · ${tenant} · ${month}${overdue > 0 ? ` (เกิน ${overdue} วัน)` : ''}`
        return { id: inv.id, label }
      })
  })()

  function addFiles(files: File[]) {
    const next: SlipFile[] = []
    for (const f of files) {
      const key = fileKey(f)
      if (slips.some((s) => s.key === key)) continue // dedupe
      next.push({
        key,
        file: f,
        previewUrl: URL.createObjectURL(f),
        invoiceId: '',
        saveStatus: 'idle',
      })
    }
    setSlips((prev) => [...prev, ...next])
  }

  function removeSlip(key: string) {
    setSlips((prev) => {
      const target = prev.find((s) => s.key === key)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((s) => s.key !== key)
    })
  }

  function setInvoiceId(key: string, invoiceId: string) {
    setSlips((prev) => prev.map((s) => (s.key === key ? { ...s, invoiceId } : s)))
  }

  const saveAll = useSaveAll(slips, setSlips)

  const readyCount = slips.filter((s) => s.invoiceId && s.saveStatus === 'idle').length
  const doneCount = slips.filter((s) => s.saveStatus === 'done').length
  const hasAny = slips.length > 0

  // Compute duplicate invoice assignments for visual warning
  const assignedIds = slips.map((s) => s.invoiceId).filter(Boolean)
  const duplicateInvoiceIds = new Set(
    assignedIds.filter((id, i) => assignedIds.indexOf(id) !== i),
  )

  return (
    <div className='space-y-6'>
      <div>
        <h3 className='text-lg font-semibold'>อัปโหลดสลิปหลายใบพร้อมกัน</h3>
        <p className='mt-1 text-sm text-muted-foreground'>
          เลือกรูปสลิปและจับคู่กับใบแจ้งหนี้ที่ค้างชำระ · ระบบจะบันทึก slip ลงในใบแจ้งหนี้ที่เลือก
        </p>
      </div>

      <DropZone onFiles={addFiles} />

      {hasAny && (
        <div className='space-y-3'>
          {slips.map((slip) => (
            <SlipRow
              key={slip.key}
              slip={slip}
              options={outstandingOptions}
              onChangeInvoice={(v) => setInvoiceId(slip.key, v)}
              onRemove={() => removeSlip(slip.key)}
              isDuplicate={slip.invoiceId ? duplicateInvoiceIds.has(slip.invoiceId) : false}
            />
          ))}
        </div>
      )}

      {hasAny && (
        <Card>
          <CardContent className='flex flex-wrap items-center justify-between gap-3 pt-4'>
            <div className='flex flex-wrap gap-2 text-sm'>
              <Badge variant='outline'>{slips.length} ไฟล์</Badge>
              {readyCount > 0 && (
                <Badge variant='secondary'>{readyCount} พร้อมบันทึก</Badge>
              )}
              {doneCount > 0 && (
                <Badge className='bg-emerald-500/10 text-emerald-700 border-emerald-500/30'>
                  บันทึกแล้ว {doneCount}
                </Badge>
              )}
            </div>
            <div className='flex gap-2'>
              <Button
                variant='outline'
                onClick={() => {
                  slips.forEach((s) => URL.revokeObjectURL(s.previewUrl))
                  setSlips([])
                }}
                disabled={saveAll.isSaving}
              >
                ล้างทั้งหมด
              </Button>
              <Button
                onClick={saveAll.run}
                disabled={readyCount === 0 || saveAll.isSaving}
              >
                {saveAll.isSaving && <Loader2 className='size-4 animate-spin' />}
                ยืนยันและบันทึก {readyCount > 0 ? `(${readyCount})` : ''}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
