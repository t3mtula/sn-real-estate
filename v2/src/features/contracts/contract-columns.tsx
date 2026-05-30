/**
 * Shared contract table columns — single source of truth for BOTH the main
 * contracts list page AND the embedded table on the property detail page.
 *
 * Each page builds its own <table> shell (selection/hover differ) but pulls
 * column defs + row formatting from here via createContractColumns(opts).
 */

import { type ColumnDef } from '@tanstack/react-table'
import { Eye } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SortableHeader } from '@/components/yonghua/sortable-header'
import { createSelectColumn } from '@/components/data-table'
import { OverdueBadge } from '@/components/yonghua/overdue-badge'
import { ContractTimelineBar } from '@/features/contracts/contract-timeline-bar'
import {
  getContractDisplay,
  getStatusMeta,
} from '@/features/contracts/queries'
import {
  UtilityBadge,
  getContractUtilities,
} from '@/features/meters/utility-badge'
import { freqShortLabel } from '@/lib/contracts/stats'
import { amt, dayjs, fmtThaiShort } from '@/lib/thai'
import { type Contract, type ContractStatus } from '@/features/contracts/types'
import { cn } from '@/lib/utils'

/** A contract row augmented with computed fields (status + overdue + building) */
export type ContractRow = Contract & {
  _status: ContractStatus
  _overdueCount: number
  _overdueAmount: number
  _building: string
}

export const STATUS_TONE_CLASS: Record<string, string> = {
  success: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300',
  warning: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300',
  info: 'bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-300',
  muted: 'bg-muted text-muted-foreground border-border',
  destructive: 'bg-destructive/10 text-destructive border-destructive/30',
}

/** Left accent strip on the row — v1-style color cue at a glance */
export const STATUS_ACCENT_STRIP: Record<string, string> = {
  active: 'border-l-2 border-l-emerald-500',
  expiring: 'border-l-2 border-l-amber-500',
  upcoming: 'border-l-2 border-l-sky-500',
  expired: 'border-l-2 border-l-slate-400',
  cancelled: 'border-l-2 border-l-red-500',
  closed: 'border-l-2 border-l-slate-300',
  unknown: 'border-l-2 border-l-transparent',
}

export function relativeThaiTime(isoStr: string | null | undefined): string {
  if (!isoStr) return '—'
  const d = dayjs(isoStr)
  if (!d.isValid()) return '—'
  const days = dayjs().diff(d, 'day')
  if (days === 0) return 'วันนี้'
  if (days === 1) return 'เมื่อวาน'
  if (days < 7) return `${days} วันที่แล้ว`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks} สัปดาห์ที่แล้ว`
  const months = dayjs().diff(d, 'month')
  if (months < 12) return `${months} เดือนที่แล้ว`
  return `${dayjs().diff(d, 'year')} ปีที่แล้ว`
}

export function StatusBadge({ status }: { status: ContractStatus }) {
  const meta = getStatusMeta(status)
  return (
    <Badge
      variant='outline'
      className={cn('font-normal', STATUS_TONE_CLASS[meta.tone] ?? '')}
    >
      {meta.label}
    </Badge>
  )
}

export interface ContractColumnsOptions {
  /** Leading checkbox column for bulk selection (list page only) */
  select?: boolean
  /** Eye preview action column — pass a handler to enable it */
  onPreview?: (id: string) => void
  /** Show the ผู้ให้เช่า (landlord) column */
  landlord?: boolean
  /** Show the ทรัพย์สิน (property name + building + utilities) column */
  property?: boolean
  /** Show a compact น้ำ/ไฟ utility-badge column (used when property col hidden) */
  utilities?: boolean
  /** Show the แก้ล่าสุด (updated_at) column */
  updatedAt?: boolean
}

/** Column: เลขที่สัญญา (number + tags) */
const noColumn: ColumnDef<ContractRow> = {
  id: 'no',
  accessorFn: (row) => getContractDisplay(row),
  header: ({ column }) => (
    <SortableHeader column={column}>เลขที่สัญญา</SortableHeader>
  ),
  cell: ({ row }) => {
    const v = getContractDisplay(row.original)
    const tags = Array.isArray(row.original.data?.tags)
      ? (row.original.data.tags as string[])
      : []
    return (
      <div className='max-w-[150px]'>
        <span className='block truncate font-medium' title={v}>
          {v}
        </span>
        {tags.length > 0 && (
          <div className='mt-1 flex flex-wrap gap-1'>
            {tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className='inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground'
              >
                {t}
              </span>
            ))}
            {tags.length > 3 && (
              <span className='text-[10px] text-muted-foreground'>
                +{tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    )
  },
}

const tenantColumn: ColumnDef<ContractRow> = {
  id: 'tenant',
  accessorFn: (row) => row.data?.tenant ?? '',
  header: ({ column }) => (
    <SortableHeader column={column}>ผู้เช่า</SortableHeader>
  ),
  cell: ({ row }) => {
    const v = row.original.data?.tenant?.trim() || '—'
    return (
      <span className='block max-w-[180px] truncate text-sm' title={v}>
        {v}
      </span>
    )
  },
}

const landlordColumn: ColumnDef<ContractRow> = {
  id: 'landlord',
  accessorFn: (row) => row.data?.landlord ?? '',
  header: ({ column }) => (
    <SortableHeader column={column}>ผู้ให้เช่า</SortableHeader>
  ),
  cell: ({ row }) => {
    const v = row.original.data?.landlord?.trim() || '—'
    return (
      <span className='block max-w-[180px] truncate text-sm' title={v}>
        {v}
      </span>
    )
  },
}

const propertyColumn: ColumnDef<ContractRow> = {
  id: 'property',
  accessorFn: (row) => String(row.data?.property ?? ''),
  header: ({ column }) => (
    <SortableHeader column={column}>ทรัพย์สิน</SortableHeader>
  ),
  cell: ({ row }) => {
    const v = String(row.original.data?.property ?? '').trim() || '—'
    const building = row.original._building
    const u = getContractUtilities(row.original.data)
    return (
      <div className='max-w-[180px]'>
        <span className='block truncate text-sm' title={v}>
          {v}
        </span>
        {building && (
          <span
            className='block truncate text-xs text-muted-foreground'
            title={building}
          >
            {building}
          </span>
        )}
        {(u.water || u.electricity) && (
          <div className='mt-1 flex flex-wrap gap-1'>
            {u.water && <UtilityBadge kind='water' enabled />}
            {u.electricity && <UtilityBadge kind='electricity' enabled />}
          </div>
        )}
      </div>
    )
  },
}

/** Compact น้ำ/ไฟ badges — for property detail where the property name is redundant */
const utilitiesColumn: ColumnDef<ContractRow> = {
  id: 'utilities',
  enableSorting: false,
  header: () => <span>น้ำ/ไฟ</span>,
  cell: ({ row }) => {
    const u = getContractUtilities(row.original.data)
    if (!u.water && !u.electricity) {
      return <span className='text-xs text-muted-foreground'>—</span>
    }
    return (
      <div className='flex flex-wrap gap-1'>
        {u.water && <UtilityBadge kind='water' enabled />}
        {u.electricity && <UtilityBadge kind='electricity' enabled />}
      </div>
    )
  },
}

const endColumn: ColumnDef<ContractRow> = {
  id: 'end',
  accessorFn: (row) => row.data?.end ?? '',
  header: ({ column }) => (
    <SortableHeader column={column}>ระยะสัญญา</SortableHeader>
  ),
  cell: ({ row }) => {
    const d = row.original.data
    return (
      <div className='min-w-[180px] max-w-[260px]'>
        <ContractTimelineBar
          start={d?.start}
          end={d?.end}
          cancelled={!!d?.cancelled || row.original._status === 'cancelled'}
        />
      </div>
    )
  },
}

const rateColumn: ColumnDef<ContractRow> = {
  id: 'rate',
  // v1 legacy data ships rate as messy string. amt() loose-parses it.
  accessorFn: (row) => {
    const formatted = amt(row.data?.rate as number | string | undefined, {
      symbol: false,
      decimal: 0,
      emDash: false,
    })
    return formatted ? Number(formatted.replace(/[,\s]/g, '')) : 0
  },
  header: ({ column }) => (
    <SortableHeader column={column}>ค่าเช่า</SortableHeader>
  ),
  cell: ({ row }) => {
    const d = row.original.data
    const formatted = amt(d?.rate as number | string | undefined, {
      symbol: false,
      decimal: 0,
    })
    if (formatted === '—') {
      return <span className='text-sm text-muted-foreground'>—</span>
    }
    const freqLabel = freqShortLabel(d ?? {})
    return (
      <span className='text-sm tabular-nums'>
        {formatted}
        {freqLabel ? (
          <span className='ms-2 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground'>
            {freqLabel}
          </span>
        ) : null}
      </span>
    )
  },
}

const statusColumn: ColumnDef<ContractRow> = {
  id: 'status',
  accessorFn: (row) => row._status,
  header: ({ column }) => (
    <SortableHeader column={column}>สถานะ</SortableHeader>
  ),
  cell: ({ row }) => (
    <div className='flex flex-col items-start gap-1'>
      <StatusBadge status={row.original._status} />
      {row.original._overdueCount > 0 && (
        <OverdueBadge
          count={row.original._overdueCount}
          amount={row.original._overdueAmount}
          unit='ใบ'
        />
      )}
    </div>
  ),
}

const updatedAtColumn: ColumnDef<ContractRow> = {
  id: 'updated_at',
  accessorFn: (row) => row.updated_at ?? '',
  sortDescFirst: true,
  header: ({ column }) => (
    <SortableHeader column={column}>แก้ล่าสุด</SortableHeader>
  ),
  cell: ({ row }) => {
    const ts = row.original.updated_at
    if (!ts) return <span className='text-sm text-muted-foreground'>—</span>
    return (
      <div className='min-w-[90px]'>
        <div className='text-sm tabular-nums'>{fmtThaiShort(ts)}</div>
        <div className='text-[11px] text-muted-foreground'>
          {relativeThaiTime(ts)}
        </div>
      </div>
    )
  },
}

/**
 * Build the contract column set. Core columns (no · tenant · ระยะ · ค่าเช่า ·
 * สถานะ) are always present; the rest are toggled per host page.
 */
export function createContractColumns(
  opts: ContractColumnsOptions = {},
): ColumnDef<ContractRow>[] {
  const cols: ColumnDef<ContractRow>[] = []

  if (opts.select) cols.push(createSelectColumn<ContractRow>())
  cols.push(noColumn, tenantColumn)
  if (opts.landlord) cols.push(landlordColumn)
  if (opts.property) cols.push(propertyColumn)
  if (opts.utilities) cols.push(utilitiesColumn)
  cols.push(endColumn, rateColumn, statusColumn)
  if (opts.updatedAt) cols.push(updatedAtColumn)

  const onPreview = opts.onPreview
  if (onPreview) {
    cols.push({
      id: 'actions',
      header: () => <span className='sr-only'>การกระทำ</span>,
      cell: ({ row }) => (
        <Button
          variant='ghost'
          size='sm'
          className='size-8 p-0'
          title='ดูตัวอย่างพิมพ์'
          onClick={(e) => {
            e.stopPropagation()
            onPreview(row.original.id)
          }}
        >
          <Eye className='size-4' />
          <span className='sr-only'>ตัวอย่างพิมพ์</span>
        </Button>
      ),
    })
  }

  return cols
}
