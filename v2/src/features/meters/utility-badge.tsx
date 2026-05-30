/**
 * UtilityBadge — Pill สี โชว์ว่าทรัพย์สิน/สัญญา มีค่าน้ำ/ค่าไฟไหม
 *
 * ของกลาง · ใช้ทั้งหน้าทรัพย์สิน (มีมิเตอร์น้ำ/ไฟ) + สัญญา (ผู้เช่าจ่ายค่าน้ำ/ไฟ)
 * สี: น้ำ = sky · ไฟ = amber (เมื่อเปิด) · muted เมื่อปิด (ตาม state-colored pill palette)
 * pattern เดียวกับ StatusBadge ใน invoices.tsx (shadcn Badge variant=outline + tone class)
 */
import { Droplet, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ContractData } from '@/features/contracts/types'
import type { PropertyData } from '@/features/properties/types'

export type UtilityKind = 'water' | 'electricity'

const UTILITY_META: Record<
  UtilityKind,
  { label: string; Icon: typeof Droplet; onClass: string }
> = {
  water: {
    label: 'ค่าน้ำ',
    Icon: Droplet,
    onClass:
      'bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-300',
  },
  electricity: {
    label: 'ค่าไฟ',
    Icon: Zap,
    onClass:
      'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300',
  },
}

const OFF_CLASS = 'bg-muted text-muted-foreground border-border'

/** Pill เดี่ยวของ utility 1 ประเภท · enabled คุมสี on/off */
export function UtilityBadge({
  kind,
  enabled,
  rate,
  className,
}: {
  kind: UtilityKind
  enabled: boolean
  /** เรตต่อหน่วย · ถ้าใส่ + enabled จะโชว์ "· ฿X/หน่วย" */
  rate?: number
  className?: string
}) {
  const meta = UTILITY_META[kind]
  const Icon = meta.Icon
  return (
    <Badge
      variant='outline'
      className={cn('font-normal', enabled ? meta.onClass : OFF_CLASS, className)}
    >
      <Icon className='size-3' />
      {meta.label}
      {enabled && rate != null && rate > 0 ? ` · ฿${rate}/หน่วย` : ''}
    </Badge>
  )
}

/**
 * กลุ่ม Pill น้ำ+ไฟ · โชว์เฉพาะตัวที่เปิด (enabled)
 * ถ้าไม่เปิดเลย → โชว์ emptyLabel (ถ้าให้มา) หรือไม่ render อะไร
 */
export function UtilityBadges({
  water,
  electricity,
  waterRate,
  electricityRate,
  showRate = false,
  emptyLabel,
  className,
}: {
  water?: boolean
  electricity?: boolean
  waterRate?: number
  electricityRate?: number
  showRate?: boolean
  emptyLabel?: string
  className?: string
}) {
  const none = !water && !electricity
  if (none) {
    return emptyLabel ? (
      <span className={cn('text-xs text-muted-foreground', className)}>
        {emptyLabel}
      </span>
    ) : null
  }
  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {water && (
        <UtilityBadge
          kind='water'
          enabled
          rate={showRate ? waterRate : undefined}
        />
      )}
      {electricity && (
        <UtilityBadge
          kind='electricity'
          enabled
          rate={showRate ? electricityRate : undefined}
        />
      )}
    </div>
  )
}

/** อ่าน flag + เรต ของ utilities จาก property.data */
export function getPropertyUtilities(data: PropertyData | undefined) {
  const u = data?.utilities
  return {
    water: u?.water?.enabled === true,
    electricity: u?.electricity?.enabled === true,
    waterRate: u?.water?.ratePerUnit ?? 0,
    electricityRate: u?.electricity?.ratePerUnit ?? 0,
  }
}

/** อ่าน flag ที่ผู้เช่าจ่าย จาก contract.data */
export function getContractUtilities(data: ContractData | undefined) {
  const u = data?.utilities
  return {
    water: u?.water === true,
    electricity: u?.electricity === true,
  }
}
