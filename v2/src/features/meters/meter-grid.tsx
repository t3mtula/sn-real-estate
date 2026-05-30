/**
 * MeterGrid — หน้าจดมิเตอร์แบบตาราง (ห้องที่มีมิเตอร์ → กรอกเลขก่อน/หลัง รวดเดียว)
 *
 * ต่างจากหน้า "ประวัติการอ่าน" (ตารางการอ่านที่จดไปแล้ว) — อันนี้คือ "ห้องที่ต้องจด":
 * - แถว = ห้องที่ประกาศว่ามีมิเตอร์ (property.utilities) + ผู้เช่าปัจจุบัน
 * - ช่อง: เลขก่อน (อัตโนมัติจากครั้งล่าสุด) · เลขปัจจุบัน (กรอก) · ยอด = (หลัง−ก่อน)×เรต
 * - paste ทั้งคอลัมน์จาก Excel ได้ (วางในช่องปัจจุบัน → เติมลงแถวถัดๆ ไป)
 * - กดบันทึก → สร้างการอ่านทีเดียวหลายห้อง → เข้าใบแจ้งหนี้รอบถัดไปอัตโนมัติ (กลไกเดิม)
 */
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { getPropertyUtilities, type UtilityKind } from '@/features/meters/utility-badge'
import { useMeterReadings } from '@/features/meters/queries'
import { useBulkCreateMeterReadings } from '@/features/meters/mutations'
import type { MeterReadingData, MeterType } from '@/features/meters/types'

/** วันนี้รูปแบบ DD/MM/YYYY (พ.ศ.) */
function todayBE(): string {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear() + 543}`
}

type RoomRow = {
  propertyId: string
  pid: number | null
  name: string
  building: string
  tenant: string | null
  contractId: string | null
  water: boolean
  electricity: boolean
  waterRate: number
  electricityRate: number
  prevWater: number
  prevElec: number
  /** เคยมีเลขจดมาก่อนไหม — ถ้าไม่เคย ครั้งแรก = ตั้งต้น (ไม่คิดเงิน) */
  hasPrevWater: boolean
  hasPrevElec: boolean
}

type Draft = Record<string, { water: string; electricity: string }>

const META: Record<UtilityKind, MeterType> = {
  water: 'water',
  electricity: 'electricity',
}

export function MeterGrid() {
  const { data: properties, isLoading } = useProperties()
  const { data: contractKeys } = useContractMatchKeys()
  const { data: readings } = useMeterReadings()
  const bulkCreate = useBulkCreateMeterReadings()

  const [readingDate, setReadingDate] = useState(todayBE())
  const [draft, setDraft] = useState<Draft>({})

  // เลขก่อนหน้า (ล่าสุด) ต่อ ห้อง+ประเภท — readings เรียง date desc แล้ว เอาตัวแรกที่เจอ
  const prevByKey = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of readings ?? []) {
      const key = `${r.data?.property_id}|${r.data?.type}`
      if (!m.has(key)) m.set(key, r.data?.curr_reading ?? 0)
    }
    return m
  }, [readings])

  // สัญญาที่ใช้งานอยู่ (ไม่ยกเลิก/ปิด · ยังไม่หมดอายุ) ต่อ pid
  const activeByPid = useMemo(() => {
    const m = new Map<number, { id: string; tenant: string | null }>()
    for (const c of contractKeys ?? []) {
      if (c.data?.cancelled || c.data?.closed) continue
      const pid = c.data?.pid_property ?? c.data?.pid
      if (pid == null) continue
      const days = daysUntil(c.data?.end ?? null)
      const expired = days != null && days < 0
      const existing = m.get(Number(pid))
      // prefer non-expired; keep first otherwise
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
        return {
          propertyId: p.id,
          pid: pid ?? null,
          name: getPropertyName(p.data),
          building: getPropertyAddressShort(p.data) === '—' ? '' : getPropertyAddressShort(p.data),
          tenant: active?.tenant ?? null,
          contractId: active?.id ?? null,
          water: u.water,
          electricity: u.electricity,
          waterRate: u.waterRate,
          electricityRate: u.electricityRate,
          prevWater: prevByKey.get(`${p.id}|water`) ?? 0,
          prevElec: prevByKey.get(`${p.id}|electricity`) ?? 0,
          hasPrevWater: prevByKey.has(`${p.id}|water`),
          hasPrevElec: prevByKey.has(`${p.id}|electricity`),
        }
      })
      .filter((r): r is RoomRow => r !== null)
      .sort((a, b) => a.name.localeCompare(b.name, 'th'))
  }, [properties, activeByPid, prevByKey])

  const anyWater = rooms.some((r) => r.water)
  const anyElec = rooms.some((r) => r.electricity)

  function setCell(propertyId: string, kind: UtilityKind, value: string) {
    setDraft((prev) => ({
      ...prev,
      [propertyId]: {
        water: kind === 'water' ? value : prev[propertyId]?.water ?? '',
        electricity:
          kind === 'electricity' ? value : prev[propertyId]?.electricity ?? '',
      },
    }))
  }

  /** วางจาก Excel — ทั้งคอลัมน์ → เติมลงแถวถัดๆ ไป (เริ่มจากแถวที่วาง) */
  function onPaste(
    e: React.ClipboardEvent<HTMLInputElement>,
    rowIndex: number,
    kind: UtilityKind,
  ) {
    const text = e.clipboardData.getData('text')
    if (!/[\t\n\r]/.test(text)) return // ค่าเดียว → ปล่อยให้ input รับปกติ
    e.preventDefault()
    const values = text
      .split(/\r\n|\r|\n/)
      .map((line) => line.split('\t')[0].replace(/,/g, '').trim())
    setDraft((prev) => {
      const next = { ...prev }
      let r = rowIndex
      for (const v of values) {
        if (r >= rooms.length) break
        const room = rooms[r]
        const canTake = kind === 'water' ? room.water : room.electricity
        if (canTake && v !== '' && !Number.isNaN(Number(v))) {
          next[room.propertyId] = {
            water:
              kind === 'water' ? v : next[room.propertyId]?.water ?? '',
            electricity:
              kind === 'electricity'
                ? v
                : next[room.propertyId]?.electricity ?? '',
          }
        }
        r++
      }
      return next
    })
  }

  /** จำนวนรายการที่กรอกพร้อมบันทึก (curr ≥ prev และมีเรต) */
  const pending = useMemo(() => {
    const items: MeterReadingData[] = []
    for (const room of rooms) {
      for (const kind of ['water', 'electricity'] as UtilityKind[]) {
        const has = kind === 'water' ? room.water : room.electricity
        if (!has) continue
        const raw = draft[room.propertyId]?.[kind]
        if (raw == null || raw.trim() === '') continue
        const curr = Number(raw)
        if (Number.isNaN(curr)) continue
        const hasPrev = kind === 'water' ? room.hasPrevWater : room.hasPrevElec
        // ครั้งแรกสุด (ไม่เคยจด) → ตั้งต้น: prev = curr → 0 หน่วย ไม่คิดเงิน
        const prev = hasPrev
          ? kind === 'water'
            ? room.prevWater
            : room.prevElec
          : curr
        if (curr < prev) continue
        const rate = kind === 'water' ? room.waterRate : room.electricityRate
        const units = curr - prev
        items.push({
          property_id: room.propertyId,
          property_name: room.name,
          contract_id: room.contractId ?? undefined,
          type: META[kind],
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
  }, [rooms, draft, readingDate])

  async function handleSave() {
    if (pending.length === 0) return
    try {
      const res = await bulkCreate.mutateAsync(pending)
      toast.success(`บันทึกมิเตอร์ ${res.count} รายการแล้ว`, {
        description: 'ค่าน้ำ/ไฟจะเข้าใบแจ้งหนี้รอบถัดไปอัตโนมัติ',
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
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div className='flex items-end gap-2'>
          <div className='space-y-1'>
            <label className='text-xs text-muted-foreground'>
              วันที่จด (วว/ดด/ปปปป พ.ศ.)
            </label>
            <Input
              value={readingDate}
              onChange={(e) => setReadingDate(e.target.value)}
              placeholder='31/01/2569'
              className='h-9 w-[160px]'
            />
          </div>
          <p className='pb-2 text-xs text-muted-foreground'>
            💡 copy คอลัมน์เลขมิเตอร์จาก Excel แล้ว paste ในช่อง "ปัจจุบัน" ได้เลย
          </p>
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

      <div className='overflow-x-auto rounded-md border bg-card'>
        <Table className='min-w-[760px]'>
          <TableHeader>
            <TableRow className='hover:bg-transparent'>
              <TableHead className='min-w-[200px]'>ห้อง / ผู้เช่า</TableHead>
              {anyWater && (
                <>
                  <TableHead className='text-right text-sky-700 dark:text-sky-300'>น้ำ·ก่อน</TableHead>
                  <TableHead className='text-sky-700 dark:text-sky-300'>น้ำ·ปัจจุบัน</TableHead>
                  <TableHead className='text-right text-sky-700 dark:text-sky-300'>น้ำ·ยอด</TableHead>
                </>
              )}
              {anyElec && (
                <>
                  <TableHead className='text-right text-amber-700 dark:text-amber-300'>ไฟ·ก่อน</TableHead>
                  <TableHead className='text-amber-700 dark:text-amber-300'>ไฟ·ปัจจุบัน</TableHead>
                  <TableHead className='text-right text-amber-700 dark:text-amber-300'>ไฟ·ยอด</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms.map((room, i) => {
              const wRaw = draft[room.propertyId]?.water ?? ''
              const eRaw = draft[room.propertyId]?.electricity ?? ''
              const wFilled = wRaw !== '' && !Number.isNaN(Number(wRaw))
              const eFilled = eRaw !== '' && !Number.isNaN(Number(eRaw))
              // ยังไม่เคยจด → ครั้งแรก = ตั้งต้น (0 หน่วย)
              const wUnits = wFilled ? (room.hasPrevWater ? Number(wRaw) - room.prevWater : 0) : null
              const eUnits = eFilled ? (room.hasPrevElec ? Number(eRaw) - room.prevElec : 0) : null
              return (
                <TableRow key={room.propertyId}>
                  <TableCell className='py-2'>
                    <span className='block truncate text-sm font-medium'>{room.name}</span>
                    <span className='block truncate text-xs text-muted-foreground'>
                      {room.building && `${room.building} · `}
                      {room.tenant ?? 'ว่าง'}
                    </span>
                  </TableCell>

                  {anyWater &&
                    (room.water ? (
                      <>
                        <TableCell className='text-right text-sm tabular-nums text-muted-foreground'>
                          {room.hasPrevWater ? room.prevWater.toLocaleString('th-TH') : 'เริ่มต้น'}
                        </TableCell>
                        <TableCell className='py-1'>
                          <Input
                            value={wRaw}
                            onChange={(e) => setCell(room.propertyId, 'water', e.target.value)}
                            onPaste={(e) => onPaste(e, i, 'water')}
                            inputMode='decimal'
                            placeholder='—'
                            className={cn(
                              'h-8 w-24 text-right tabular-nums',
                              wUnits != null && wUnits < 0 && 'border-destructive text-destructive',
                            )}
                          />
                        </TableCell>
                        <TableCell className='text-right text-sm tabular-nums'>
                          {!wFilled
                            ? '—'
                            : !room.hasPrevWater
                              ? <span className='text-xs text-muted-foreground'>ตั้งต้น</span>
                              : wUnits != null && wUnits >= 0
                                ? amt(wUnits * room.waterRate, { symbol: false, decimal: 0 })
                                : '—'}
                        </TableCell>
                      </>
                    ) : (
                      <TableCell colSpan={3} className='text-center text-xs text-muted-foreground'>—</TableCell>
                    ))}

                  {anyElec &&
                    (room.electricity ? (
                      <>
                        <TableCell className='text-right text-sm tabular-nums text-muted-foreground'>
                          {room.hasPrevElec ? room.prevElec.toLocaleString('th-TH') : 'เริ่มต้น'}
                        </TableCell>
                        <TableCell className='py-1'>
                          <Input
                            value={eRaw}
                            onChange={(e) => setCell(room.propertyId, 'electricity', e.target.value)}
                            onPaste={(e) => onPaste(e, i, 'electricity')}
                            inputMode='decimal'
                            placeholder='—'
                            className={cn(
                              'h-8 w-24 text-right tabular-nums',
                              eUnits != null && eUnits < 0 && 'border-destructive text-destructive',
                            )}
                          />
                        </TableCell>
                        <TableCell className='text-right text-sm tabular-nums'>
                          {!eFilled
                            ? '—'
                            : !room.hasPrevElec
                              ? <span className='text-xs text-muted-foreground'>ตั้งต้น</span>
                              : eUnits != null && eUnits >= 0
                                ? amt(eUnits * room.electricityRate, { symbol: false, decimal: 0 })
                                : '—'}
                        </TableCell>
                      </>
                    ) : (
                      <TableCell colSpan={3} className='text-center text-xs text-muted-foreground'>—</TableCell>
                    ))}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
