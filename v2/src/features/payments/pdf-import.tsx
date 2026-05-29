/**
 * PDF Bank Statement Import Dialog
 * อัปโหลด PDF statement จาก SCB / KBank → preview → บันทึกเป็น payments
 */
import * as pdfjsLib from 'pdfjs-dist'
import * as XLSX from 'xlsx'
import { useState, useRef, useMemo } from 'react'
import { FileUp, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useBankAccounts } from '@/features/bank-accounts/queries'
import { useContracts } from '@/features/contracts/queries'
import { candidatesForAccount, matchTransaction, type MatchResult } from './matching'
import { amt } from '@/lib/thai'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  parseStatementText,
  parseStatementRows,
  acctNoMatches,
  type ParsedStatement,
  type ParsedTransaction,
  type StatementInfo,
} from './bank-pdf-parser'
import { useBatchSavePayments, type BatchPaymentRow } from './mutations'

// ── pdfjs worker ─────────────────────────────────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).href

// ── types ─────────────────────────────────────────────────────────────────────
interface ImportRow extends ParsedTransaction {
  _id: string
  selected: boolean
  matchedBankAccountId: string | undefined
}

type Step = 'upload' | 'parsing' | 'preview' | 'saving' | 'done'

// ── helpers ───────────────────────────────────────────────────────────────────
async function extractPdfText(file: File, password?: string): Promise<string> {
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({
    data: buf,
    password: password || undefined,
  }).promise

  // เรียงข้อความตามตำแหน่งบรรทัดจริง (พิกัด Y) แล้วเรียงซ้าย→ขวา (พิกัด X)
  // → 1 รายการ = 1 บรรทัด · ถ้า join ทั้งหน้าเป็นบรรทัดเดียวจะจับได้แค่รายการแรก
  //
  // cluster Y แบบมี tolerance: บาง statement (เช่น SCB) วางคำอธิบายเหลื่อม baseline
  // ~1px จากแถวยอดเงิน — ถ้า round เป๊ะจะแยกเป็น 2 บรรทัด ทำให้ชื่อผู้โอนหลุด
  const Y_TOL = 3
  const lines: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const items: { y: number; x: number; s: string }[] = []
    for (const item of content.items) {
      if (!('str' in item) || !('transform' in item)) continue
      const ti = item as { str: string; transform: number[] }
      if (ti.str.trim() === '') continue
      items.push({ y: ti.transform[5], x: ti.transform[4], s: ti.str })
    }
    items.sort((a, b) => b.y - a.y || a.x - b.x) // บนลงล่าง · ซ้ายไปขวา

    let anchorY: number | null = null
    let row: { x: number; s: string }[] = []
    const flush = () => {
      if (!row.length) return
      const text = row.sort((a, b) => a.x - b.x).map((o) => o.s).join(' ').replace(/\s+/g, ' ').trim()
      if (text) lines.push(text)
      row = []
    }
    for (const it of items) {
      if (anchorY === null || Math.abs(it.y - anchorY) > Y_TOL) {
        flush()
        anchorY = it.y
      }
      row.push({ x: it.x, s: it.s })
    }
    flush()
  }
  return lines.join('\n')
}

/** RFC4180 CSV → string[][] · เก็บ string เดิม (เลี่ยง SheetJS แปลงคอลัมน์วันที่เป็น date) */
function parseCsvRows(text: string): string[][] {
  const t = text.replace(/^\uFEFF/, '') // strip BOM
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (inQuotes) {
      if (ch === '"') {
        if (t[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field); field = ''
    } else if (ch === '\n') {
      row.push(field); rows.push(row); row = []; field = ''
    } else if (ch !== '\r') {
      field += ch
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows
}

/** อ่านไฟล์ statement → ParsedStatement (รองรับ PDF / CSV / XLSX อัตโนมัติตามชนิดไฟล์) */
async function parseStatementFile(file: File, password?: string): Promise<ParsedStatement> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) {
    return parseStatementText(await extractPdfText(file, password))
  }
  if (name.endsWith('.csv')) {
    return parseStatementRows(parseCsvRows(await file.text()))
  }
  // XLS / XLSX → SheetJS (เก็บ cell วันที่เป็น text อยู่แล้ว ไม่โดนแปลง)
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, blankrows: false })
  return parseStatementRows(rows)
}

const BANK_LABEL: Record<string, string> = {
  SCB: 'ไทยพาณิชย์',
  KBANK: 'กสิกรไทย',
  BBL: 'กรุงเทพ',
  BAY: 'กรุงศรี',
  UNKNOWN: 'ไม่รู้จัก',
}

// ── main component ────────────────────────────────────────────────────────────
interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function ImportPdfDialog({ open, onOpenChange }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [needPwd, setNeedPwd] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<StatementInfo | null>(null)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [detectedBankAccId, setDetectedBankAccId] = useState<string | undefined>()
  const [manualBankId, setManualBankId] = useState<string | undefined>()
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: bankAccounts } = useBankAccounts()
  const { data: contracts } = useContracts()
  const batchSave = useBatchSavePayments()

  // จับคู่เงินเข้า → สัญญา/ผู้เช่า (กรองด้วยบัญชี แล้วเทียบยอด+ชื่อ)
  const effectiveBankId = manualBankId ?? detectedBankAccId
  const candidates = useMemo(
    () => (effectiveBankId && contracts ? candidatesForAccount(contracts, effectiveBankId) : []),
    [contracts, effectiveBankId],
  )
  const matches = useMemo(() => {
    const m = new Map<string, MatchResult>()
    for (const r of rows) m.set(r._id, matchTransaction({ amount: r.amount, payerName: r.payerName }, candidates))
    return m
  }, [rows, candidates])

  // ── reset ──────────────────────────────────────────────────────────────────
  function reset() {
    setStep('upload')
    setFile(null)
    setPassword('')
    setNeedPwd(false)
    setError(null)
    setInfo(null)
    setRows([])
    setDetectedBankAccId(undefined)
    setManualBankId(undefined)
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── parse PDF ──────────────────────────────────────────────────────────────
  async function handleParse() {
    if (!file) return
    setError(null)
    setStep('parsing')

    try {
      const { info: stmtInfo, transactions } = await parseStatementFile(file, password || undefined)

      if (stmtInfo.bank === 'UNKNOWN') {
        setError('ไม่รู้จักรูปแบบ statement นี้ — รองรับ ไทยพาณิชย์ · กสิกร · กรุงเทพ · กรุงศรี (PDF/CSV/Excel) · ถ้าเป็นธนาคารอื่นแจ้งทีมพัฒนา')
        setStep('upload')
        return
      }

      // จับคู่ account number กับ bank_accounts ในระบบ (BBL ปิดบังเลขกลาง → เทียบหน้า-หลัง)
      const matched = (bankAccounts ?? []).find((b) =>
        acctNoMatches(stmtInfo.acctNoRaw, b.data?.acctNo ?? ''),
      )
      setDetectedBankAccId(matched?.id)

      const importRows: ImportRow[] = transactions.map((t, i) => ({
        ...t,
        _id: `row-${i}`,
        selected: true,
        matchedBankAccountId: matched?.id,
      }))

      setInfo(stmtInfo)
      setRows(importRows)
      setStep('preview')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('password') || msg.includes('Password') || msg.includes('encrypted')) {
        setNeedPwd(true)
        setError('PDF นี้มีรหัสผ่าน — กรุณาใส่รหัสแล้วลองใหม่')
        setStep('upload')
      } else {
        setError(`อ่านไฟล์ไม่สำเร็จ: ${msg}`)
        setStep('upload')
      }
    }
  }

  // ── toggle select ──────────────────────────────────────────────────────────
  function toggleRow(id: string) {
    setRows((prev) =>
      prev.map((r) => (r._id === id ? { ...r, selected: !r.selected } : r)),
    )
  }

  function selectAll(val: boolean) {
    setRows((prev) => prev.map((r) => ({ ...r, selected: val })))
  }

  // ── save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    const selected = rows.filter((r) => r.selected)
    if (selected.length === 0) return

    setStep('saving')
    const batch: BatchPaymentRow[] = selected.map((r) => ({
      date: r.date,
      amount: r.amount,
      bank_account_id: effectiveBankId ?? r.matchedBankAccountId,
      contract_id: matches.get(r._id)?.contractId,
      payerName: r.payerName,
      payMethod: 'transfer' as const,
      notes: r.description,
      status: 'unallocated' as const,
    }))

    try {
      await batchSave.mutateAsync(batch)
      setStep('done')
    } catch {
      setError('บันทึกไม่สำเร็จ กรุณาลองใหม่')
      setStep('preview')
    }
  }

  const selectedCount = rows.filter((r) => r.selected).length
  const allSelected = rows.length > 0 && selectedCount === rows.length

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className='max-w-2xl max-h-[85vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>นำเข้า Statement จากธนาคาร</DialogTitle>
          <DialogDescription>
            อัปโหลดไฟล์ statement (PDF / CSV / Excel) จาก ไทยพาณิชย์ · กสิกร · กรุงเทพ · กรุงศรี · ระบบจะดึงรายการเงินเข้าให้อัตโนมัติ
          </DialogDescription>
        </DialogHeader>

        {/* ── STEP: upload ── */}
        {(step === 'upload' || step === 'parsing') && (
          <div className='space-y-4 py-2'>
            {/* file picker */}
            <div
              className={cn(
                'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-10 cursor-pointer transition-colors',
                file ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/40',
              )}
              onClick={() => fileRef.current?.click()}
            >
              <FileUp className='size-8 text-muted-foreground' />
              {file ? (
                <p className='text-sm font-medium'>{file.name}</p>
              ) : (
                <p className='text-sm text-muted-foreground'>คลิกเพื่อเลือกไฟล์ (PDF / CSV / Excel)</p>
              )}
              <input
                ref={fileRef}
                type='file'
                accept='.pdf,.csv,.xls,.xlsx'
                className='hidden'
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  setFile(f)
                  setError(null)
                  if (f) setNeedPwd(false)
                }}
              />
            </div>

            {/* password */}
            {(needPwd || password) && (
              <div className='space-y-1.5'>
                <Label htmlFor='pdf-pwd'>รหัสผ่าน PDF</Label>
                <div className='relative'>
                  <Input
                    id='pdf-pwd'
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder='ใส่รหัสผ่าน PDF'
                    className='pr-10'
                  />
                  <button
                    type='button'
                    onClick={() => setShowPwd((v) => !v)}
                    className='absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                  >
                    {showPwd ? <EyeOff className='size-4' /> : <Eye className='size-4' />}
                  </button>
                </div>
              </div>
            )}

            {/* toggle password manually */}
            {!needPwd && !password && (
              <button
                type='button'
                className='text-xs text-muted-foreground underline-offset-2 hover:underline'
                onClick={() => setNeedPwd(true)}
              >
                PDF นี้มีรหัสผ่าน
              </button>
            )}

            {/* error */}
            {error && (
              <div className='flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive'>
                <AlertCircle className='size-4 shrink-0' />
                {error}
              </div>
            )}
          </div>
        )}

        {/* ── STEP: parsing skeleton ── */}
        {step === 'parsing' && (
          <div className='space-y-2 py-2'>
            <p className='text-sm text-muted-foreground flex items-center gap-2'>
              <Loader2 className='size-4 animate-spin' /> กำลังอ่านไฟล์…
            </p>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className='h-8 w-full' />
            ))}
          </div>
        )}

        {/* ── STEP: preview ── */}
        {step === 'preview' && info && (
          <div className='space-y-4'>
            {/* statement info */}
            <div className='flex flex-wrap gap-2 text-sm'>
              <Badge variant='outline'>{BANK_LABEL[info.bank] ?? info.bank}</Badge>
              {info.accountName && <span className='text-muted-foreground'>{info.accountName}</span>}
              {detectedBankAccId && !manualBankId ? (
                <Badge variant='outline' className='text-green-600 border-green-300'>
                  <CheckCircle2 className='size-3 mr-1' /> จับคู่บัญชีในระบบแล้ว
                </Badge>
              ) : !detectedBankAccId && !manualBankId ? (
                <Badge variant='outline' className='text-amber-600 border-amber-300'>
                  ไม่พบบัญชีนี้ในระบบ — เลือกบัญชีด้านล่าง
                </Badge>
              ) : null}
            </div>

            {/* บัญชีรับเงิน — เลือกเองได้ (จำเป็นถ้าจับคู่อัตโนมัติไม่ได้ เช่น CSV ไม่มีเลขบัญชี) */}
            <div className='space-y-1.5'>
              <Label className='text-xs'>บัญชีรับเงิน (เงินทุกรายการเข้าบัญชีนี้)</Label>
              <Select
                value={manualBankId ?? detectedBankAccId ?? ''}
                onValueChange={(v) => setManualBankId(v)}
              >
                <SelectTrigger className='h-9 text-sm'>
                  <SelectValue placeholder='— เลือกบัญชีรับเงิน —' />
                </SelectTrigger>
                <SelectContent>
                  {(bankAccounts ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.data?.bank} {b.data?.acctNo} · {b.data?.accountName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {rows.length === 0 ? (
              <p className='text-sm text-muted-foreground py-4 text-center'>
                ไม่พบรายการรับเงินใน statement นี้
              </p>
            ) : (
              <>
                {/* select all */}
                <div className='flex items-center gap-2 text-sm'>
                  <Checkbox
                    id='select-all'
                    checked={allSelected}
                    onCheckedChange={(v) => selectAll(!!v)}
                  />
                  <label htmlFor='select-all' className='cursor-pointer'>
                    เลือกทั้งหมด ({rows.length} รายการ)
                  </label>
                </div>

                {/* table */}
                <div className='rounded-md border overflow-hidden'>
                  <table className='w-full text-xs'>
                    <thead className='bg-muted/50'>
                      <tr>
                        <th className='w-8 p-2'></th>
                        <th className='p-2 text-left'>วันที่</th>
                        <th className='p-2 text-right'>ยอด (บาท)</th>
                        <th className='p-2 text-left'>ผู้โอน</th>
                        <th className='p-2 text-left'>ผู้เช่า (เดา)</th>
                      </tr>
                    </thead>
                    <tbody className='divide-y'>
                      {rows.map((r) => (
                        <tr
                          key={r._id}
                          className={cn(
                            'cursor-pointer hover:bg-muted/40 transition-colors',
                            !r.selected && 'opacity-40',
                          )}
                          onClick={() => toggleRow(r._id)}
                        >
                          <td className='p-2 text-center'>
                            <Checkbox
                              checked={r.selected}
                              onCheckedChange={() => toggleRow(r._id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className='p-2 font-mono whitespace-nowrap'>{r.date}</td>
                          <td className='p-2 text-right font-semibold tabular-nums whitespace-nowrap'>
                            {amt(r.amount, { decimal: 0, symbol: false })}
                          </td>
                          <td className='p-2 max-w-[120px] truncate' title={r.payerName}>
                            {r.payerName || '—'}
                          </td>
                          <td className='p-2 max-w-[180px]'>
                            {(() => {
                              const mt = matches.get(r._id)
                              if (!mt || mt.confidence === 'none') {
                                return <span className='text-muted-foreground'>— ไม่พบ</span>
                              }
                              const dot = mt.confidence === 'high' ? 'bg-green-500' : 'bg-amber-500'
                              return (
                                <div className='flex items-center gap-1.5' title={`${mt.contractNo ?? ''} · ${mt.reason}`}>
                                  <span className={cn('size-2 rounded-full shrink-0', dot)} />
                                  <span className='truncate'>{mt.tenantName || mt.contractNo}</span>
                                </div>
                              )
                            })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {error && (
                  <div className='flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive'>
                    <AlertCircle className='size-4 shrink-0' />
                    {error}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── STEP: saving ── */}
        {step === 'saving' && (
          <div className='flex flex-col items-center gap-3 py-10 text-muted-foreground'>
            <Loader2 className='size-8 animate-spin' />
            <p className='text-sm'>กำลังบันทึก {selectedCount} รายการ…</p>
          </div>
        )}

        {/* ── STEP: done ── */}
        {step === 'done' && (
          <div className='flex flex-col items-center gap-3 py-10'>
            <CheckCircle2 className='size-10 text-green-500' />
            <p className='text-sm font-medium'>บันทึกแล้ว {selectedCount} รายการ</p>
            <p className='text-xs text-muted-foreground text-center'>
              รายการทั้งหมดถูกบันทึกเป็น "ยังไม่จับคู่" — สามารถจับคู่กับใบแจ้งหนี้ได้ในหน้ารายละเอียด
            </p>
          </div>
        )}

        {/* ── footer ── */}
        <DialogFooter>
          {step === 'upload' && (
            <Button onClick={handleParse} disabled={!file}>
              อ่านรายการจาก PDF
            </Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant='outline' onClick={reset}>เริ่มใหม่</Button>
              <Button onClick={handleSave} disabled={selectedCount === 0}>
                บันทึก {selectedCount} รายการที่เลือก
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={() => { reset(); onOpenChange(false) }}>ปิด</Button>
          )}
          {(step === 'upload' || step === 'preview') && (
            <Button variant='ghost' onClick={() => { reset(); onOpenChange(false) }}>
              ยกเลิก
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
