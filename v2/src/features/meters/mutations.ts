import { useMutation, useQueryClient } from '@tanstack/react-query'
import { logActivity } from '@/lib/audit-log'
import { supabase } from '@/lib/supabase'
import type { MeterReadingFormValues } from '@/features/meters/schema'
import type { MeterReadingData } from '@/features/meters/types'

const TABLE = 'meter_readings'

/** Calculate derived fields from form values */
function calcDerived(values: MeterReadingFormValues): {
  units: number
  total: number
} {
  const units = Math.max(0, values.curr_reading - values.prev_reading)
  const fixed = values.fixed_fee ?? 0
  const total = units * values.rate_per_unit + fixed
  return { units, total }
}

function valuesToData(values: MeterReadingFormValues): MeterReadingData {
  const { units, total } = calcDerived(values)
  return {
    property_id: values.property_id,
    property_name: values.property_name,
    contract_id: values.contract_id || undefined,
    type: values.type,
    meter_no: values.meter_no || undefined,
    reading_date: values.reading_date,
    prev_reading: values.prev_reading,
    curr_reading: values.curr_reading,
    units,
    rate_per_unit: values.rate_per_unit,
    fixed_fee: values.fixed_fee ?? 0,
    total,
    notes: values.notes || undefined,
    billed: values.billed ?? false,
    invoice_id: values.invoice_id || undefined,
  }
}

/**
 * Create new meter reading
 */
export function useCreateMeterReading() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: MeterReadingFormValues) => {
      const meterData = valuesToData(values)
      const { data: inserted, error } = await supabase
        .from(TABLE)
        .insert({ data: meterData })
        .select('id')
        .single()
      if (error) throw error
      const id = inserted.id as string
      void logActivity({
        action: 'create',
        entity: 'meter_readings',
        entity_id: id,
        description: `บันทึกมิเตอร์${meterData.type === 'water' ? 'น้ำ' : meterData.type === 'electricity' ? 'ไฟฟ้า' : ''} · ${meterData.property_name} · ${meterData.reading_date} · ${meterData.units} หน่วย`,
        after: {
          property_name: meterData.property_name,
          type: meterData.type,
          reading_date: meterData.reading_date,
          units: meterData.units,
          total: meterData.total,
        },
      })
      return { id }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meter_readings'] })
    },
  })
}

/**
 * Update existing meter reading — re-calculates units and total
 */
export function useUpdateMeterReading(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: MeterReadingFormValues) => {
      const { data: existing, error: readError } = await supabase
        .from(TABLE)
        .select('data')
        .eq('id', id)
        .single()
      if (readError) throw readError

      const existingData = (existing?.data ?? {}) as MeterReadingData
      const newData = valuesToData(values)
      const merged: MeterReadingData = { ...existingData, ...newData }

      const { data: updated, error } = await supabase
        .from(TABLE)
        .update({ data: merged, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('id')
      if (error) throw error
      if (!updated || updated.length === 0) {
        throw new Error('ไม่พบข้อมูลมิเตอร์ หรือไม่มีสิทธิ์แก้ไข (RLS)')
      }
      void logActivity({
        action: 'update',
        entity: 'meter_readings',
        entity_id: id,
        description: `แก้ไขมิเตอร์ · ${merged.property_name} · ${merged.reading_date}`,
        before: {
          prev_reading: existingData.prev_reading,
          curr_reading: existingData.curr_reading,
          units: existingData.units,
          total: existingData.total,
        },
        after: {
          prev_reading: merged.prev_reading,
          curr_reading: merged.curr_reading,
          units: merged.units,
          total: merged.total,
        },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meter_readings'] })
      qc.invalidateQueries({ queryKey: ['meter_readings', id] })
    },
  })
}

/**
 * Delete meter reading (hard delete with audit log)
 */
export function useDeleteMeterReading() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: existing } = await supabase
        .from(TABLE)
        .select('data')
        .eq('id', id)
        .maybeSingle()
      const { error } = await supabase.from(TABLE).delete().eq('id', id)
      if (error) throw error
      const d = existing?.data as MeterReadingData | undefined
      void logActivity({
        action: 'delete',
        entity: 'meter_readings',
        entity_id: id,
        description: `ลบมิเตอร์ · ${d?.property_name ?? ''} · ${d?.reading_date ?? '#' + id}`,
        before: (existing?.data ?? null) as Record<string, unknown> | null,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meter_readings'] })
    },
  })
}

/**
 * จดมิเตอร์ทีละหลายห้องรวดเดียว (จากหน้าตาราง grid) — insert array ครั้งเดียว
 * รับ MeterReadingData ที่คำนวณ units/total มาแล้ว
 */
export function useBulkCreateMeterReadings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (items: MeterReadingData[]) => {
      if (items.length === 0) return { count: 0 }
      const { error } = await supabase
        .from(TABLE)
        .insert(items.map((data) => ({ data })))
      if (error) throw error
      void logActivity({
        action: 'create',
        entity: 'meter_readings',
        entity_id: `bulk-${items.length}`,
        description: `จดมิเตอร์รวม ${items.length} รายการ`,
        after: { count: items.length },
      })
      return { count: items.length }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meter_readings'] })
    },
  })
}
