/**
 * PDF Bank Statement Import Dialog
 * อัปโหลด PDF statement จาก SCB / KBank → preview → บันทึกเป็น payments
 */
import * as pdfjsLib from 'pdfjs-dist'
import * as XLSX from 'xlsx'
import { useState, useRef, useMemo, Fragment } from 'react'
import { FileUp, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff, Ban, Settings2, ChevronDown, ChevronRight, Split, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
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
import { useQuery } from '@tanstack/react-query'
import { useBankAccounts } from '@/features/bank-accounts/queries'
import { useContracts } from '@/features/contracts/queries'
import { useProperties } from '@/features/properties/queries'
import { useInvoices } from '@/features/invoices/queries'
import { fetchUnbilledUtilitiesByContract } from '@/features/invoices/mutations'
import { usePaymentsByBankAccount } from './queries'
import { candidatesForAccount, matchTransaction, sourceKeyOf, type MatchResult } from './matching'
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

/** ลายนิ้วมือ 1 รายการ — วันที่+ยอด+เวลา+เลขบัญชีต้นทาง · ใช้จับว่านำเข้าซ้ำ (D) */
function txFingerprint(date: string, amount: number, time?: string, suffix?: string): string {
  return `${date}|${(Number(amount) || 0).toFixed(2)}|${time ?? ''}|${suffix ?? ''}`
}

// คอลัมน์ที่ซ่อน/โชว์ได้ (⚙️) · key → label · จดจำใน localStorage
type ColKey = 'time' | 'payer' | 'source'
const TOGGLE_COLS: { key: ColKey; label: string }[] = [
  { key: 'payer', label: 'ผู้โอน' },
  { key: 'source', label: 'บัญชีต้นทาง' },
  { key: 'time', label: 'เวลา' },
]
const COLS_LS_KEY = 'sn.import.hiddenCols'
const DEFAULT_HIDDEN: ColKey[] = ['time'] // เวลา ซ่อนเริ่มต้น (ข้อมูลรอง)

function loadHiddenCols(): Set<ColKey> {
  try {
    const raw = localStorage.getItem(COLS_LS_KEY)
    if (raw) return new Set(JSON.parse(raw) as ColKey[])
  } catch {
    /* ignore */
  }
  return new Set(DEFAULT_HIDDEN)
}

/** สถานะการจับคู่ของ 1 รายการ — ใช้จัดกลุ่ม/เรียง/แถบสรุป */
type RowState = 'matched' | 'review' | 'unmatched' | 'other' | 'dup'

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
  const [picked, setPicked] = useState<Record<string, string>>({}) // rowId → contractId (override การเดา)
  const [notRent, setNotRent] = useState<Set<string>>(new Set()) // E — รายการที่ mark ว่า "ไม่ใช่ค่าเช่า"
  const toggleNotRent = (id: string) =>
    setNotRent((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  // สเต็ป 2 — แบ่งจ่าย: rowId → หลายบรรทัด {สัญญา, ยอด} · มีค่า = อยู่โหมดแบ่ง
  const [splits, setSplits] = useState<Record<string, { contractId: string; amount: number }[]>>({})
  const startSplit = (id: string, full: number, suggested?: string) =>
    setSplits((prev) => ({
      ...prev,
      [id]: [
        { contractId: suggested ?? '', amount: full },
        { contractId: '', amount: 0 },
      ],
    }))
  const cancelSplit = (id: string) =>
    setSplits((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  const setSplitLines = (id: string, lines: { contractId: string; amount: number }[]) =>
    setSplits((prev) => ({ ...prev, [id]: lines }))

  // มุมมอง manage-by-exception
  const [showOnlyNeeded, setShowOnlyNeeded] = useState(false) // กรอง "เฉพาะที่ต้องจับ"
  const [collapseGreen, setCollapseGreen] = useState(true) // พับกลุ่ม 🟢 จับให้แล้ว
  const [hiddenCols, setHiddenCols] = useState<Set<ColKey>>(() => loadHiddenCols())
  const toggleCol = (key: ColKey) =>
    setHiddenCols((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      try {
        localStorage.setItem(COLS_LS_KEY, JSON.stringify([...next]))
      } catch {
        /* ignore */
      }
      return next
    })
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: bankAccounts } = useBankAccounts()
  const { data: contracts } = useContracts()
  const { data: properties } = useProperties()
  const { data: allInvoices } = useInvoices()
  const batchSave = useBatchSavePayments()

  // ชื่อห้อง/ทรัพย์ — map pid → name (โชว์ใน dropdown)
  const propNameByPid = useMemo(() => {
    const m = new Map<number, string>()
    for (const p of properties ?? []) {
      if (p.data?.pid != null) m.set(Number(p.data.pid), String(p.data.name ?? ''))
    }
    return m
  }, [properties])

  // ค้างต่อสัญญา — ใบแจ้งหนี้ที่ยังไม่จ่าย/จ่ายบางส่วน (สถานะ ≠ paid/voided) · นับใบ + รวมยอดค้าง
  const arrearsByContract = useMemo(() => {
    const m = new Map<string, { count: number; outstanding: number }>()
    for (const inv of allInvoices ?? []) {
      const st = (inv.status ?? inv.data?.status ?? '').toLowerCase()
      if (st === 'paid' || st === 'voided') continue
      const cid = inv.contract_id
      if (!cid) continue
      const d = inv.data ?? {}
      const total = Number(d.total) || 0
      const paid = Number(d.paidAmount ?? d.paid_amount ?? 0) || 0
      const out = Math.max(0, total - paid)
      if (out <= 0.01) continue
      const cur = m.get(cid) ?? { count: 0, outstanding: 0 }
      cur.count += 1
      cur.outstanding += out
      m.set(cid, cur)
    }
    return m
  }, [allInvoices])

  // B — ค่าน้ำ/ไฟค้างบิลต่อสัญญา (reuse ตัวเดียวกับระบบออกใบแจ้งหนี้) → ช่วยจับยอดห้องรวมน้ำไฟ
  const { data: utilLines } = useQuery({
    queryKey: ['unbilled-utilities-by-contract', contracts],
    queryFn: () => fetchUnbilledUtilitiesByContract(contracts ?? []),
    enabled: open && !!contracts && contracts.length > 0,
  })
  const utilTotalByContract = useMemo(() => {
    const m = new Map<string, number>()
    if (!utilLines) return m
    for (const [cid, lines] of utilLines) {
      const sum = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
      if (sum > 0) m.set(cid, sum)
    }
    return m
  }, [utilLines])

  // จับคู่เงินเข้า → สัญญา/ผู้เช่า (กรองด้วยบัญชี แล้วเทียบยอด+ชื่อ+น้ำไฟ)
  // detect จาก statement = ตัวจริง (ชนะเสมอ) · เลือกเองใช้เฉพาะตอน detect ไม่เจอ
  const effectiveBankId = detectedBankAccId ?? manualBankId
  const candidates = useMemo(
    () =>
      effectiveBankId && contracts
        ? candidatesForAccount(contracts, effectiveBankId, utilTotalByContract, propNameByPid)
        : [],
    [contracts, effectiveBankId, utilTotalByContract, propNameByPid],
  )
  // ประวัติเงินเข้าบัญชีนี้ — ใช้ทั้งกันซ้ำ (D) และ "จำบัญชีต้นทาง→ผู้เช่า" (A)
  const existingPays = usePaymentsByBankAccount(effectiveBankId)

  // A — เรียนรู้: เลขบัญชีต้นทาง (เช่น KBANK|9812) → สัญญาที่เคยจับ
  // ถ่วงน้ำหนัก "พนักงานเลือกเอง" (3) > "ระบบเดา" (1) · ต้องชัดพอ (รวม ≥2) จึงจำ
  const learnedBySource = useMemo(() => {
    const tally = new Map<string, Map<string, number>>()
    for (const p of existingPays.data ?? []) {
      const key = sourceKeyOf(p.data.sourceBankCode, p.data.sourceAcctSuffix)
      const cid = p.data.contract_id
      if (!key || !cid || p.data.status === 'other') continue
      const w = p.data.pickedManually ? 3 : 1
      const byC = tally.get(key) ?? new Map<string, number>()
      byC.set(cid, (byC.get(cid) ?? 0) + w)
      tally.set(key, byC)
    }
    const out = new Map<string, string>()
    for (const [key, byC] of tally) {
      let bestCid = ''
      let bestW = 0
      let total = 0
      for (const [cid, w] of byC) {
        total += w
        if (w > bestW) { bestW = w; bestCid = cid }
      }
      // จำเฉพาะที่ชัด: น้ำหนักรวม ≥2 และตัวที่ชนะกินสัดส่วน >ครึ่ง (กันบัญชีที่เคยจับหลายสัญญาสลับกัน)
      if (bestCid && total >= 2 && bestW * 2 > total) out.set(key, bestCid)
    }
    return out
  }, [existingPays.data])

  const matches = useMemo(() => {
    const m = new Map<string, MatchResult>()
    for (const r of rows) {
      m.set(
        r._id,
        matchTransaction(
          { amount: r.amount, payerName: r.payerName, sourceKey: sourceKeyOf(r.sourceBankCode, r.sourceAcctSuffix) },
          candidates,
          learnedBySource,
        ),
      )
    }
    return m
  }, [rows, candidates, learnedBySource])

  // D — กัน import ซ้ำ: รายการที่ลายนิ้วมือ (วันที่+ยอด+เวลา+เลขต้นทาง) ตรงกับเงินที่เคยเข้าบัญชีนี้แล้ว
  const existingFingerprints = useMemo(() => {
    const s = new Set<string>()
    for (const p of existingPays.data ?? []) {
      // ลายนิ้วมือ "โอนต้นทาง" ที่เก็บไว้ (กันซ้ำแม้แบ่งจ่าย) + reconstruct เผื่อ payment เก่า
      if (p.data.fingerprint) s.add(p.data.fingerprint)
      else s.add(txFingerprint(p.data.date, Number(p.data.amount) || 0, p.data.time, p.data.sourceAcctSuffix))
    }
    return s
  }, [existingPays.data])
  const dupIds = useMemo(() => {
    const s = new Set<string>()
    if (existingFingerprints.size === 0) return s
    for (const r of rows) {
      if (existingFingerprints.has(txFingerprint(r.date, r.amount, r.time, r.sourceAcctSuffix))) s.add(r._id)
    }
    return s
  }, [rows, existingFingerprints])

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
    setPicked({})
    setNotRent(new Set())
    setSplits({})
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
    if (dupIds.has(id)) return // รายการซ้ำ — กันไม่ให้เลือก
    setRows((prev) =>
      prev.map((r) => (r._id === id ? { ...r, selected: !r.selected } : r)),
    )
  }

  function selectAll(val: boolean) {
    setRows((prev) => prev.map((r) => (dupIds.has(r._id) ? r : { ...r, selected: val })))
  }

  // ── save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    const selected = rows.filter((r) => r.selected && !dupIds.has(r._id))
    if (selected.length === 0) return

    setStep('saving')
    const batch: BatchPaymentRow[] = selected.flatMap((r) => {
      const fp = txFingerprint(r.date, r.amount, r.time, r.sourceAcctSuffix)
      const base = {
        date: r.date,
        time: r.time || undefined,
        bank_account_id: effectiveBankId ?? r.matchedBankAccountId,
        payerName: r.payerName,
        sourceBankCode: r.sourceBankCode || undefined,
        sourceAcctSuffix: r.sourceAcctSuffix || undefined,
        fingerprint: fp, // ลายนิ้วมือ "โอนต้นทาง" เต็มก้อน — กันซ้ำแม้แบ่งจ่าย
        payMethod: 'transfer' as const,
      }
      // สเต็ป 2 — แบ่งจ่าย: 1 โอน → หลาย payment (ห้องละ record · ใช้ fingerprint เดียวกัน)
      // แบ่งเฉพาะตอนถูกต้อง (ทุกบรรทัดมีสัญญา + ยอดรวมตรงกับยอดโอน) มิฉะนั้นเซฟเป็นก้อนเดียว
      const sp = splits[r._id]
      const spSum = sp ? sp.reduce((s, l) => s + (Number(l.amount) || 0), 0) : 0
      const spValid = !!sp && sp.length > 1 && sp.every((l) => l.contractId) && Math.abs(spSum - r.amount) <= 1
      if (spValid && sp) {
        const lines = sp.filter((l) => Number(l.amount) > 0)
        return lines.map((l, i) => ({
          ...base,
          amount: Number(l.amount),
          contract_id: l.contractId,
          pickedManually: true,
          notes: `แบ่งจ่าย ${i + 1}/${lines.length} · ${r.description}`,
          status: 'unallocated' as const,
        }))
      }
      // "ไม่ใช่ค่าเช่า" → ไม่ผูกสัญญา · บันทึกเป็นเงินเข้าสถานะ other (ยอดบัญชีกระทบครบ)
      const isOther = notRent.has(r._id)
      return [
        {
          ...base,
          amount: r.amount,
          contract_id: isOther ? undefined : (picked[r._id] ?? matches.get(r._id)?.contractId),
          pickedManually: isOther ? false : picked[r._id] != null,
          notes: r.description,
          status: isOther ? ('other' as const) : ('unallocated' as const),
        },
      ]
    })

    try {
      await batchSave.mutateAsync(batch)
      setStep('done')
    } catch {
      setError('บันทึกไม่สำเร็จ กรุณาลองใหม่')
      setStep('preview')
    }
  }

  const selectedCount = rows.filter((r) => r.selected && !dupIds.has(r._id)).length
  const selectableCount = rows.length - dupIds.size
  const allSelected = selectableCount > 0 && selectedCount === selectableCount

  // C — เช็คยอดรวม: รวมเงินเข้าที่ดึงได้ทั้งหมด เทียบกับยอดที่ statement พิมพ์ไว้ (ถ้ามี)
  const parsedTotal = rows.reduce((s, r) => s + r.amount, 0)
  const controlTotal = info?.controlTotal
  const controlMismatch = controlTotal != null && Math.abs(controlTotal - parsedTotal) > 1

  // ── manage-by-exception: สถานะ/กลุ่ม/นับ ของแต่ละรายการ ──────────────────────
  const rowStateById = useMemo(() => {
    const m = new Map<string, RowState>()
    for (const r of rows) {
      if (dupIds.has(r._id)) { m.set(r._id, 'dup'); continue }
      if (notRent.has(r._id)) { m.set(r._id, 'other'); continue }
      const sp = splits[r._id]
      if (sp) {
        const sum = sp.reduce((s, l) => s + (Number(l.amount) || 0), 0)
        const valid = sp.length > 1 && sp.every((l) => l.contractId) && Math.abs(sum - r.amount) <= 1
        m.set(r._id, valid ? 'matched' : 'review')
        continue
      }
      const mt = matches.get(r._id)
      const chosen = picked[r._id] ?? mt?.contractId
      if (chosen && (picked[r._id] != null || mt?.confidence === 'high')) m.set(r._id, 'matched')
      else if (chosen && mt?.confidence === 'medium') m.set(r._id, 'review')
      else m.set(r._id, 'unmatched')
    }
    return m
  }, [rows, dupIds, notRent, splits, matches, picked])

  const grouped = useMemo(() => {
    const g: Record<RowState, ImportRow[]> = { unmatched: [], review: [], matched: [], other: [], dup: [] }
    for (const r of rows) g[rowStateById.get(r._id) ?? 'unmatched'].push(r)
    return g
  }, [rows, rowStateById])

  const previewFull = step === 'preview' && !!info && rows.length > 0

  // คอลัมน์ที่โชว์ (⚙️)
  const showPayer = !hiddenCols.has('payer')
  const showSource = !hiddenCols.has('source')
  const showTime = !hiddenCols.has('time')
  const colCount = 4 + (showPayer ? 1 : 0) + (showSource ? 1 : 0) + (showTime ? 1 : 0)

  // ตัวเลือกสัญญาใน dropdown (ใช้ซ้ำทั้งช่องจับคู่หลัก + ช่องแบ่งจ่าย · ไม่ copy)
  const candidateItems =
    candidates.length === 0 ? (
      <div className='px-2 py-1 text-xs text-muted-foreground'>ไม่มีสัญญาผูกบัญชีนี้</div>
    ) : (
      candidates.map((c) => {
        const ar = arrearsByContract.get(c.id)
        return (
          <SelectItem key={c.id} value={c.id} className='text-xs'>
            {c.tenant || c.no}
            {c.room ? ` · ${c.room}` : ''} · {amt(c.expected, { decimal: 0, symbol: false })}
            {ar ? ` · ค้าง ${ar.count} ใบ` : ''}
          </SelectItem>
        )
      })
    )

  /** แถว 1 รายการ — ใช้ร่วมทุกกลุ่ม (คืน Fragment: แถวหลัก + ตัวแก้แบ่งจ่ายถ้ามี) */
  const renderRow = (r: ImportRow) => {
    const st = rowStateById.get(r._id)
    const isDup = st === 'dup'
    const isOther = st === 'other'
    const sp = splits[r._id]
    const splitSum = sp ? sp.reduce((s, l) => s + (Number(l.amount) || 0), 0) : 0
    const splitOk = !!sp && sp.length > 1 && sp.every((l) => l.contractId) && Math.abs(splitSum - r.amount) <= 1
    const mt = matches.get(r._id)
    const chosen = picked[r._id] ?? mt?.contractId ?? ''
    const pct = mt?.score ?? 0
    const pctCls =
      pct >= 75 ? 'text-green-600 border-green-300 bg-green-50'
      : pct >= 40 ? 'text-amber-600 border-amber-300 bg-amber-50'
      : 'text-muted-foreground border-border'
    return (
      <Fragment key={r._id}>
        <tr
          className={cn(
            'transition-colors',
            isDup ? 'opacity-50' : cn('cursor-pointer hover:bg-muted/40', !r.selected && 'opacity-40'),
          )}
          onClick={() => toggleRow(r._id)}
        >
          <td className='p-2 text-center align-top'>
            <Checkbox
              checked={r.selected && !isDup}
              disabled={isDup}
              onCheckedChange={() => toggleRow(r._id)}
              onClick={(e) => e.stopPropagation()}
            />
          </td>
          {showSource && (
            <td className='whitespace-nowrap p-2 align-top text-[11px] text-muted-foreground'>
              {r.sourceBankCode || '—'}
              {r.sourceAcctSuffix ? ` x${r.sourceAcctSuffix}` : ''}
            </td>
          )}
          <td className='whitespace-nowrap p-2 align-top font-mono'>
            {r.date}
            {isDup && (
              <span className='ml-1.5 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'>
                ซ้ำ
              </span>
            )}
          </td>
          {showTime && (
            <td className='whitespace-nowrap p-2 align-top text-muted-foreground'>{r.time || '—'}</td>
          )}
          <td className='whitespace-nowrap p-2 text-right align-top font-semibold tabular-nums'>
            {amt(r.amount, { decimal: 0, symbol: false })}
          </td>
          {showPayer && (
            <td className='max-w-[140px] truncate p-2 align-top' title={r.payerName}>
              {r.payerName || '—'}
            </td>
          )}
          <td className='max-w-[260px] p-2 align-top' onClick={(e) => e.stopPropagation()}>
            {isOther ? (
              <div className='flex items-center justify-between gap-1.5 text-xs text-slate-500 dark:text-slate-400'>
                <span className='flex items-center gap-1'>
                  <Ban className='size-3 shrink-0' /> ไม่ใช่ค่าเช่า
                </span>
                <button type='button' className='shrink-0 underline-offset-2 hover:underline' onClick={() => toggleNotRent(r._id)}>
                  คืนค่า
                </button>
              </div>
            ) : sp ? (
              <div className='flex items-center justify-between gap-1.5 text-xs'>
                <span className={cn('flex items-center gap-1', splitOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
                  <Split className='size-3 shrink-0' /> แบ่ง {sp.filter((l) => l.contractId).length} ห้อง
                  {!splitOk && ' · ยอดไม่ตรง'}
                </span>
                <button type='button' className='shrink-0 underline-offset-2 hover:underline' onClick={() => cancelSplit(r._id)}>
                  ยกเลิก
                </button>
              </div>
            ) : (
              <div className='flex items-center gap-1.5'>
                <span className={cn('shrink-0 rounded border px-1 text-[10px] tabular-nums', pctCls)} title={mt?.reason ?? 'ยังไม่จับคู่'}>
                  {pct > 0 ? `${pct}%` : '—'}
                </span>
                <Select value={chosen} onValueChange={(v) => setPicked((p) => ({ ...p, [r._id]: v }))}>
                  <SelectTrigger className='h-7 text-xs'>
                    <SelectValue placeholder='เลือกผู้เช่า…' />
                  </SelectTrigger>
                  <SelectContent>{candidateItems}</SelectContent>
                </Select>
                <button
                  type='button'
                  title='แบ่งจ่าย (1 โอน → หลายห้อง)'
                  className='shrink-0 text-muted-foreground hover:text-foreground'
                  onClick={() => startSplit(r._id, r.amount, chosen || undefined)}
                >
                  <Split className='size-3.5' />
                </button>
                <button
                  type='button'
                  title='ไม่ใช่ค่าเช่า (โอนผิด/เงินอื่น)'
                  className='shrink-0 text-muted-foreground hover:text-foreground'
                  onClick={() => toggleNotRent(r._id)}
                >
                  <Ban className='size-3.5' />
                </button>
              </div>
            )}
          </td>
        </tr>
        {sp && (
          <tr className='bg-muted/20'>
            <td colSpan={colCount} className='px-4 py-2.5' onClick={(e) => e.stopPropagation()}>
              <div className='space-y-1.5'>
                <div className='text-xs font-medium text-muted-foreground'>
                  แบ่งจ่าย {amt(r.amount, { decimal: 0, symbol: false })} บาท เป็นหลายห้อง:
                </div>
                {sp.map((ln, i) => (
                  <div key={i} className='flex items-center gap-2'>
                    <Select
                      value={ln.contractId}
                      onValueChange={(v) =>
                        setSplitLines(r._id, sp.map((x, j) => (j === i ? { ...x, contractId: v } : x)))
                      }
                    >
                      <SelectTrigger className='h-7 flex-1 text-xs'>
                        <SelectValue placeholder='เลือกห้อง/ผู้เช่า…' />
                      </SelectTrigger>
                      <SelectContent>{candidateItems}</SelectContent>
                    </Select>
                    <Input
                      type='number'
                      inputMode='decimal'
                      value={ln.amount || ''}
                      onChange={(e) =>
                        setSplitLines(r._id, sp.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) || 0 } : x)))
                      }
                      className='h-7 w-28 text-right text-xs tabular-nums'
                      placeholder='ยอด'
                    />
                    <button
                      type='button'
                      className='shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-30'
                      disabled={sp.length <= 2}
                      onClick={() => setSplitLines(r._id, sp.filter((_, j) => j !== i))}
                      title='ลบบรรทัด'
                    >
                      <X className='size-3.5' />
                    </button>
                  </div>
                ))}
                <div className='flex items-center justify-between pt-0.5'>
                  <button
                    type='button'
                    className='flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline'
                    onClick={() => setSplitLines(r._id, [...sp, { contractId: '', amount: 0 }])}
                  >
                    <Plus className='size-3' /> เพิ่มห้อง
                  </button>
                  <span className={cn('text-xs tabular-nums', splitOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
                    รวม {amt(splitSum, { decimal: 0, symbol: false })} / {amt(r.amount, { decimal: 0, symbol: false })}
                    {!splitOk && Math.abs(splitSum - r.amount) > 1 && ` (ต่าง ${amt(Math.abs(splitSum - r.amount), { decimal: 0, symbol: false })})`}
                  </span>
                </div>
              </div>
            </td>
          </tr>
        )}
      </Fragment>
    )
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent
        className={cn(
          previewFull
            ? 'flex max-h-[92vh] w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1100px]'
            : 'max-w-2xl max-h-[85vh] overflow-y-auto',
        )}
      >
        <DialogHeader className={previewFull ? 'shrink-0 border-b px-6 pb-3 pt-5' : undefined}>
          <DialogTitle>นำเข้า Statement จากธนาคาร</DialogTitle>
          <DialogDescription className={previewFull ? 'sr-only' : undefined}>
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

        {/* ── STEP: preview · ไม่พบรายการ (compact) ── */}
        {step === 'preview' && info && rows.length === 0 && (
          <div className='space-y-4'>
            <div className='flex flex-wrap gap-2 text-sm'>
              <Badge variant='outline'>{BANK_LABEL[info.bank] ?? info.bank}</Badge>
              {info.accountName && <span className='text-muted-foreground'>{info.accountName}</span>}
            </div>
            <p className='py-4 text-center text-sm text-muted-foreground'>
              ไม่พบรายการรับเงินใน statement นี้
            </p>
          </div>
        )}

        {/* ── STEP: preview · เต็มจอ (manage-by-exception) ── */}
        {previewFull && info && (
          <>
            {/* แถบควบคุม + สรุป (คงที่ด้านบน) */}
            <div className='shrink-0 space-y-3 border-b bg-muted/20 px-6 py-3'>
              {/* statement info + บัญชีรับเงิน */}
              <div className='flex flex-wrap items-center gap-2 text-sm'>
                <Badge variant='outline'>{BANK_LABEL[info.bank] ?? info.bank}</Badge>
                {info.accountName && <span className='text-muted-foreground'>{info.accountName}</span>}
                <div className='ms-auto flex items-center gap-1.5'>
                  {detectedBankAccId ? (
                    <Badge variant='outline' className='gap-1 border-green-300 text-green-600'>
                      <CheckCircle2 className='size-3' />
                      {(() => {
                        const b = bankAccounts?.find((x) => x.id === detectedBankAccId)
                        return `${b?.data?.bank ?? ''} ${b?.data?.acctNo ?? ''}`
                      })()}
                      <span className='font-normal text-muted-foreground'>(ล็อกจากไฟล์)</span>
                    </Badge>
                  ) : (
                    <>
                      <Label className='text-xs text-muted-foreground'>บัญชีรับเงิน</Label>
                      <Select value={manualBankId ?? ''} onValueChange={(v) => setManualBankId(v)}>
                        <SelectTrigger className='h-8 w-64 text-xs'>
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
                    </>
                  )}
                </div>
              </div>

              {/* แถบสรุป 🟢🟡⬜ + รวมเงิน */}
              <div className='flex flex-wrap items-center gap-2 text-xs'>
                <span className='rounded-md border border-border bg-background px-2 py-1 font-medium'>
                  ⬜ ยังไม่จับ {grouped.unmatched.length}
                </span>
                <span className='rounded-md border border-amber-300 bg-amber-50 px-2 py-1 font-medium text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-300'>
                  🟡 ต้องเช็ค {grouped.review.length}
                </span>
                <span className='rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 font-medium text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-300'>
                  🟢 จับให้แล้ว {grouped.matched.length}
                </span>
                {grouped.other.length > 0 && (
                  <span className='rounded-md border border-border bg-background px-2 py-1 text-slate-500'>
                    ไม่ใช่ค่าเช่า {grouped.other.length}
                  </span>
                )}
                <span className='ms-auto flex items-center gap-3'>
                  <span className='text-muted-foreground'>
                    รวมที่ดึงได้ {rows.length} รายการ ·{' '}
                    <span className={cn('font-semibold tabular-nums', controlMismatch && 'text-red-600')}>
                      {amt(parsedTotal, { decimal: 2, symbol: false })}
                    </span>
                  </span>
                  {controlTotal != null && (
                    <span className={cn('tabular-nums', controlMismatch ? 'font-medium text-red-600' : 'text-muted-foreground')}>
                      {controlMismatch ? '⚠️ statement ' : '✓ statement '}
                      {amt(controlTotal, { decimal: 2, symbol: false })}
                    </span>
                  )}
                </span>
              </div>

              {/* dup banner */}
              {dupIds.size > 0 && (
                <div className='flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-300'>
                  <AlertCircle className='size-3.5 shrink-0' />
                  พบ {dupIds.size} รายการที่เคยนำเข้าบัญชีนี้แล้ว — ระบบกันไว้ไม่ให้ลงซ้ำ
                </div>
              )}

              {/* filter + ⚙️ */}
              <div className='flex items-center justify-between gap-2'>
                <label className='flex cursor-pointer items-center gap-2 text-xs'>
                  <Checkbox checked={showOnlyNeeded} onCheckedChange={(v) => setShowOnlyNeeded(!!v)} />
                  เฉพาะที่ต้องจับ (⬜ + 🟡)
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant='outline' size='sm' className='h-8 gap-1.5 text-xs'>
                      <Settings2 className='size-3.5' /> คอลัมน์
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end'>
                    <DropdownMenuLabel className='text-xs'>แสดงคอลัมน์</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {TOGGLE_COLS.map((c) => (
                      <DropdownMenuCheckboxItem
                        key={c.key}
                        checked={!hiddenCols.has(c.key)}
                        onCheckedChange={() => toggleCol(c.key)}
                        onSelect={(e) => e.preventDefault()}
                      >
                        {c.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* ตาราง (เลื่อนได้) */}
            <div className='min-h-0 flex-1 overflow-y-auto px-6 py-3'>
              <table className='w-full text-xs'>
                <thead className='sticky top-0 z-10 bg-background'>
                  <tr className='border-b text-left text-[10px] uppercase tracking-wide text-muted-foreground'>
                    <th className='w-8 p-2'>
                      <Checkbox checked={allSelected} onCheckedChange={(v) => selectAll(!!v)} aria-label='เลือกทั้งหมด' />
                    </th>
                    {showSource && <th className='p-2'>บัญชีต้นทาง</th>}
                    <th className='p-2'>วันที่</th>
                    {showTime && <th className='p-2'>เวลา</th>}
                    <th className='p-2 text-right'>ยอด</th>
                    {showPayer && <th className='p-2'>ผู้โอน</th>}
                    <th className='p-2'>จับคู่ผู้เช่า</th>
                  </tr>
                </thead>
                <tbody className='divide-y'>
                  {grouped.unmatched.length > 0 && (
                    <>
                      <tr className='bg-muted/30'>
                        <td colSpan={colCount} className='px-2 py-1 text-[11px] font-semibold text-muted-foreground'>
                          ⬜ ยังไม่จับ ({grouped.unmatched.length})
                        </td>
                      </tr>
                      {grouped.unmatched.map(renderRow)}
                    </>
                  )}
                  {grouped.review.length > 0 && (
                    <>
                      <tr className='bg-amber-50/60 dark:bg-amber-500/5'>
                        <td colSpan={colCount} className='px-2 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300'>
                          🟡 ต้องเช็ค ({grouped.review.length})
                        </td>
                      </tr>
                      {grouped.review.map(renderRow)}
                    </>
                  )}
                  {!showOnlyNeeded && grouped.matched.length > 0 && (
                    <>
                      <tr
                        className='cursor-pointer bg-emerald-50/60 hover:bg-emerald-100/60 dark:bg-emerald-500/5'
                        onClick={() => setCollapseGreen((v) => !v)}
                      >
                        <td colSpan={colCount} className='px-2 py-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300'>
                          <span className='flex items-center gap-1'>
                            {collapseGreen ? <ChevronRight className='size-3.5' /> : <ChevronDown className='size-3.5' />}
                            🟢 จับให้แล้ว ({grouped.matched.length}){collapseGreen ? ' · กดดู' : ''}
                          </span>
                        </td>
                      </tr>
                      {!collapseGreen && grouped.matched.map(renderRow)}
                    </>
                  )}
                  {!showOnlyNeeded && grouped.other.length > 0 && (
                    <>
                      <tr className='bg-muted/30'>
                        <td colSpan={colCount} className='px-2 py-1 text-[11px] font-semibold text-slate-500'>
                          ไม่ใช่ค่าเช่า ({grouped.other.length})
                        </td>
                      </tr>
                      {grouped.other.map(renderRow)}
                    </>
                  )}
                  {!showOnlyNeeded && grouped.dup.length > 0 && (
                    <>
                      <tr className='bg-muted/30'>
                        <td colSpan={colCount} className='px-2 py-1 text-[11px] font-semibold text-muted-foreground'>
                          ซ้ำ — กันไม่ให้ลงซ้ำ ({grouped.dup.length})
                        </td>
                      </tr>
                      {grouped.dup.map(renderRow)}
                    </>
                  )}
                </tbody>
              </table>
              {error && (
                <div className='mt-3 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive'>
                  <AlertCircle className='size-4 shrink-0' />
                  {error}
                </div>
              )}
            </div>
          </>
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
        <DialogFooter className={previewFull ? 'shrink-0 border-t bg-muted/20 px-6 py-3' : undefined}>
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
