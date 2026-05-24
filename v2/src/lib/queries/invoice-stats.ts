/**
 * Invoice stats — lightweight aggregation hook for overdue/outstanding badges
 * across list pages.
 *
 * Strategy:
 *   - Fetch minimal invoice fields (status + amounts + contract_id) once
 *   - Build per-contract aggregates (overdueCount, outstanding) in memory
 *   - List rows look up by contract_id (single index access · O(1))
 *
 * "Outstanding" = sum of `total - paidAmount` for not-paid not-voided invoices.
 *   This is a proxy until full payment reconciliation lands (Phase 1B-3d) —
 *   matches v1 dashboard semantics: "เงินที่ออกบิลแล้วยังไม่ได้รับ".
 *
 * Overdue = past dueDate AND status not in (paid, voided).
 */

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { parseBE } from '@/lib/thai'

type FlatInvoiceRow = {
  id: string
  contract_id: string | null
  status: string | null
  total?: number | string | null
  paidAmount?: number | string | null
  dueDate?: string | null
}

export type ContractInvoiceStat = {
  overdueCount: number
  overdueAmount: number
  outstandingAmount: number
  invoiceCount: number
}

export type InvoiceStatsByContract = Map<string, ContractInvoiceStat>

const ZERO: ContractInvoiceStat = {
  overdueCount: 0,
  overdueAmount: 0,
  outstandingAmount: 0,
  invoiceCount: 0,
}

function num(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const s = String(v).replace(/[,\s฿]/g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

/**
 * Per-contract invoice stats — cached at app level (5-min stale).
 *
 * Use `.get(contractId)` on the resulting Map · returns ZERO sentinel for
 * contracts with no invoices so callers don't need null checks.
 */
export function useInvoiceStatsByContract() {
  return useQuery({
    queryKey: ['invoice-stats-by-contract'],
    queryFn: async (): Promise<InvoiceStatsByContract> => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, contract_id, status, data->total, data->paidAmount, data->dueDate')
      if (error) throw error
      const rows = (data ?? []) as FlatInvoiceRow[]
      const now = Date.now()
      const map = new Map<string, ContractInvoiceStat>()
      for (const r of rows) {
        const cid = r.contract_id
        if (!cid) continue
        const status = (r.status ?? '').toLowerCase()
        const paid = status === 'paid'
        const voided = status === 'voided'
        const total = num(r.total)
        const paidAmt = num(r.paidAmount)
        const remaining = Math.max(0, total - paidAmt)
        const due = parseBE(r.dueDate ?? '')
        const isOverdue = !paid && !voided && !!due && due.toDate().getTime() < now
        const acc = map.get(cid) ?? { ...ZERO }
        acc.invoiceCount++
        if (!paid && !voided) acc.outstandingAmount += remaining
        if (isOverdue) {
          acc.overdueCount++
          acc.overdueAmount += remaining
        }
        map.set(cid, acc)
      }
      return map
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  })
}

/** Convenience: sum stats across many contract ids. */
export function aggregateStats(
  map: InvoiceStatsByContract | undefined,
  contractIds: Iterable<string>,
): ContractInvoiceStat {
  if (!map) return { ...ZERO }
  const acc: ContractInvoiceStat = { ...ZERO }
  for (const id of contractIds) {
    const s = map.get(id)
    if (!s) continue
    acc.overdueCount += s.overdueCount
    acc.overdueAmount += s.overdueAmount
    acc.outstandingAmount += s.outstandingAmount
    acc.invoiceCount += s.invoiceCount
  }
  return acc
}
