import { useMemo } from 'react'
import { useContracts, getContractStatus } from '@/features/contracts/queries'
import { useInvoices, daysOverdue } from '@/features/invoices/queries'
import { useValidationScan } from '@/features/validation/queries'
import { amt } from '@/lib/thai'

export type AlertSeverity = 'critical' | 'warning'

export interface AlertStrip {
  id: string
  severity: AlertSeverity
  title: string
  description: string
  count: number
  amount?: number
  to: string
}

/** Central hook — aggregates all actionable alerts from live data. */
export function useAlerts() {
  const { data: contracts } = useContracts()
  const { data: invoices } = useInvoices()
  const { data: issues } = useValidationScan()

  const strips = useMemo<AlertStrip[]>(() => {
    const result: AlertStrip[] = []

    // 1. Overdue invoices (critical)
    const overdueIvs = (invoices ?? []).filter((iv) => {
      const st = (iv.status ?? iv.data?.status ?? '').toLowerCase()
      if (st === 'paid' || st === 'voided') return false
      return daysOverdue(iv) > 0
    })
    if (overdueIvs.length > 0) {
      const overdueAmt = overdueIvs.reduce(
        (s, iv) => s + (Number(iv.data?.remainingAmount ?? iv.data?.total) || 0),
        0,
      )
      result.push({
        id: 'overdue',
        severity: 'critical',
        title: `บิลเกินกำหนด — ${overdueIvs.length} ฉบับ`,
        description: `ค้างรวม ${amt(overdueAmt, { decimal: 0 })} บาท`,
        count: overdueIvs.length,
        amount: overdueAmt,
        to: '/invoices',
      })
    }

    // 2. Data quality errors (critical)
    const dqErrors = (issues ?? []).filter((i) => i.severity === 'error')
    if (dqErrors.length > 0) {
      result.push({
        id: 'dq-errors',
        severity: 'critical',
        title: `ข้อมูลผิดพลาด — ${dqErrors.length} รายการ`,
        description: 'ต้องแก้ไขก่อนใช้งาน · คลิกไปหน้าตรวจสอบข้อมูล',
        count: dqErrors.length,
        to: '/validation',
      })
    }

    // 3. Deposit invoices unpaid (warning)
    const depositUnpaid = (invoices ?? []).filter((iv) => {
      const cat = iv.category ?? iv.data?.category
      const st = (iv.status ?? iv.data?.status ?? '').toLowerCase()
      return cat === 'deposit' && st !== 'paid' && st !== 'voided'
    })
    if (depositUnpaid.length > 0) {
      const depositAmt = depositUnpaid.reduce(
        (s, iv) => s + (Number(iv.data?.remainingAmount ?? iv.data?.total) || 0),
        0,
      )
      result.push({
        id: 'deposit-unpaid',
        severity: 'warning',
        title: `ค้างรับเงินประกัน — ${depositUnpaid.length} ห้อง`,
        description: `รวม ${amt(depositAmt, { decimal: 0 })} บาท · ผู้เช่ายังไม่ได้จ่าย`,
        count: depositUnpaid.length,
        amount: depositAmt,
        to: '/invoices',
      })
    }

    // 4. Deposit return pending (expired/cancelled with deposit > 0 and no paid deposit record)
    const expiredWithDeposit = (contracts ?? []).filter((c) => {
      if (!c.data?.depositAmount || Number(c.data.depositAmount) <= 0) return false
      const st = getContractStatus(c.data)
      return st === 'expired' || c.data?.cancelled === true
    })
    const depositReturnPending = expiredWithDeposit.filter((c) => {
      const hasPaid = (invoices ?? []).some(
        (iv) =>
          iv.contract_id === c.id &&
          (iv.category ?? iv.data?.category) === 'deposit' &&
          (iv.status ?? iv.data?.status ?? '').toLowerCase() === 'paid',
      )
      return !hasPaid
    })
    if (depositReturnPending.length > 0) {
      const retAmt = depositReturnPending.reduce(
        (s, c) => s + (Number(c.data?.depositAmount) || 0),
        0,
      )
      result.push({
        id: 'deposit-return',
        severity: 'warning',
        title: `ประกันค้างคืน — ${depositReturnPending.length} ฉบับ`,
        description: `รวม ${amt(retAmt, { decimal: 0 })} บาท · สัญญาสิ้นสุดแล้วยังไม่คืน`,
        count: depositReturnPending.length,
        amount: retAmt,
        to: '/contracts',
      })
    }

    // 5. Data quality warnings
    const dqWarnings = (issues ?? []).filter((i) => i.severity === 'warning')
    if (dqWarnings.length > 0) {
      result.push({
        id: 'dq-warnings',
        severity: 'warning',
        title: `ข้อมูลไม่ครบ — ${dqWarnings.length} รายการ`,
        description: 'ควรตรวจสอบและแก้ไข · คลิกไปหน้าตรวจสอบข้อมูล',
        count: dqWarnings.length,
        to: '/validation',
      })
    }

    return result
  }, [contracts, invoices, issues])

  const criticalCount = useMemo(
    () => strips.filter((s) => s.severity === 'critical').reduce((s, a) => s + a.count, 0),
    [strips],
  )
  const totalCount = useMemo(() => strips.reduce((s, a) => s + a.count, 0), [strips])

  return { strips, criticalCount, totalCount }
}
