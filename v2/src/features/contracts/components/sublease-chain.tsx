import { Link } from '@tanstack/react-router'
import { ArrowDown, Link2 } from 'lucide-react'
import {
  getContractDisplay,
  getContractStatus,
  useChildContracts,
  useContract,
} from '@/features/contracts/queries'
import type { Contract } from '@/features/contracts/types'
import { cn } from '@/lib/utils'

/**
 * Sublease chain (ก → ข → ค)
 *
 * Walks UP via parent_contract_id chain (up to N hops) then shows
 * direct CHILDREN of the current contract.
 *
 * Display style: vertical chain of cards · current contract highlighted.
 * Only renders when there's actual chain depth — otherwise nothing.
 */
export function SubleaseChain({ contract }: { contract: Contract }) {
  const parentId = contract.data?.parent_contract_id
  const { data: parent } = useContract(parentId)
  const grandparentId = parent?.data?.parent_contract_id
  const { data: grandparent } = useContract(grandparentId)
  const { data: children } = useChildContracts(contract.id)

  const hasChain = !!parentId || (children && children.length > 0)
  if (!hasChain) return null

  const ancestors: Array<{ contract: Contract; label: string }> = []
  if (grandparent) ancestors.push({ contract: grandparent, label: 'ผู้ให้เช่าต้น (ก)' })
  if (parent) ancestors.push({ contract: parent, label: 'ผู้เช่าหลัก/ผู้ให้เช่าช่วง (ข)' })

  // Determine label for current
  const currentLabel = parent
    ? (children && children.length > 0)
      ? 'สัญญาปัจจุบัน (ข) — เช่าช่วงให้คนอื่น'
      : 'สัญญาปัจจุบัน (ค) — ผู้เช่าช่วง'
    : (children && children.length > 0)
      ? 'สัญญาปัจจุบัน (ก) — ปล่อยเช่าช่วง'
      : 'สัญญาปัจจุบัน'

  return (
    <div className='rounded-md border bg-card'>
      <div className='flex items-center gap-2 border-b px-4 py-3'>
        <Link2 className='size-4 text-muted-foreground' />
        <h3 className='text-sm font-semibold'>สัญญาเช่าช่วง (chain)</h3>
        <span className='text-xs text-muted-foreground'>
          ก → ข → ค (ตามลำดับการเช่าช่วง)
        </span>
      </div>
      <div className='space-y-3 p-4'>
        {ancestors.map(({ contract: c, label }, i) => (
          <ChainNode
            key={c.id}
            contract={c}
            label={label}
            arrow={i === ancestors.length - 1 ? 'down' : 'down'}
            current={false}
          />
        ))}
        <ChainNode contract={contract} label={currentLabel} current arrow={children && children.length > 0 ? 'down' : 'none'} />
        {children?.map((c) => (
          <ChainNode
            key={c.id}
            contract={c}
            label={
              (c.data?.parent_contract_id && c.data?.parent_contract_id === contract.id)
                ? 'สัญญาเช่าช่วง (ผู้เช่าช่วง · ค)'
                : 'สัญญาผูกอยู่'
            }
            arrow='none'
            current={false}
          />
        ))}
      </div>
    </div>
  )
}

function ChainNode({
  contract,
  label,
  arrow,
  current,
}: {
  contract: Contract
  label: string
  arrow: 'down' | 'none'
  current: boolean
}) {
  const display = getContractDisplay(contract)
  const status = getContractStatus(contract.data)
  return (
    <div className='space-y-2'>
      <div
        className={cn(
          'rounded-md border p-3',
          current
            ? 'border-primary/40 bg-primary/5'
            : 'bg-muted/30 hover:bg-muted/40',
        )}
      >
        <p className='text-[10px] font-semibold uppercase tracking-wide text-muted-foreground'>
          {label}
        </p>
        <div className='mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1'>
          {current ? (
            <span className='font-semibold'>{display}</span>
          ) : (
            <Link
              to='/contracts/$id'
              params={{ id: contract.id }}
              className='font-semibold text-primary underline-offset-4 hover:underline'
            >
              {display}
            </Link>
          )}
          <span className='text-xs text-muted-foreground'>
            {contract.data?.tenant?.trim() || '—'}
            {contract.data?.property ? ` · ${contract.data.property}` : ''}
          </span>
        </div>
        <p className='mt-0.5 text-xs text-muted-foreground'>
          สถานะ: {translateStatus(status)}
          {contract.data?.start && contract.data?.end ? (
            <span className='tabular-nums'>
              {' '}· {contract.data.start} → {contract.data.end}
            </span>
          ) : null}
        </p>
      </div>
      {arrow === 'down' && (
        <div className='flex justify-center text-muted-foreground'>
          <ArrowDown className='size-4' />
        </div>
      )}
    </div>
  )
}

function translateStatus(s: string): string {
  switch (s) {
    case 'active':
      return 'active'
    case 'expiring':
      return 'ใกล้หมด'
    case 'expired':
      return 'หมดแล้ว'
    case 'upcoming':
      return 'รออนาคต'
    case 'cancelled':
      return 'ยกเลิก'
    case 'closed':
      return 'ปิด'
    default:
      return s
  }
}
