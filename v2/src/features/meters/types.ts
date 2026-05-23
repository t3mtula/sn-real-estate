/**
 * Meter Reading type definitions
 *
 * Storage: Supabase `public.meter_readings` table — id (text) + data (jsonb) + timestamps.
 *
 * บันทึกการอ่านมิเตอร์น้ำ/ไฟฟ้า รายเดือนต่อทรัพย์สิน
 * Staff กรอก ก่อน/หลัง → ระบบคำนวณหน่วยและยอดให้อัตโนมัติ
 */

export type MeterType = 'water' | 'electricity' | 'other'

export type MeterReadingData = {
  /** FK to properties.id (Supabase UUID string) */
  property_id: string
  /** ชื่อทรัพย์สิน (cache สำหรับ display เร็ว) */
  property_name: string
  /** FK to contracts.id (optional · กรณีผูกกับสัญญาใดสัญญาหนึ่ง) */
  contract_id?: string
  /** ประเภทมิเตอร์ */
  type: MeterType
  /** หมายเลขมิเตอร์ (serial number · optional) */
  meter_no?: string
  /** วันที่อ่านมิเตอร์ "DD/MM/YYYY" BE format */
  reading_date: string
  /** ค่ามิเตอร์ก่อนหน้า (หน่วย) */
  prev_reading: number
  /** ค่ามิเตอร์ปัจจุบัน (หน่วย) */
  curr_reading: number
  /** หน่วยที่ใช้ = curr_reading - prev_reading (คำนวณอัตโนมัติ) */
  units: number
  /** ราคาต่อหน่วย (บาท) */
  rate_per_unit: number
  /** ค่าบริการคงที่ (บาท · optional · default 0) */
  fixed_fee?: number
  /** ยอดรวม = (units * rate_per_unit) + fixed_fee */
  total: number
  /** หมายเหตุ */
  notes?: string
  /** เรียกเก็บแล้วหรือยัง (รวมในใบแจ้งหนี้แล้ว) */
  billed?: boolean
  /** FK to invoices.id — กรอกเมื่อ billed=true */
  invoice_id?: string
}

/** Meter Reading row จาก Supabase */
export type MeterReading = {
  id: string
  data: MeterReadingData
  created_at: string | null
  updated_at: string | null
}
