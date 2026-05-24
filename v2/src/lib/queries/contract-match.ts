import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * Lightweight contract row shape — only fields used for matching + glanceable
 * metrics on list pages (revenue, timeline, severity).
 *
 * Used by:
 *   - landlords list (count contracts + monthly revenue + expiring count)
 *   - tenants list (count contracts + total exposure + expiring count)
 *   - properties list (current tenant + rent + days-remaining)
 *   - landlord-detail / tenant-detail (related contracts)
 *
 * Why a shared query?
 *   v1 stores landlord/tenant/property inline in contracts.data jsonb. To resolve
 *   the relationship without shipping the full jsonb (signature base64, clauses,
 *   etc · ~276 KB for 144 contracts), PostgREST JSON traversal (`data->key`) is
 *   used to fetch only the keys needed. ~15 KB instead of ~1 MB.
 */
export type ContractMatchRow = {
  id: string
  data: {
    landlord_id?: string | null
    invHeaderId?: string | null
    landlord?: string | null
    tenant_id?: string | null
    taxId?: string | null
    tenant?: string | null
    pid_property?: number | null
    pid?: number | null
    property?: string | null
    cancelled?: boolean | null
    closed?: boolean | null
    start?: string | null
    end?: string | null
    rate?: number | string | null
    payFreq?: string | null
    payment?: string | null
    dur?: number | string | null
  }
}

/**
 * Fetch minimal contract match keys — shared cache across all consumers.
 */
export function useContractMatchKeys() {
  return useQuery({
    queryKey: ['contracts-match-keys'],
    queryFn: async (): Promise<ContractMatchRow[]> => {
      const { data, error } = await supabase
        .from('contracts')
        .select(
          'id, data->landlord_id, data->invHeaderId, data->landlord, data->tenant_id, data->taxId, data->tenant, data->pid_property, data->pid, data->property, data->cancelled, data->closed, data->start, data->end, data->rate, data->payFreq, data->payment, data->dur',
        )
      if (error) throw error
      type Flat = {
        id: string
        landlord_id?: string | null
        invHeaderId?: string | null
        landlord?: string | null
        tenant_id?: string | null
        taxId?: string | null
        tenant?: string | null
        pid_property?: number | null
        pid?: number | null
        property?: string | null
        cancelled?: boolean | null
        closed?: boolean | null
        start?: string | null
        end?: string | null
        rate?: number | string | null
        payFreq?: string | null
        payment?: string | null
        dur?: number | string | null
      }
      const rows = (data ?? []) as Flat[]
      return rows.map((r) => ({
        id: r.id,
        data: {
          landlord_id: r.landlord_id ?? null,
          invHeaderId: r.invHeaderId ?? null,
          landlord: r.landlord ?? null,
          tenant_id: r.tenant_id ?? null,
          taxId: r.taxId ?? null,
          tenant: r.tenant ?? null,
          pid_property: r.pid_property ?? null,
          pid: r.pid ?? null,
          property: r.property ?? null,
          cancelled: r.cancelled ?? null,
          closed: r.closed ?? null,
          start: r.start ?? null,
          end: r.end ?? null,
          rate: r.rate ?? null,
          payFreq: r.payFreq ?? null,
          payment: r.payment ?? null,
          dur: r.dur ?? null,
        },
      }))
    },
    // staleTime + gcTime override defaults · contract match list rarely changes
    staleTime: 60_000, // 1 minute fresh
    gcTime: 5 * 60_000, // 5 minutes in cache
  })
}
