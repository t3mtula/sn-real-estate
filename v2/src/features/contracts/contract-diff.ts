import type { ContractData } from '@/features/contracts/types'

export type DiffItem = { label: string; from: string; to: string }

const TRACKED: Array<{ key: keyof ContractData; label: string }> = [
  { key: 'no', label: 'เลขที่สัญญา' },
  { key: 'tenant', label: 'ผู้เช่า' },
  { key: 'tenantAddr', label: 'ที่อยู่ผู้เช่า' },
  { key: 'taxId', label: 'เลขผู้เสียภาษี' },
  { key: 'landlord', label: 'ผู้ให้เช่า' },
  { key: 'landlordAddr', label: 'ที่อยู่ผู้ให้เช่า' },
  { key: 'start', label: 'วันเริ่ม' },
  { key: 'end', label: 'วันสิ้นสุด' },
  { key: 'rate', label: 'ค่าเช่า' },
  { key: 'rateAmount', label: 'ค่าเช่า (จำนวน)' },
  { key: 'rateIntervalMonths', label: 'ความถี่ชำระ' },
  { key: 'billingStart', label: 'วันเริ่มเก็บ' },
  { key: 'deposit', label: 'เงินประกัน' },
  { key: 'payment', label: 'รอบชำระ' },
  { key: 'dur', label: 'ระยะสัญญา' },
  { key: 'madeDate', label: 'วันที่ทำสัญญา' },
  { key: 'madeAt', label: 'สถานที่ทำสัญญา' },
  { key: 'wit1', label: 'พยานคนที่ 1' },
  { key: 'wit2', label: 'พยานคนที่ 2' },
  { key: 'cancelled', label: 'ยกเลิก' },
  { key: 'cancelledDate', label: 'วันที่ยกเลิก' },
  { key: 'cancelledReason', label: 'เหตุผลยกเลิก' },
  { key: 'noticeDate', label: 'วันแจ้งออก' },
  { key: 'plannedMoveOut', label: 'วันที่วางแผนออก' },
  { key: 'closed', label: 'ปิดสัญญา' },
  { key: 'bankAccountId', label: 'บัญชีธนาคาร' },
]

function toStr(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'ใช่' : 'ไม่'
  return String(v).trim() || '—'
}

export function diffContractData(before: unknown, after: unknown): DiffItem[] {
  const b = (before ?? {}) as Record<string, unknown>
  const a = (after ?? {}) as Record<string, unknown>
  const diffs: DiffItem[] = []
  for (const { key, label } of TRACKED) {
    const bStr = toStr(b[key])
    const aStr = toStr(a[key])
    if (bStr !== aStr) {
      diffs.push({ label, from: bStr, to: aStr })
    }
  }
  return diffs
}
