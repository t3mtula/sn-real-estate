import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { parseBE } from '@/lib/thai'
import {
  CONTRACT_STATUSES,
  EXPIRING_THRESHOLD_DAYS,
  type Contract,
  type ContractData,
  type ContractStatus,
} from '@/features/contracts/types'

const TABLE = 'contracts'

/**
 * Fetch all contracts · sorted by updated_at desc
 *
 * NOTE: contracts payload trimmed in v1 perf round (commit 8ad84db).
 * Pre-aggregate keys for list view only — full data fetched per detail.
 */
export function useContracts() {
  return useQuery({
    queryKey: ['contracts'],
    queryFn: async (): Promise<Contract[]> => {
      const { data, error } = await supabase
        .from(TABLE)
        .select('id, data, created_at, updated_at')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Contract[]
    },
  })
}

/**
 * Fetch single contract by ID
 */
export function useContract(id: string | undefined) {
  return useQuery({
    queryKey: ['contracts', id],
    queryFn: async (): Promise<Contract | null> => {
      if (!id) return null
      const { data, error } = await supabase
        .from(TABLE)
        .select('id, data, created_at, updated_at')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data as Contract | null
    },
    enabled: !!id,
  })
}

/* ---------- helpers ---------- */

const STATUS_META: Record<ContractStatus, (typeof CONTRACT_STATUSES)[number]> =
  Object.fromEntries(CONTRACT_STATUSES.map((s) => [s.value, s])) as Record<
    ContractStatus,
    (typeof CONTRACT_STATUSES)[number]
  >

export function getStatusMeta(status: ContractStatus) {
  return STATUS_META[status] ?? STATUS_META.unknown
}

/**
 * Compute contract status — mirror v1 helper status(c) in modules/08-helpers.js
 *
 * Priority:
 *   1. closed         → 'closed'
 *   2. cancelled      → 'cancelled'
 *   3. invalid end    → 'unknown'
 *   4. past end       → 'expired'
 *   5. within 90 days → 'expiring'
 *   6. start in future → 'upcoming'
 *   7. otherwise      → 'active'
 */
export function getContractStatus(
  data: ContractData | undefined,
  thresholdDays: number = EXPIRING_THRESHOLD_DAYS,
): ContractStatus {
  if (!data) return 'unknown'
  if (data.closed) return 'closed'
  if (data.cancelled) return 'cancelled'
  const end = parseBE(data.end ?? '')
  const start = parseBE(data.start ?? '')
  if (!end) return 'unknown'
  const now = new Date()
  const endMs = end.toDate().getTime()
  if (endMs < now.getTime()) return 'expired'
  const daysLeft = (endMs - now.getTime()) / 86_400_000
  if (daysLeft <= thresholdDays) return 'expiring'
  if (start && start.toDate().getTime() > now.getTime()) return 'upcoming'
  return 'active'
}

/**
 * Display label for contract (number with fallback to id)
 */
export function getContractDisplay(c: Contract): string {
  return (c.data?.no ?? '').trim() || `#${c.id}`
}

/**
 * Summary line: tenant · property · start → end
 */
export function getContractSummary(data: ContractData | undefined): string {
  if (!data) return '—'
  const tenant = (data.tenant ?? '').trim()
  const start = (data.start ?? '').trim()
  const end = (data.end ?? '').trim()
  const parts: string[] = []
  if (tenant) parts.push(tenant)
  if (start || end) parts.push(`${start || '—'} → ${end || '—'}`)
  return parts.join(' · ') || '—'
}
