/**
 * MeterGrid — สมุดเลขมิเตอร์รายเดือน (จด/แก้ย้อนได้ · คิดหน่วยจากส่วนต่าง 2 เดือนติดกัน)
 *
 * โมเดล: มิเตอร์แต่ละห้อง = เลขสิ้นเดือนต่อเนื่องกัน
 * - เลือก "รอบเดือน X" → ช่องขวา = เลขสิ้นเดือน X (โหลดของที่จดไว้มาแก้ได้) ·
 *   ช่องซ้าย = เลขเดือนก่อนหน้าล่าสุด (auto จาก chain · กรอกเองได้ถ้ายังไม่เคยมี)
 * - หน่วยเดือน X = เลข X − เลขก่อนหน้า · เข้าใบแจ้งหนี้เดือน X+1 (lag 1 · ตรง v1)
 * - ย้อนเดือน → เลขทั้งตารางเปลี่ยนตามเดือนนั้น
 * - แก้เลข → เดือนถัดๆ ที่ยังไม่ออกบิลคำนวณใหม่ตาม chain · แก้เดือนที่ออกบิลแล้ว = เตือนก่อน (บิลเก่าไม่เปลี่ยน)
 * - paste คอลัมน์จาก Excel ได้ · กดบันทึก → เข้าใบแจ้งหนี้รอบถัดไปอัตโนมัติ (กลไกเดิม)
 */
import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
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
import { useConfirm } from '@/hooks/use-confirm'
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
import { useUpsertMeterReadings } from '@/features/meters/mutations'
import type { MeterReadingData, MeterType } from '@/features/meters/types'

const KIND_TO_TYPE: Record<UtilityKind, MeterType> = {
  water: 'water',
  electricity: 'electricity',
}
const KINDS: UtilityKind[] = ['water', 'electricity']

/* ---------- month helpers (month = "YYYY-MM" ค.ศ.) ---------- */
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
/** "DD/MM/YYYY" พ.ศ. → "YYYY-MM" ค.ศ. */
function readingMonthCE(date: string | undefined): string | null {
  const m = date?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  return `${Number(m[3]) - 543}-${m[2]}`
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

/** การอ่าน 1 ครั้งของ ห้อง+ประเภท (ย่อ) */
type ReadingLite = {
  id: string
  month: string // YYYY-MM
  curr: number
  billed: boolean
}
/** ข้อมูล utility 1 ประเภทของห้อง ณ เดือนที่เลือก */
type KindInfo = {
  rate: number
  autoPrev: number | null // เลขก่อนจาก chain (null = ยังไม่เคยมี → กรอกเอง)
  autoPrevMonth: string | null
  existing: ReadingLite | null // การอ่านของเดือนที่เลือก (ถ้ามี)
}
type RoomRow = {
  propertyId: string
  name: string
  building: string
  tenant: string | null
  contractId: string | null
  water: KindInfo | null
  electricity: KindInfo | null
}

const keyOf = (propertyId: string, kind: UtilityKind) => `${propertyId}|${kind}`

export function MeterGrid() {
  const { data: properties, isLoading } = useProperties()
  const { data: contractKeys } = useContractMatchKeys()
  const { data: readings } = useMeterReadings()
  const upsert = useUpsertMeterReadings()
  const confirm = useConfirm()

  const months = useMemo(() => genMonths(), [])
  const [month, setMonth] = useState(currentMonth())
  // draft: key `${month}|${propertyId}|${kind}` → { prev (กรอกเองตอนไม่มี chain), curr }
  // ใส่เดือนใน key → เปลี่ยนเดือน = โหลดเลขเดือนนั้นมาแสดง (ไม่ปนกัน · ไม่ต้องเคลียร์)
  const [draft, setDraft] = useState<Record<string, { prev: string; curr: string }>>({})
  const dKey = (propertyId: string, kind: UtilityKind) => `${month}|${propertyId}|${kind}`

  const billMonth = addMonth(month, 1)
  const readingDate = monthEndDateBE(month)

  // ทุกการอ่าน จัดกลุ่มตาม ห้อง+ประเภท · เรียงเดือน asc
  const readingsByKey = useMemo(() => {
    const m = new Map<string, ReadingLite[]>()
    for (const r of readings ?? []) {
      const mon = readingMonthCE(r.data?.reading_date)
      if (!mon) continue
      const key = `${r.data?.property_id}|${r.data?.type}`
      const arr = m.get(key) ?? []
      arr.push({
        id: r.id,
        month: mon,
        curr: r.data?.curr_reading ?? 0,
        billed: r.data?.billed === true,
      })
      m.set(key, arr)
    }
    for (const arr of m.values()) arr.sort((a, b) => a.month.localeCompare(b.month))
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
    const buildKind = (propertyId: string, kind: UtilityKind, rate: number): KindInfo => {
      const list = readingsByKey.get(`${propertyId}|${kind}`) ?? []
      const existing = list.find((r) => r.month === month) ?? null
      // เลขก่อน = การอ่านล่าสุดที่เดือน < เดือนที่เลือก
      let prev: ReadingLite | null = null
      for (const r of list) {
        if (r.month < month) prev = r
        else break
      }
      return {
        rate,
        autoPrev: prev?.curr ?? null,
        autoPrevMonth: prev?.month ?? null,
        existing,
      }
    }
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
          water: u.water ? buildKind(p.id, 'water', u.waterRate) : null,
          electricity: u.electricity ? buildKind(p.id, 'electricity', u.electricityRate) : null,
        }
      })
      .filter((r): r is RoomRow => r !== null)
      .sort((a, b) => a.name.localeCompare(b.name, 'th'))
  }, [properties, activeByPid, readingsByKey, month])

  const anyWater = rooms.some((r) => r.water)
  const anyElec = rooms.some((r) => r.electricity)

  /** ค่าที่แสดงในช่อง curr (draft ถ้าแก้ · ไม่งั้นของเดิมที่จดไว้) */
  function currStr(room: RoomRow, kind: UtilityKind): string {
    const k = dKey(room.propertyId, kind)
    if (draft[k]?.curr != null && draft[k].curr !== '') return draft[k].curr
    if (draft[k]?.curr === '') return ''
    const info = kind === 'water' ? room.water : room.electricity
    return info?.existing != null ? String(info.existing.curr) : ''
  }
  function prevStr(room: RoomRow, kind: UtilityKind): string {
    return draft[dKey(room.propertyId, kind)]?.prev ?? ''
  }
  function resolvePrev(room: RoomRow, kind: UtilityKind): number | null {
    const info = kind === 'water' ? room.water : room.electricity
    if (info?.autoPrev != null) return info.autoPrev
    return toNum(prevStr(room, kind))
  }
  function setField(propertyId: string, kind: UtilityKind, field: 'prev' | 'curr', value: string) {
    setDraft((prev) => {
      const k = dKey(propertyId, kind)
      return { ...prev, [k]: { prev: prev[k]?.prev ?? '', curr: prev[k]?.curr ?? '', [field]: value } }
    })
  }

  function onPaste(
    e: React.ClipboardEvent<HTMLInputElement>,
    rowIndex: number,
    kind: UtilityKind,
    field: 'prev' | 'curr',
  ) {
    const text = e.clipboardData.getData('text')
    if (!/[\t\n\r]/.test(text)) return
    e.preventDefault()
    const values = text.split(/\r\n|\r|\n/).map((l) => l.split('\t')[0].replace(/,/g, '').trim())
    setDraft((prev) => {
      const next = { ...prev }
      let r = rowIndex
      for (const v of values) {
        if (r >= rooms.length) break
        const room = rooms[r]
        const has = kind === 'water' ? room.water : room.electricity
        if (has && v !== '' && !Number.isNaN(Number(v))) {
          const k = dKey(room.propertyId, kind)
          next[k] = { prev: next[k]?.prev ?? '', curr: next[k]?.curr ?? '', [field]: v }
        }
        r++
      }
      return next
    })
  }

  /** รายการที่จะบันทึก (เดือนที่เลือก) + เช็คว่ามีการแก้เดือนที่ออกบิลแล้วไหม */
  const { items, editsBilled } = useMemo(() => {
    const out: Array<{ id?: string; data: MeterReadingData; key: string; newCurr: number }> = []
    let touchesBilled = false
    for (const room of rooms) {
      for (const kind of KINDS) {
        const info = kind === 'water' ? room.water : room.electricity
        if (!info) continue
        const curr = toNum(currStr(room, kind))
        if (curr == null) continue
        // ข้ามถ้าไม่เปลี่ยนจากของเดิม
        if (info.existing && info.existing.curr === curr) continue
        const prev = resolvePrev(room, kind)
        if (prev == null || curr < prev) continue
        const units = curr - prev
        if (info.existing?.billed) touchesBilled = true
        out.push({
          id: info.existing?.id,
          key: keyOf(room.propertyId, kind),
          newCurr: curr,
          data: {
            property_id: room.propertyId,
            property_name: room.name,
            contract_id: room.contractId ?? undefined,
            type: KIND_TO_TYPE[kind],
            reading_date: readingDate,
            prev_reading: prev,
            curr_reading: curr,
            units,
            rate_per_unit: info.rate,
            fixed_fee: 0,
            total: units * info.rate,
            billed: info.existing?.billed ?? false,
            // คงค่าเดิมถ้าเคย bill แล้ว
          },
        })
      }
    }
    return { items: out, editsBilled: touchesBilled }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, draft, readingDate])

  /** cascade: เดือนถัดๆ ที่ยังไม่ออกบิล คำนวณ prev/units/total ใหม่ตาม chain */
  function buildCascade(): Array<{ id: string; data: MeterReadingData }> {
    const updates: Array<{ id: string; data: MeterReadingData }> = []
    for (const it of items) {
      const [propertyId, kind] = it.key.split('|') as [string, UtilityKind]
      const list = readingsByKey.get(it.key) ?? []
      const room = rooms.find((r) => r.propertyId === propertyId)
      const info = room ? (kind === 'water' ? room.water : room.electricity) : null
      if (!info) continue
      let prevVal = it.newCurr // curr ของเดือนที่เพิ่งบันทึก = prev ของเดือนถัดไป
      for (const r of list) {
        if (r.month <= month) continue
        if (r.billed) {
          // บิลแล้ว — ไม่แก้ยอด แต่ใช้ค่าเป็น link ของ chain ต่อ
          prevVal = r.curr
          continue
        }
        const units = Math.max(0, r.curr - prevVal)
        const orig = (readings ?? []).find((x) => x.id === r.id)
        if (orig) {
          updates.push({
            id: r.id,
            data: {
              ...orig.data,
              prev_reading: prevVal,
              units,
              total: units * info.rate + (orig.data.fixed_fee ?? 0),
            },
          })
        }
        prevVal = r.curr
      }
    }
    return updates
  }

  async function handleSave() {
    if (items.length === 0) return
    if (editsBilled) {
      const ok = await confirm({
        title: 'เดือนนี้ออกใบแจ้งหนี้ไปแล้ว',
        description:
          'การแก้เลขมิเตอร์จะไม่เปลี่ยนใบแจ้งหนี้ที่ออกไปแล้ว (บิลเก่าคงเดิม) แต่จะกระทบการคำนวณเดือนถัดไป · ยืนยันแก้?',
        confirmLabel: 'ยืนยันแก้',
      })
      if (!ok) return
    }
    const payload = [
      ...items.map((it) => ({ id: it.id, data: it.data })),
      ...buildCascade(),
    ]
    try {
      const res = await upsert.mutateAsync(payload)
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

  if (isLoading) return <p className='text-sm text-muted-foreground'>กำลังโหลด...</p>
  if (rooms.length === 0) {
    return (
      <div className='rounded-md border bg-muted/30 p-10 text-center text-sm text-muted-foreground'>
        ยังไม่มีห้องที่ตั้งค่ามิเตอร์ — ไปที่หน้าทรัพย์สิน ติ๊ก "มีมิเตอร์น้ำ/ไฟ" + ใส่เรตก่อน
      </div>
    )
  }

  return (
    <div className='space-y-4'>
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
        <Button onClick={handleSave} disabled={items.length === 0 || upsert.isPending}>
          {upsert.isPending ? <Loader2 className='size-4 animate-spin' /> : <Save className='size-4' />}
          บันทึก {items.length > 0 ? `(${items.length})` : ''}
        </Button>
      </div>

      <div className='rounded-md border border-sky-500/30 bg-sky-500/5 px-4 py-2.5 text-sm'>
        📌 กรอก <b>เลขมิเตอร์สิ้นเดือน {formatMonth(month)}</b> · ค่าน้ำ/ไฟเดือน {formatMonth(month)} จะไปอยู่ใน{' '}
        <b>ใบแจ้งหนี้เดือน {formatMonth(billMonth)}</b> (เก็บถัดไป 1 เดือน)
        <br />
        <span className='text-xs text-muted-foreground'>
          💡 ย้อนเดือนเพื่อดู/แก้เลขเดิมได้ · copy คอลัมน์จาก Excel มา paste ในช่อง "รอบนี้" ได้ · ห้องที่ยังไม่เคยจด ให้กรอก "เลขก่อน" ด้วย
        </span>
      </div>

      <div className='overflow-x-auto rounded-md border bg-card'>
        <Table className='min-w-[820px]'>
          <TableHeader>
            <TableRow className='hover:bg-transparent'>
              <TableHead rowSpan={2} className='align-bottom'>ห้อง / ผู้เช่า</TableHead>
              {anyWater && (
                <TableHead colSpan={3} className='border-l-2 border-l-sky-500/40 bg-sky-500/10 text-center font-semibold text-sky-700 dark:text-sky-300'>
                  💧 ค่าน้ำ
                </TableHead>
              )}
              {anyElec && (
                <TableHead colSpan={3} className='border-l-2 border-l-amber-500/40 bg-amber-500/10 text-center font-semibold text-amber-700 dark:text-amber-300'>
                  ⚡ ค่าไฟ
                </TableHead>
              )}
            </TableRow>
            <TableRow className='hover:bg-transparent text-xs'>
              {anyWater && (
                <>
                  <TableHead className='border-l-2 border-l-sky-500/40 text-right'>เลขก่อน</TableHead>
                  <TableHead>รอบนี้ (สิ้น {formatMonth(month)})</TableHead>
                  <TableHead className='text-right'>ยอด</TableHead>
                </>
              )}
              {anyElec && (
                <>
                  <TableHead className='border-l-2 border-l-amber-500/40 text-right'>เลขก่อน</TableHead>
                  <TableHead>รอบนี้ (สิ้น {formatMonth(month)})</TableHead>
                  <TableHead className='text-right'>ยอด</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms.map((room, i) => (
              <TableRow key={room.propertyId}>
                <TableCell className='py-2'>
                  {room.contractId ? (
                    <Link
                      to='/contracts/$id'
                      params={{ id: room.contractId }}
                      className='block truncate text-sm font-medium text-primary hover:underline'
                      title={`เปิดสัญญา · ${room.name}`}
                    >
                      {room.name}
                    </Link>
                  ) : (
                    <Link
                      to='/properties/$id'
                      params={{ id: room.propertyId }}
                      className='block truncate text-sm font-medium hover:underline'
                      title={`เปิดทรัพย์สิน · ${room.name}`}
                    >
                      {room.name}
                    </Link>
                  )}
                  <span className='block truncate text-xs text-muted-foreground'>
                    {room.building && `${room.building} · `}
                    {room.tenant ?? 'ว่าง'}
                  </span>
                </TableCell>
                {anyWater && (
                  <UtilityCells
                    info={room.water}
                    accent='sky'
                    currValue={currStr(room, 'water')}
                    prevInput={prevStr(room, 'water')}
                    billedExisting={room.water?.existing?.billed ?? false}
                    onPrev={(v) => setField(room.propertyId, 'water', 'prev', v)}
                    onCurr={(v) => setField(room.propertyId, 'water', 'curr', v)}
                    onPastePrev={(e) => onPaste(e, i, 'water', 'prev')}
                    onPasteCurr={(e) => onPaste(e, i, 'water', 'curr')}
                  />
                )}
                {anyElec && (
                  <UtilityCells
                    info={room.electricity}
                    accent='amber'
                    currValue={currStr(room, 'electricity')}
                    prevInput={prevStr(room, 'electricity')}
                    billedExisting={room.electricity?.existing?.billed ?? false}
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

function UtilityCells({
  info,
  accent,
  currValue,
  prevInput,
  billedExisting,
  onPrev,
  onCurr,
  onPastePrev,
  onPasteCurr,
}: {
  info: KindInfo | null
  accent: 'sky' | 'amber'
  currValue: string
  prevInput: string
  billedExisting: boolean
  onPrev: (v: string) => void
  onCurr: (v: string) => void
  onPastePrev: (e: React.ClipboardEvent<HTMLInputElement>) => void
  onPasteCurr: (e: React.ClipboardEvent<HTMLInputElement>) => void
}) {
  const border = accent === 'sky' ? 'border-l-sky-500/40' : 'border-l-amber-500/40'
  if (!info) {
    return (
      <TableCell colSpan={3} className={cn('border-l-2 text-center text-xs text-muted-foreground', border)}>
        —
      </TableCell>
    )
  }
  const prev = info.autoPrev != null ? info.autoPrev : toNum(prevInput)
  const curr = toNum(currValue)
  const units = prev != null && curr != null ? curr - prev : null
  const invalid = units != null && units < 0
  return (
    <>
      <TableCell className={cn('border-l-2 py-1 text-right', border)}>
        {info.autoPrev != null ? (
          <div>
            <span className='block text-sm tabular-nums text-muted-foreground'>
              {info.autoPrev.toLocaleString('th-TH')}
            </span>
            {info.autoPrevMonth && (
              <span className='block text-[10px] text-muted-foreground'>
                สิ้น {formatMonth(info.autoPrevMonth)}
              </span>
            )}
          </div>
        ) : (
          <Input
            value={prevInput}
            onChange={(e) => onPrev(e.target.value)}
            onPaste={onPastePrev}
            inputMode='decimal'
            placeholder='เลขเริ่ม'
            className='h-8 w-24 text-right tabular-nums'
          />
        )}
      </TableCell>
      <TableCell className='py-1'>
        <Input
          value={currValue}
          onChange={(e) => onCurr(e.target.value)}
          onPaste={onPasteCurr}
          inputMode='decimal'
          placeholder='—'
          className={cn(
            'h-8 w-24 text-right tabular-nums',
            invalid && 'border-destructive text-destructive',
            billedExisting && 'border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/20',
          )}
          title={billedExisting ? 'เดือนนี้ออกบิลแล้ว — แก้ได้แต่บิลเก่าไม่เปลี่ยน' : undefined}
        />
      </TableCell>
      <TableCell className='text-right text-sm tabular-nums'>
        {units != null && units >= 0 ? amt(units * info.rate, { symbol: false, decimal: 0 }) : '—'}
      </TableCell>
    </>
  )
}
