/**
 * MeterGrid — หน้าจดมิเตอร์แบบตาราง (ห้องที่มีมิเตอร์ → กรอกเลขก่อน/รอบนี้ รวดเดียว)
 *
 * - เลือก "รอบเดือน" ที่จด → ค่าน้ำ/ไฟเดือนนั้นจะเข้าใบแจ้งหนี้ "เดือนถัดไป" (lag 1 · ตรง v1)
 * - แถว = ห้องที่ประกาศว่ามีมิเตอร์ (property.utilities) + ผู้เช่าปัจจุบัน
 * - คอลัมน์จัดกลุ่ม: 💧 น้ำ (ก่อน·รอบนี้·ยอด) แยกชัดจาก ⚡ ไฟ (ก่อน·รอบนี้·ยอด)
 * - เลขก่อน: ดึงจากครั้งล่าสุดอัตโนมัติ (ต่อเนื่องข้ามผู้เช่า · มิเตอร์เป็นของห้อง) ·
 *   ห้องที่ยังไม่เคยจด → กรอกเลขเริ่มเองได้ (มิเตอร์มีเลขเริ่มเสมอ)
 * - paste คอลัมน์จาก Excel ลงช่องได้ · กดบันทึก → เข้าใบแจ้งหนี้รอบถัดไปอัตโนมัติ
 */
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { amt } from '@/lib/thai'
import { cn } from '@/lib/utils'
import {
  getPropertyAddressShort,
  getPropertyName,
  useProperties,
} from '@/features/properties/queries'
import { useContractMatchKeys } from '@/lib/queries/contract-match'
import { daysUntil } from '@/lib/contracts/stats'
import { formatMonth } from '@/features/invoices/queries'
import { getPropertyUtilities, type UtilityKind } from '@/features/meters/utility-badge'
import { useMeterReadings } from '@/features/meters/queries'
import { useBulkCreateMeterReadings } from '@/features/meters/mutations'
import type { MeterReadingData, MeterType } from '@/features/meters/types'

const KIND_TO_TYPE: Record<UtilityKind, MeterType> = {
  water: 'water',
  electricity: 'electricity',
}

/* ---------- date/month helpers (month = "YYYY-MM" ค.ศ.) ---------- */
function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function addMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
/** วันสุดท้ายของเดือน → "DD/MM/YYYY" พ.ศ. */
function monthEndDateBE(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return `${String(lastDay).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y + 543}`
}
function genMonths(): string[] {
  const now = new Date()
  const out: string[] = []
  for (let i = 1; i >= -12; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

function toNum(s: string | undefined): number | null {
  if (s == null || s.trim() === '') return null
  const n = Number(s)
  return Number.isNaN(n) ? null : n
}

type RoomRow = {
  propertyId: string
  name: string
  building: string
  tenant: string | null
  contractId: string | null
  water: boolean
  electricity: boolean
  waterRate: number
  electricityRate: number
  prevWater: number | null // null = ยังไม่เคยจด (ให้กรอกเอง)
  prevElec: number | null
}

type Cell = { prev: string; curr: string }
type Draft = Record<string, { water: Cell; electricity: Cell }>

const EMPTY_CELL: Cell = { prev: '', curr: '' }

export function MeterGrid() {
  const { data: properties, isLoading } = useProperties()
  const { data: contractKeys } = useContractMatchKeys()
  const { data: readings } = useMeterReadings()
  const bulkCreate = useBulkCreateMeterReadings()

  const months = useMemo(() => genMonths(), [])
  const [month, setMonth] = useState(currentMonth())
  const [draft, setDraft] = useState<Draft>({})

  const billMonth = addMonth(month, 1)
  const readingDate = monthEndDateBE(month)

  // เลขล่าสุดต่อ ห้อง+ประเภท (readings เรียง date desc → ตัวแรกที่เจอ = ล่าสุด)
  const prevByKey = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of readings ?? []) {
      const key = `${r.data?.property_id}|${r.data?.type}`
      if (!m.has(key)) m.set(key, r.data?.curr_reading ?? 0)
    }
    return m
  }, [readings])

  const activeByPid = useMemo(() => {
    const m = new Map<number, { id: string; tenant: string | null }>()
    for (const c of contractKeys ?? []) {
      if (c.data?.cancelled || c.data?.closed) continue
      const pid = c.data?.pid_property ?? c.data?.pid
      if (pid == null) continue
      const days = daysUntil(c.data?.end ?? null)
      const expired = days != null && days < 0
      const existing = m.get(Number(pid))
      if (!existing || !expired) {
        m.set(Number(pid), { id: c.id, tenant: c.data?.tenant ?? null })
      }
    }
    return m
  }, [contractKeys])

  const rooms = useMemo<RoomRow[]>(() => {
    if (!properties) return []
    return properties
      .map((p): RoomRow | null => {
        const u = getPropertyUtilities(p.data)
        if (!u.water && !u.electricity) return null
        const pid = p.data?.pid ?? Number.parseInt(p.id, 10)
        const active = pid != null ? activeByPid.get(Number(pid)) : undefined
        const short = getPropertyAddressShort(p.data)
        return {
          propertyId: p.id,
          name: getPropertyName(p.data),
          building: short === '—' ? '' : short,
          tenant: active?.tenant ?? null,
          contractId: active?.id ?? null,
          water: u.water,
          electricity: u.electricity,
          waterRate: u.waterRate,
          electricityRate: u.electricityRate,
          prevWater: prevByKey.has(`${p.id}|water`) ? prevByKey.get(`${p.id}|water`)! : null,
          prevElec: prevByKey.has(`${p.id}|electricity`) ? prevByKey.get(`${p.id}|electricity`)! : null,
        }
      })
      .filter((r): r is RoomRow => r !== null)
      .sort((a, b) => a.name.localeCompare(b.name, 'th'))
  }, [properties, activeByPid, prevByKey])

  const anyWater = rooms.some((r) => r.water)
  const anyElec = rooms.some((r) => r.electricity)

  function cellOf(propertyId: string, kind: UtilityKind): Cell {
    return draft[propertyId]?.[kind] ?? EMPTY_CELL
  }
  function setField(
    propertyId: string,
    kind: UtilityKind,
    field: 'prev' | 'curr',
    value: string,
  ) {
    setDraft((prev) => {
      const room = prev[propertyId] ?? { water: { ...EMPTY_CELL }, electricity: { ...EMPTY_CELL } }
      return {
        ...prev,
        [propertyId]: {
          ...room,
          [kind]: { ...room[kind], [field]: value },
        },
      }
    })
  }

  /** วางจาก Excel — เติมลงคอลัมน์เดียวกัน (kind+field) แถวถัดๆ ไป */
  function onPaste(
    e: React.ClipboardEvent<HTMLInputElement>,
    rowIndex: number,
    kind: UtilityKind,
    field: 'prev' | 'curr',
  ) {
    const text = e.clipboardData.getData('text')
    if (!/[\t\n\r]/.test(text)) return
    e.preventDefault()
    const values = text
      .split(/\r\n|\r|\n/)
      .map((l) => l.split('\t')[0].replace(/,/g, '').trim())
    setDraft((prev) => {
      const next = { ...prev }
      let r = rowIndex
      for (const v of values) {
        if (r >= rooms.length) break
        const room = rooms[r]
        const has = kind === 'water' ? room.water : room.electricity
        if (has && v !== '' && !Number.isNaN(Number(v))) {
          const cur = next[room.propertyId] ?? {
            water: { ...EMPTY_CELL },
            electricity: { ...EMPTY_CELL },
          }
          next[room.propertyId] = {
            ...cur,
            [kind]: { ...cur[kind], [field]: v },
          }
        }
        r++
      }
      return next
    })
  }

  /** หาเลขก่อน (auto จากประวัติ หรือจากที่กรอกเอง) ของห้อง+ประเภท */
  function resolvePrev(room: RoomRow, kind: UtilityKind): number | null {
    const auto = kind === 'water' ? room.prevWater : room.prevElec
    if (auto != null) return auto
    return toNum(cellOf(room.propertyId, kind).prev)
  }

  const pending = useMemo(() => {
    const items: MeterReadingData[] = []
    for (const room of rooms) {
      for (const kind of ['water', 'electricity'] as UtilityKind[]) {
        const has = kind === 'water' ? room.water : room.electricity
        if (!has) continue
        const curr = toNum(cellOf(room.propertyId, kind).curr)
        if (curr == null) continue
        const prev = resolvePrev(room, kind)
        if (prev == null || curr < prev) continue
        const rate = kind === 'water' ? room.waterRate : room.electricityRate
        const units = curr - prev
        items.push({
          property_id: room.propertyId,
          property_name: room.name,
          contract_id: room.contractId ?? undefined,
          type: KIND_TO_TYPE[kind],
          reading_date: readingDate,
          prev_reading: prev,
          curr_reading: curr,
          units,
          rate_per_unit: rate,
          fixed_fee: 0,
          total: units * rate,
          billed: false,
        })
      }
    }
    return items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, draft, readingDate])

  async function handleSave() {
    if (pending.length === 0) return
    try {
      const res = await bulkCreate.mutateAsync(pending)
      toast.success(`บันทึกมิเตอร์ ${res.count} รายการแล้ว`, {
        description: `ค่าน้ำ/ไฟเดือน ${formatMonth(month)} จะเข้าใบแจ้งหนี้เดือน ${formatMonth(billMonth)}`,
      })
      setDraft({})
    } catch (err) {
      toast.error('บันทึกไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  if (isLoading) {
    return <p className='text-sm text-muted-foreground'>กำลังโหลด...</p>
  }
  if (rooms.length === 0) {
    return (
      <div className='rounded-md border bg-muted/30 p-10 text-center text-sm text-muted-foreground'>
        ยังไม่มีห้องที่ตั้งค่ามิเตอร์ — ไปที่หน้าทรัพย์สิน ติ๊ก "มีมิเตอร์น้ำ/ไฟ" + ใส่เรตก่อน
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      {/* แถบรอบเดือน + บันทึก */}
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div className='space-y-1'>
          <label className='text-xs text-muted-foreground'>จดมิเตอร์รอบเดือน</label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className='h-9 w-[160px]'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {formatMonth(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleSave} disabled={pending.length === 0 || bulkCreate.isPending}>
          {bulkCreate.isPending ? (
            <Loader2 className='size-4 animate-spin' />
          ) : (
            <Save className='size-4' />
          )}
          บันทึก {pending.length > 0 ? `(${pending.length})` : ''}
        </Button>
      </div>

      {/* โน้ตอธิบาย lag + paste */}
      <div className='rounded-md border border-sky-500/30 bg-sky-500/5 px-4 py-2.5 text-sm'>
        📌 กรอก <b>เลขมิเตอร์สิ้นเดือน {formatMonth(month)}</b> · ค่าน้ำ/ไฟเดือน{' '}
        {formatMonth(month)} จะไปอยู่ใน <b>ใบแจ้งหนี้เดือน {formatMonth(billMonth)}</b> (เก็บถัดไป 1 เดือน)
        <br />
        <span className='text-xs text-muted-foreground'>
          💡 copy คอลัมน์เลขมิเตอร์จาก Excel แล้ว paste ในช่อง "รอบนี้" ได้เลย · ห้องที่ยังไม่เคยจด ให้กรอก "เลขก่อน" (เลขเริ่ม) ด้วย
        </span>
      </div>

      <div className='overflow-x-auto rounded-md border bg-card'>
        <Table className='min-w-[820px]'>
          <TableHeader>
            <TableRow className='hover:bg-transparent'>
              <TableHead rowSpan={2} className='align-bottom'>
                ห้อง / ผู้เช่า
              </TableHead>
              {anyWater && (
                <TableHead
                  colSpan={3}
                  className='border-l-2 border-l-sky-500/40 bg-sky-500/10 text-center font-semibold text-sky-700 dark:text-sky-300'
                >
                  💧 ค่าน้ำ
                </TableHead>
              )}
              {anyElec && (
                <TableHead
                  colSpan={3}
                  className='border-l-2 border-l-amber-500/40 bg-amber-500/10 text-center font-semibold text-amber-700 dark:text-amber-300'
                >
                  ⚡ ค่าไฟ
                </TableHead>
              )}
            </TableRow>
            <TableRow className='hover:bg-transparent'>
              {anyWater && (
                <>
                  <TableHead className='border-l-2 border-l-sky-500/40 text-right text-xs'>เลขก่อน</TableHead>
                  <TableHead className='text-xs'>รอบนี้ (สิ้นเดือน)</TableHead>
                  <TableHead className='text-right text-xs'>ยอด</TableHead>
                </>
              )}
              {anyElec && (
                <>
                  <TableHead className='border-l-2 border-l-amber-500/40 text-right text-xs'>เลขก่อน</TableHead>
                  <TableHead className='text-xs'>รอบนี้ (สิ้นเดือน)</TableHead>
                  <TableHead className='text-right text-xs'>ยอด</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms.map((room, i) => (
              <TableRow key={room.propertyId}>
                <TableCell className='py-2'>
                  <span className='block truncate text-sm font-medium'>{room.name}</span>
                  <span className='block truncate text-xs text-muted-foreground'>
                    {room.building && `${room.building} · `}
                    {room.tenant ?? 'ว่าง'}
                  </span>
                </TableCell>

                {anyWater && (
                  <UtilityCells
                    has={room.water}
                    rate={room.waterRate}
                    autoPrev={room.prevWater}
                    cell={cellOf(room.propertyId, 'water')}
                    accent='sky'
                    onPrev={(v) => setField(room.propertyId, 'water', 'prev', v)}
                    onCurr={(v) => setField(room.propertyId, 'water', 'curr', v)}
                    onPastePrev={(e) => onPaste(e, i, 'water', 'prev')}
                    onPasteCurr={(e) => onPaste(e, i, 'water', 'curr')}
                  />
                )}
                {anyElec && (
                  <UtilityCells
                    has={room.electricity}
                    rate={room.electricityRate}
                    autoPrev={room.prevElec}
                    cell={cellOf(room.propertyId, 'electricity')}
                    accent='amber'
                    onPrev={(v) => setField(room.propertyId, 'electricity', 'prev', v)}
                    onCurr={(v) => setField(room.propertyId, 'electricity', 'curr', v)}
                    onPastePrev={(e) => onPaste(e, i, 'electricity', 'prev')}
                    onPasteCurr={(e) => onPaste(e, i, 'electricity', 'curr')}
                  />
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

/** 3 ช่องของ utility 1 ประเภท (ก่อน · รอบนี้ · ยอด) */
function UtilityCells({
  has,
  rate,
  autoPrev,
  cell,
  accent,
  onPrev,
  onCurr,
  onPastePrev,
  onPasteCurr,
}: {
  has: boolean
  rate: number
  autoPrev: number | null
  cell: Cell
  accent: 'sky' | 'amber'
  onPrev: (v: string) => void
  onCurr: (v: string) => void
  onPastePrev: (e: React.ClipboardEvent<HTMLInputElement>) => void
  onPasteCurr: (e: React.ClipboardEvent<HTMLInputElement>) => void
}) {
  const border = accent === 'sky' ? 'border-l-sky-500/40' : 'border-l-amber-500/40'
  if (!has) {
    return (
      <TableCell colSpan={3} className={cn('border-l-2 text-center text-xs text-muted-foreground', border)}>
        —
      </TableCell>
    )
  }
  const prev = autoPrev != null ? autoPrev : toNum(cell.prev)
  const curr = toNum(cell.curr)
  const units = prev != null && curr != null ? curr - prev : null
  const invalid = units != null && units < 0
  return (
    <>
      {/* เลขก่อน */}
      <TableCell className={cn('border-l-2 py-1 text-right', border)}>
        {autoPrev != null ? (
          <span className='text-sm tabular-nums text-muted-foreground'>
            {autoPrev.toLocaleString('th-TH')}
          </span>
        ) : (
          <Input
            value={cell.prev}
            onChange={(e) => onPrev(e.target.value)}
            onPaste={onPastePrev}
            inputMode='decimal'
            placeholder='เลขเริ่ม'
            className='h-8 w-24 text-right tabular-nums'
          />
        )}
      </TableCell>
      {/* รอบนี้ */}
      <TableCell className='py-1'>
        <Input
          value={cell.curr}
          onChange={(e) => onCurr(e.target.value)}
          onPaste={onPasteCurr}
          inputMode='decimal'
          placeholder='—'
          className={cn(
            'h-8 w-24 text-right tabular-nums',
            invalid && 'border-destructive text-destructive',
          )}
        />
      </TableCell>
      {/* ยอด */}
      <TableCell className='text-right text-sm tabular-nums'>
        {units != null && units >= 0
          ? amt(units * rate, { symbol: false, decimal: 0 })
          : '—'}
      </TableCell>
    </>
  )
}
