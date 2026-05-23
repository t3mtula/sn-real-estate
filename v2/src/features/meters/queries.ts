import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { MeterReading, MeterType } from '@/features/meters/types'

const TABLE = 'meter_readings'

/**
 * Fetch all meter readings · sorted by reading_date desc (most recent first)
 * deleted_at IS NULL → soft-delete aware
 */
export function useMeterReadings() {
  return useQuery({
    queryKey: ['meter_readings'],
    queryFn: async (): Promise<MeterReading[]> => {
      const { data, error } = await supabase
        .from(TABLE)
        .select('id, data, created_at, updated_at')
        .is('deleted_at', null)
      if (error) throw error
      const rows = (data ?? []) as MeterReading[]
      return [...rows].sort((a, b) => {
        // Sort by reading_date desc (BE string "DD/MM/YYYY")
        const toSortKey = (s: string | undefined) => {
          if (!s || !/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return ''
          const [d, m, y] = s.split('/')
          return `${y}${m}${d}`
        }
        return toSortKey(b.data?.reading_date).localeCompare(
          toSortKey(a.data?.reading_date),
        )
      })
    },
  })
}

/**
 * Fetch meter readings for a specific property
 */
export function useMeterReadingsByProperty(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['meter_readings', 'by-property', propertyId],
    queryFn: async (): Promise<MeterReading[]> => {
      if (!propertyId) return []
      const { data, error } = await supabase
        .from(TABLE)
        .select('id, data, created_at, updated_at')
        .eq('data->>property_id', propertyId)
        .is('deleted_at', null)
      if (error) throw error
      const rows = (data ?? []) as MeterReading[]
      return [...rows].sort((a, b) => {
        const toSortKey = (s: string | undefined) => {
          if (!s || !/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return ''
          const [d, m, y] = s.split('/')
          return `${y}${m}${d}`
        }
        return toSortKey(b.data?.reading_date).localeCompare(
          toSortKey(a.data?.reading_date),
        )
      })
    },
    enabled: !!propertyId,
  })
}

/**
 * Fetch single meter reading by ID
 */
export function useMeterReading(id: string | undefined) {
  return useQuery({
    queryKey: ['meter_readings', id],
    queryFn: async (): Promise<MeterReading | null> => {
      if (!id) return null
      const { data, error } = await supabase
        .from(TABLE)
        .select('id, data, created_at, updated_at')
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle()
      if (error) throw error
      return data as MeterReading | null
    },
    enabled: !!id,
  })
}

/* ---------- helpers ---------- */

export function getMeterTypeLabel(type: MeterType | undefined): string {
  if (type === 'water') return 'น้ำ'
  if (type === 'electricity') return 'ไฟฟ้า'
  if (type === 'other') return 'อื่นๆ'
  return '—'
}
