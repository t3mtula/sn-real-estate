import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * Lightweight contract row shape — only fields used for landlord/tenant matching
 *
 * Used by:
 *   - landlords list (count contracts per landlord)
 *   - tenants list (count contracts per tenant)
 *   - landlord-detail (related contracts)
 *   - tenant-detail (related contracts)
 *
 * Why a shared query?
 *   v1 stores landlord/tenant inline in contracts.data jsonb (no FK). To resolve
 *   the relationship we used to `.select('id, data')` and ship the full jsonb
 *   (~276 KB for 144 contracts including signature base64). 4 separate queries
 *   = 4 cache copies × 276 KB = ~1 MB cached per page load. After several tab
 *   switches the app was visibly stuttering.
 *
 *   PostgREST JSON traversal (`data->key`) returns only those keys, dropping
 *   payload to ~15 KB. We also unify the cache key so all consumers share one
 *   copy.
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
    cancelled?: boolean | null
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
          'id, data->landlord_id, data->invHeaderId, data->landlord, data->tenant_id, data->taxId, data->tenant, data->pid_property, data->pid, data->cancelled',
        )
      if (error) throw error
      // PostgREST returns each `data->key` as a flat field — re-nest under `data`
      // to keep callers' typing consistent.
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
        cancelled?: boolean | null
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
          cancelled: r.cancelled ?? null,
        },
      }))
    },
    // staleTime + gcTime override defaults · contract match list rarely changes
    staleTime: 60_000, // 1 minute fresh
    gcTime: 5 * 60_000, // 5 minutes in cache
  })
}
