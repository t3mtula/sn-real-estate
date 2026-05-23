import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { TH_ID_TO_LOC, TH_LOC_MAP, TH_PATHS } from './thailand-paths'

type Props = {
  /** Map of province name → count of properties. Names should match TH_LOC_MAP keys. */
  provinceCounts: Record<string, number>
}

type HoverState = {
  id: string
  name: string
  count: number
  x: number
  y: number
} | null

/**
 * 5-bucket color scale based on count vs max.
 * Returns Tailwind-ish hex colors so we don't depend on JIT for arbitrary classes.
 */
function colorForCount(count: number, max: number): string {
  if (count <= 0) return '#f1f5f9' // slate-100 — no properties
  if (max <= 1) return '#3b82f6' // blue-500
  const ratio = count / max
  if (ratio <= 0.2) return '#dbeafe' // blue-100
  if (ratio <= 0.4) return '#93c5fd' // blue-300
  if (ratio <= 0.6) return '#60a5fa' // blue-400
  if (ratio <= 0.85) return '#3b82f6' // blue-500
  return '#1d4ed8' // blue-700
}

function strokeForCount(count: number): string {
  return count > 0 ? '#1e40af' : '#cbd5e1' // blue-800 / slate-300
}

export function ThailandMap({ provinceCounts }: Props) {
  const navigate = useNavigate()
  const [hover, setHover] = useState<HoverState>(null)

  // Aggregate counts per TH ID using TH_LOC_MAP (handles aliases like กรุงเทพมหานคร→TH10)
  const { countsById, max, totalCounted } = useMemo(() => {
    const byId: Record<string, number> = {}
    let maxVal = 0
    let total = 0
    for (const [name, count] of Object.entries(provinceCounts)) {
      const id = TH_LOC_MAP[name]
      if (!id || !count) continue
      byId[id] = (byId[id] ?? 0) + count
      total += count
    }
    for (const v of Object.values(byId)) if (v > maxVal) maxVal = v
    return { countsById: byId, max: maxVal, totalCounted: total }
  }, [provinceCounts])

  const provincesWithProps = Object.keys(countsById).length

  function handleClick(id: string) {
    const name = TH_ID_TO_LOC[id]
    if (!name) return
    navigate({
      to: '/properties',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      search: { province: name } as any,
    })
  }

  function handleMouseMove(
    e: React.MouseEvent<SVGPathElement>,
    id: string,
  ) {
    const name = TH_ID_TO_LOC[id] ?? id
    const count = countsById[id] ?? 0
    // Position relative to the containing wrapper (offsetParent of <svg> = the relative wrapper)
    const wrapper = (e.currentTarget.ownerSVGElement?.parentElement) as HTMLElement | null
    const rect = wrapper?.getBoundingClientRect()
    const x = rect ? e.clientX - rect.left : e.clientX
    const y = rect ? e.clientY - rect.top : e.clientY
    setHover({ id, name, count, x, y })
  }

  function handleMouseLeave() {
    setHover(null)
  }

  return (
    <div className='rounded-md border bg-card p-4'>
      <div className='mb-3 flex items-end justify-between gap-3'>
        <div>
          <h2 className='text-sm font-semibold'>การกระจายทรัพย์สินตามจังหวัด</h2>
          <p className='text-xs text-muted-foreground'>
            {provincesWithProps.toLocaleString('th-TH')} จังหวัด ·{' '}
            {totalCounted.toLocaleString('th-TH')} ทรัพย์สิน · คลิกจังหวัดเพื่อกรองรายการ
          </p>
        </div>
        {/* Legend */}
        <div className='hidden items-center gap-1.5 text-[10px] text-muted-foreground sm:flex'>
          <span>น้อย</span>
          <span className='inline-block size-3 rounded-sm border' style={{ background: '#f1f5f9' }} />
          <span className='inline-block size-3 rounded-sm border' style={{ background: '#dbeafe' }} />
          <span className='inline-block size-3 rounded-sm border' style={{ background: '#93c5fd' }} />
          <span className='inline-block size-3 rounded-sm border' style={{ background: '#60a5fa' }} />
          <span className='inline-block size-3 rounded-sm border' style={{ background: '#3b82f6' }} />
          <span className='inline-block size-3 rounded-sm border' style={{ background: '#1d4ed8' }} />
          <span>มาก</span>
        </div>
      </div>

      <div className='relative mx-auto max-w-[480px]'>
        <svg
          viewBox='240 35 520 930'
          xmlns='http://www.w3.org/2000/svg'
          style={{ width: '100%', height: 'auto', display: 'block' }}
          role='img'
          aria-label='แผนที่ประเทศไทย — การกระจายทรัพย์สินตามจังหวัด'
        >
          {Object.entries(TH_PATHS).map(([id, d]) => {
            const count = countsById[id] ?? 0
            const isActive = count > 0
            return (
              <path
                key={id}
                d={d}
                fill={colorForCount(count, max)}
                stroke={strokeForCount(count)}
                strokeWidth={isActive ? 0.9 : 0.5}
                style={{ cursor: isActive ? 'pointer' : 'default', transition: 'fill 0.15s' }}
                onMouseMove={(e) => handleMouseMove(e, id)}
                onMouseLeave={handleMouseLeave}
                onClick={() => {
                  if (isActive) handleClick(id)
                }}
              />
            )
          })}
        </svg>

        {hover && (
          <div
            className='pointer-events-none absolute z-10 rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md'
            style={{
              left: hover.x + 12,
              top: hover.y + 12,
              whiteSpace: 'nowrap',
            }}
          >
            <span className='font-semibold'>{hover.name}</span>
            <span className='ml-1.5 text-muted-foreground'>
              · {hover.count.toLocaleString('th-TH')} ทรัพย์สิน
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
