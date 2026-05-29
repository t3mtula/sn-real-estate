import { useMutation, useQueryClient } from '@tanstack/react-query'
import { logActivity } from '@/lib/audit-log'
import { supabase } from '@/lib/supabase'
import { fmtBE, parseBE, parseAmtLoose } from '@/lib/thai'
import type { Contract, ContractData } from '@/features/contracts/types'
import type { Landlord, LandlordData } from '@/features/landlords/types'
import type { Property } from '@/features/properties/types'
import type { Tenant } from '@/features/tenants/types'
import {
  getInvoiceAmount,
  getPaymentFreq,
  isContractDueForMonth,
} from '@/features/invoices/queries'
import { recordPaymentCore, unallocateInvoiceFromPayments } from '@/features/payments/core'
import type { GenerateInvoiceFormValues } from '@/features/invoices/schema'
import type {
  Invoice,
  InvoiceCategory,
  InvoiceData,
  InvoiceItem,
} from '@/features/invoices/types'

const TABLE = 'invoices'

const TH_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]
const TH_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

export class DuplicateInvoiceError extends Error {
  conflictId: string
  conflictNo: string
  constructor(conflictId: string, conflictNo: string) {
    super(`มีใบแจ้งหนี้ของเดือนนี้อยู่แล้ว (${conflictNo})`)
    this.name = 'DuplicateInvoiceError'
    this.conflictId = conflictId
    this.conflictNo = conflictNo
  }
}

/** Compose item description based on frequency · month context */
function buildItemDescription(
  freqType: InvoiceData['freqType'],
  month: string,
  category: InvoiceCategory,
): string {
  if (category === 'deposit') return 'เงินประกัน'
  const [yStr, moStr] = month.split('-')
  const monthNum = Number.parseInt(moStr, 10)
  const yearBE = Number.parseInt(yStr, 10) + 543
  if (freqType === 'monthly') {
    return `ค่าเช่าประจำเดือน ${TH_MONTHS_FULL[monthNum - 1]} ${yearBE}`
  }
  if (freqType === 'quarterly') {
    const qNum = Math.ceil(monthNum / 3)
    const startMo = TH_MONTHS_SHORT[(qNum - 1) * 3]
    const endMo = TH_MONTHS_SHORT[Math.min(qNum * 3 - 1, 11)]
    return `ค่าเช่าไตรมาสที่ ${qNum} (${startMo}-${endMo} ${yearBE})`
  }
  if (freqType === 'semi') {
    const hNum = monthNum <= 6 ? 1 : 2
    const startMo = hNum === 1 ? 'ม.ค.' : 'ก.ค.'
    const endMo = hNum === 1 ? 'มิ.ย.' : 'ธ.ค.'
    return `ค่าเช่าครึ่งปีที่ ${hNum} (${startMo}-${endMo} ${yearBE})`
  }
  if (freqType === 'yearly') {
    return `ค่าเช่าประจำปี ${yearBE}`
  }
  return 'ค่าเช่า (ชำระครั้งเดียว)'
}

/** Reserve next invoice number for a month · "INV-YYYY-MM-NNNN" or "DEP-..." */
async function nextInvoiceNumber(
  month: string,
  prefix: 'INV' | 'DEP',
): Promise<string> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('data')
    .eq('data->>month', month)
  if (error) throw error
  const nums = (data ?? [])
    .map((r: { data: InvoiceData }) => {
      const no = (r.data?.invoiceNo ?? '').trim()
      if (!no.startsWith(`${prefix}-`)) return 0
      const m = no.match(/-(\d+)$/)
      return m ? Number.parseInt(m[1], 10) : 0
    })
    .filter((n: number) => Number.isFinite(n))
  const next = (nums.length === 0 ? 0 : Math.max(...nums)) + 1
  return `${prefix}-${month}-${String(next).padStart(4, '0')}`
}

/** Check duplicate (same contract · same month · same category · not voided) */
async function checkDuplicateInvoice(
  contractId: string,
  month: string,
  category: InvoiceCategory,
): Promise<{ id: string; no: string } | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, status, category, data')
    .eq('contract_id', contractId)
    .eq('data->>month', month)
  if (error) throw error
  const conflict = (data ?? []).find((r: {
    id: string
    status: string | null
    category: string | null
    data: InvoiceData
  }) => {
    if ((r.status ?? '').toLowerCase() === 'voided') return false
    const cat = (r.category ?? r.data?.category ?? 'rent').toLowerCase()
    return cat === category
  })
  if (!conflict) return null
  return {
    id: conflict.id,
    no: ((conflict as { data: InvoiceData }).data?.invoiceNo ?? '').trim(),
  }
}

/**
 * Generate invoice from contract · port of v1 generateInvoice()
 *
 * Caller passes the linked contract / landlord / tenant / property so this
 * mutation stays DB-bounded (no extra fetches).  Mirror v1 behavior:
 *   - reserve invoiceNo per month
 *   - snapshot tenant / landlord / property / VAT mode at issue time
 *   - status starts at 'draft' · paidAmount 0 · remainingAmount = total
 */
export function useGenerateInvoiceFromContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      values: GenerateInvoiceFormValues
      contract: Contract
      tenant?: Tenant | null
      landlord?: Landlord | null
      property?: Property | null
    }): Promise<{ id: string }> => {
      const { values, contract, tenant, landlord, property } = input
      const month = values.month
      const category = values.category ?? 'rent'

      const dup = await checkDuplicateInvoice(contract.id, month, category)
      if (dup) throw new DuplicateInvoiceError(dup.id, dup.no || `#${dup.id}`)

      const prefix = category === 'deposit' ? 'DEP' : 'INV'
      const invoiceNo = await nextInvoiceNumber(month, prefix)

      const freq = getPaymentFreq(contract.data)
      const baseAmount =
        category === 'deposit'
          ? Number(contract.data?.deposit) || 0
          : (values.amount ??
            getInvoiceAmount(
              contract.data?.rate || contract.data?.rateAmount,
              contract.data,
            ))

      // VAT snapshot from landlord (v2)
      const vatMode = (landlord?.data?.vatMode as InvoiceData['vatMode']) ?? 'none'
      const vatRate = Number(landlord?.data?.vatRate) || 0
      const total =
        vatMode === 'exclusive' && vatRate > 0
          ? Number((baseAmount * (1 + vatRate / 100)).toFixed(2))
          : baseAmount

      const items: InvoiceItem[] = [
        {
          desc: values.note?.trim() || buildItemDescription(freq.type, month, category),
          amount: total,
        },
      ]

      // Due date: month + dueDay (clamped to last day of month).
      // If invoice is issued AFTER the natural due date for that month (i.e. back-dated
      // billing), push due date 7 days from issue date so it isn't immediately overdue.
      const [yStr, moStr] = month.split('-')
      const yNum = Number.parseInt(yStr, 10)
      const moNum = Number.parseInt(moStr, 10)
      const lastDay = new Date(yNum, moNum, 0).getDate()
      const dueDay = Math.min(
        Math.max(1, Number(values.dueDay) || 5),
        lastDay,
      )
      const naturalDue = new Date(yNum, moNum - 1, dueDay)
      const now = new Date()
      const issuedLate = now.getTime() > naturalDue.getTime()
      const effectiveDue = issuedLate
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7)
        : naturalDue
      const dueDate = fmtBE(effectiveDue)
      const today = fmtBE(now)

      const pid = Date.now()
      const id = String(pid)
      const data: InvoiceData = {
        id: pid,
        cid: contract.data?.pid ?? contract.id,
        pid: contract.data?.pid_property,
        month,
        invoiceNo,
        date: today,
        dueDate,
        items,
        total,
        bankAccountId:
          values.bankAccountId?.trim() ||
          (contract.data?.bankAccountId as string | undefined),
        headerId:
          (contract.data?.invHeaderId as string | undefined) ?? undefined,
        freqType: freq.type,
        freqLabel: category === 'deposit' ? 'เงินประกัน' : freq.label,
        vatMode,
        vatRate: vatMode === 'none' ? 0 : vatRate,
        vatBase: baseAmount,
        status: 'draft',
        paidAmount: 0,
        remainingAmount: total,
        payments: [],
        tenant: tenant?.data?.name ?? (contract.data?.tenant as string | undefined) ?? '',
        property: property?.data?.name ?? (contract.data?.property as string | undefined) ?? '',
        landlord: landlord?.data?.name ?? (contract.data?.landlord as string | undefined) ?? '',
        category,
        createdAt: new Date().toISOString(),
      }

      const { error } = await supabase
        .from(TABLE)
        .insert({
          id,
          contract_id: contract.id,
          status: 'draft',
          category,
          data,
        })
        .select('id')
        .single()
      if (error) throw error
      void logActivity({
        action: 'create',
        entity: 'invoices',
        entity_id: id,
        description: `ออกใบแจ้งหนี้ ${invoiceNo} · ${data.tenant || '—'} · ${month}`,
        after: { invoiceNo, total, contract_id: contract.id, month, category },
      })
      return { id }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

/** Generic merge helper · used by cancel/update */
async function mergeUpdateInvoice(
  id: string,
  patch: {
    data?: Partial<InvoiceData>
    status?: string
    category?: string
  },
): Promise<void> {
  const { data: existing, error: readError } = await supabase
    .from(TABLE)
    .select('data, status, category')
    .eq('id', id)
    .single()
  if (readError) throw readError

  const existingData = (existing?.data ?? {}) as InvoiceData
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (patch.data) {
    const merged: InvoiceData = { ...existingData, ...patch.data }
    for (const k of Object.keys(patch.data)) {
      if ((patch.data as Record<string, unknown>)[k] === undefined) {
        delete (merged as Record<string, unknown>)[k]
      }
    }
    update.data = merged
  }
  if (patch.status !== undefined) update.status = patch.status
  if (patch.category !== undefined) update.category = patch.category

  const { data: updated, error } = await supabase
    .from(TABLE)
    .update(update)
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (!updated || updated.length === 0) {
    throw new Error('ไม่พบใบแจ้งหนี้ หรือไม่มีสิทธิ์แก้ไข (RLS)')
  }
}

/** Mark invoice as voided · keep original data + audit reason */
export function useCancelInvoice(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { reason: string }) => {
      const today = fmtBE(new Date())
      await mergeUpdateInvoice(id, {
        status: 'voided',
        data: {
          status: 'voided',
          voidedAt: today,
          voidedReason: input.reason?.trim() || '',
        } as Partial<InvoiceData>,
      })
      void logActivity({
        action: 'update',
        entity: 'invoices',
        entity_id: id,
        description: `ยกเลิกใบแจ้งหนี้ · เหตุผล: ${input.reason?.trim() || '(ไม่ระบุ)'}`,
        after: { status: 'voided', voidedReason: input.reason ?? '' },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoices', id] })
    },
  })
}

/** Restore voided invoice */
export function useRestoreInvoice(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data: existing, error } = await supabase
        .from(TABLE)
        .select('data')
        .eq('id', id)
        .single()
      if (error) throw error
      const c = (existing?.data ?? {}) as InvoiceData
      const prevStatus =
        (c.paidAmount ?? 0) >= (c.total ?? 0) && (c.total ?? 0) > 0
          ? 'paid'
          : (c.paidAmount ?? 0) > 0
          ? 'partial'
          : 'sent'
      await mergeUpdateInvoice(id, {
        status: prevStatus,
        data: {
          status: prevStatus,
          voidedAt: undefined,
          voidedReason: undefined,
        } as Partial<InvoiceData>,
      })
      void logActivity({
        action: 'restore',
        entity: 'invoices',
        entity_id: id,
        description: `คืนสถานะใบแจ้งหนี้ → ${prevStatus}`,
        after: { status: prevStatus },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoices', id] })
    },
  })
}

/** Mark invoice as sent (draft → sent) */
export function useMarkInvoiceSent(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await mergeUpdateInvoice(id, {
        status: 'sent',
        data: { status: 'sent' } as Partial<InvoiceData>,
      })
      void logActivity({
        action: 'update',
        entity: 'invoices',
        entity_id: id,
        description: 'บันทึกส่งใบแจ้งหนี้ (draft → sent)',
        after: { status: 'sent' },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoices', id] })
    },
  })
}

/** Inline edit · update editable fields (dueDate · bankAccountId · note) */
export function useUpdateInvoice(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      dueDate?: string
      bankAccountId?: string
      note?: string
    }) => {
      const patch: Partial<InvoiceData> = {}
      if (input.dueDate !== undefined) {
        const trimmed = input.dueDate.trim()
        if (trimmed && !parseBE(trimmed)) {
          throw new Error('วันครบกำหนดไม่ถูกต้อง')
        }
        patch.dueDate = trimmed || undefined
      }
      if (input.bankAccountId !== undefined) {
        patch.bankAccountId = input.bankAccountId.trim() || undefined
      }
      if (input.note !== undefined) {
        patch.note = input.note.trim() || undefined
      }
      await mergeUpdateInvoice(id, { data: patch })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoices', id] })
    },
  })
}

/* ---------- batch: generate all monthly invoices ---------- */

export type BatchGeneratePreview = {
  month: string
  willCreate: Array<{
    contractId: string
    contractNo: string
    tenant: string
    property: string
    amount: number
    rateNote: string
    freqType: string
    hasFreqConflict: boolean
  }>
  willSkip: Array<{
    contractId: string
    contractNo: string
    reason: 'existing' | 'cancelled' | 'not_due' | 'no_dates' | 'no_rate'
    existingNo?: string
  }>
}

/** Inspect what would happen if we run batch-gen for the given month */
export function useBatchGeneratePreview(month: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input?: { tags?: string[]; contractIds?: string[] }): Promise<BatchGeneratePreview> => {
      if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        throw new Error('เดือนไม่ถูกต้อง (YYYY-MM)')
      }
      const filterTags = (input?.tags ?? []).filter(Boolean)
      const idSet = input?.contractIds?.length ? new Set(input.contractIds) : null
      const [contractsRes, invsRes] = await Promise.all([
        supabase.from('contracts').select('id, data'),
        supabase.from(TABLE).select('id, contract_id, status, category, data').eq('data->>month', month),
      ])
      if (contractsRes.error) throw contractsRes.error
      if (invsRes.error) throw invsRes.error
      const contracts = (contractsRes.data ?? []) as Array<{ id: string; data: ContractData }>
      const existingByContract = new Map<string, { invoiceNo: string }>()
      for (const inv of (invsRes.data ?? []) as Invoice[]) {
        if ((inv.status ?? '').toLowerCase() === 'voided') continue
        const cat = (inv.category ?? inv.data?.category ?? 'rent').toLowerCase()
        if (cat !== 'rent') continue
        if (inv.contract_id) {
          existingByContract.set(inv.contract_id, {
            invoiceNo: (inv.data?.invoiceNo ?? '').trim() || `#${inv.id}`,
          })
        }
      }

      const willCreate: BatchGeneratePreview['willCreate'] = []
      const willSkip: BatchGeneratePreview['willSkip'] = []
      for (const c of contracts) {
        const d = c.data ?? {}
        // จำกัดเฉพาะสัญญาที่เลือก (ถ้าระบุ)
        if (idSet && !idSet.has(c.id)) continue
        // กรองตาม tag — สัญญาที่ไม่อยู่ในกลุ่มที่เลือก ตัดออกทั้งหมด (ไม่นับใน total)
        if (filterTags.length > 0) {
          const tags = Array.isArray(d.tags) ? (d.tags as string[]) : []
          if (!filterTags.some((t) => tags.includes(t))) continue
        }
        const contractNo = (d.no ?? '').trim() || `#${c.id}`
        const tenant = ((d.tenant as string | undefined) ?? '').trim() || '—'
        const property = (String(d.property ?? '') as string).trim() || '—'
        if (d.cancelled) {
          willSkip.push({ contractId: c.id, contractNo, reason: 'cancelled' })
          continue
        }
        if (!d.start || !d.end) {
          willSkip.push({ contractId: c.id, contractNo, reason: 'no_dates' })
          continue
        }
        if (!isContractDueForMonth(d, month)) {
          willSkip.push({ contractId: c.id, contractNo, reason: 'not_due' })
          continue
        }
        const existing = existingByContract.get(c.id)
        if (existing) {
          willSkip.push({
            contractId: c.id,
            contractNo,
            reason: 'existing',
            existingNo: existing.invoiceNo,
          })
          continue
        }
        const amount = getInvoiceAmount(
          d.rate || d.rateAmount,
          d,
        )
        if (!amount || amount <= 0) {
          willSkip.push({ contractId: c.id, contractNo, reason: 'no_rate' })
          continue
        }
        const freq = getPaymentFreq(d)
        const rateRaw = d.rate || d.rateAmount
        let rateNote = ''
        let rateUnitMonths = 1
        if (typeof rateRaw === 'string' && rateRaw.trim()) {
          const t = rateRaw.toLowerCase()
          rateUnitMonths =
            t.includes('ปีละ') || t.includes('รายปี') || t.includes('ต่อปี') || t.includes('ทุกปี') ? 12 :
            t.includes('ครึ่งปีละ') || t.includes('ทุก 6 เดือน') ? 6 :
            t.includes('ไตรมาสละ') || t.includes('รายไตรมาส') || t.includes('ทุก 3 เดือน') ? 3 : 1
          const r = parseAmtLoose(rateRaw)
          if (Number.isFinite(r) && r > 0) {
            const unitLabel = rateUnitMonths === 12 ? 'ปีละ' : rateUnitMonths === 6 ? 'ครึ่งปีละ' : rateUnitMonths === 3 ? 'ไตรมาสละ' : 'เดือนละ'
            rateNote = `${unitLabel} ฿${r.toLocaleString('th-TH', { maximumFractionDigits: 0 })}`
          }
        } else if (typeof rateRaw === 'number' && rateRaw > 0) {
          rateNote = `฿${rateRaw.toLocaleString('th-TH', { maximumFractionDigits: 0 })}`
        }
        willCreate.push({
          contractId: c.id,
          contractNo,
          tenant,
          property,
          amount,
          rateNote,
          freqType: freq.type ?? 'monthly',
          hasFreqConflict: rateUnitMonths > freq.months,
        })
      }
      return { month, willCreate, willSkip }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export type BatchGenerateResult = {
  month: string
  created: number
  skipped: number
  errors: Array<{ contractNo: string; message: string }>
}

/**
 * Bulk-generate monthly invoices · port of v1 generateAllInvoices()
 *
 * - Reuses isContractDueForMonth + getInvoiceAmount
 * - Skips contracts that already have a non-voided rent invoice for the month
 * - Reserves invoice numbers locally (single starting offset · then increment)
 *   to avoid race-y per-row count queries
 * - Sequential insert (await each) — small batches (typically <200 contracts)
 *   so latency is acceptable + we get predictable ordering
 */
export function useGenerateMonthlyInvoices() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { month: string; dueDay?: number; tags?: string[]; contractIds?: string[] }): Promise<BatchGenerateResult> => {
      const month = input.month
      if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        throw new Error('เดือนไม่ถูกต้อง (YYYY-MM)')
      }
      const dueDay = Math.min(Math.max(1, input.dueDay ?? 5), 31)
      const filterTags = (input.tags ?? []).filter(Boolean)
      const idSet = input.contractIds?.length ? new Set(input.contractIds) : null

      const [contractsRes, invsRes, landlordsRes] = await Promise.all([
        supabase.from('contracts').select('id, data'),
        supabase.from(TABLE).select('id, contract_id, status, category, data').eq('data->>month', month),
        supabase.from('landlords').select('id, data'),
      ])
      if (contractsRes.error) throw contractsRes.error
      if (invsRes.error) throw invsRes.error
      if (landlordsRes.error) throw landlordsRes.error

      const contracts = (contractsRes.data ?? []) as Array<{ id: string; data: ContractData }>
      const landlordById = new Map<string, LandlordData>()
      for (const l of (landlordsRes.data ?? []) as Array<{ id: string; data: LandlordData }>) {
        landlordById.set(l.id, l.data)
      }
      const existingByContract = new Set<string>()
      let maxNum = 0
      for (const inv of (invsRes.data ?? []) as Invoice[]) {
        const no = (inv.data?.invoiceNo ?? '').trim()
        const m = no.match(/^INV-.*-(\d+)$/)
        if (m) {
          const n = Number.parseInt(m[1], 10)
          if (Number.isFinite(n) && n > maxNum) maxNum = n
        }
        if ((inv.status ?? '').toLowerCase() === 'voided') continue
        const cat = (inv.category ?? inv.data?.category ?? 'rent').toLowerCase()
        if (cat !== 'rent') continue
        if (inv.contract_id) existingByContract.add(inv.contract_id)
      }

      const [yStr, moStr] = month.split('-')
      const yNum = Number.parseInt(yStr, 10)
      const moNum = Number.parseInt(moStr, 10)
      const lastDay = new Date(yNum, moNum, 0).getDate()
      const today = fmtBE(new Date())

      let created = 0
      let skipped = 0
      const errors: BatchGenerateResult['errors'] = []
      let nextNum = maxNum + 1

      for (const c of contracts) {
        const d = c.data ?? {}
        // จำกัดเฉพาะสัญญาที่เลือก (ต้องตรงกับ preview)
        if (idSet && !idSet.has(c.id)) continue
        // กรองตาม tag — ต้องตรงกับ preview (ตัดออกทั้งหมด ไม่นับ skip)
        if (filterTags.length > 0) {
          const tags = Array.isArray(d.tags) ? (d.tags as string[]) : []
          if (!filterTags.some((t) => tags.includes(t))) continue
        }
        const contractNo = (d.no ?? '').trim() || `#${c.id}`
        if (d.cancelled) {
          skipped++
          continue
        }
        if (!isContractDueForMonth(d, month)) {
          skipped++
          continue
        }
        if (existingByContract.has(c.id)) {
          skipped++
          continue
        }
        const baseAmount = getInvoiceAmount(
          d.rate || d.rateAmount,
          d,
        )
        if (!baseAmount || baseAmount <= 0) {
          skipped++
          continue
        }

        const landlordId = (d.landlord_id ?? '') as string
        const landlord = landlordId ? landlordById.get(landlordId) : undefined
        const vatMode = (landlord?.vatMode as InvoiceData['vatMode']) ?? 'none'
        const vatRate = Number(landlord?.vatRate) || 0
        const total =
          vatMode === 'exclusive' && vatRate > 0
            ? Number((baseAmount * (1 + vatRate / 100)).toFixed(2))
            : baseAmount

        const freq = getPaymentFreq(d)
        const invoiceNo = `INV-${month}-${String(nextNum).padStart(4, '0')}`
        nextNum++

        const contractDueDay = Number(d.dueDay) || dueDay
        const day = Math.min(Math.max(1, contractDueDay), lastDay)
        const dueDate = fmtBE(new Date(yNum, moNum - 1, day))

        const items: InvoiceItem[] = [
          {
            desc: buildItemDescription(freq.type, month, 'rent'),
            amount: total,
          },
        ]
        const pid = Date.now() + created
        const id = String(pid)
        const data: InvoiceData = {
          id: pid,
          cid: d.pid ?? c.id,
          pid: d.pid_property,
          month,
          invoiceNo,
          date: today,
          dueDate,
          items,
          total,
          bankAccountId: d.bankAccountId as string | undefined,
          headerId: d.invHeaderId as string | undefined,
          freqType: freq.type,
          freqLabel: freq.label,
          vatMode,
          vatRate: vatMode === 'none' ? 0 : vatRate,
          vatBase: baseAmount,
          status: 'draft',
          paidAmount: 0,
          remainingAmount: total,
          payments: [],
          tenant: (d.tenant as string | undefined) ?? '',
          property: (d.property as string | undefined) ?? '',
          landlord: landlord?.name ?? (d.landlord as string | undefined) ?? '',
          category: 'rent',
          createdAt: new Date().toISOString(),
        }
        const { error } = await supabase
          .from(TABLE)
          .insert({
            id,
            contract_id: c.id,
            status: 'draft',
            category: 'rent',
            data,
          })
        if (error) {
          errors.push({ contractNo, message: error.message })
        } else {
          created++
          existingByContract.add(c.id)
        }
      }
      if (created > 0) {
        void logActivity({
          action: 'create',
          entity: 'invoices',
          entity_id: month,
          description: `สร้างใบแจ้งหนี้รายเดือน ${month} · ${created} ใบ`
            + (errors.length > 0 ? ` · ผิดพลาด ${errors.length} ใบ` : ''),
          after: { month, created, skipped, errors: errors.length },
        })
      }
      return { month, created, skipped, errors }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

/* ---------- batch: mark sent + void ---------- */

export type BatchActionResult = {
  done: number
  errors: Array<{ id: string; message: string }>
}

export function useBatchMarkSent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]): Promise<BatchActionResult> => {
      let done = 0
      const errors: BatchActionResult['errors'] = []
      for (const id of ids) {
        try {
          await mergeUpdateInvoice(id, {
            status: 'sent',
            data: { status: 'sent' } as Partial<InvoiceData>,
          })
          done++
        } catch (err) {
          errors.push({ id, message: err instanceof Error ? err.message : String(err) })
        }
      }
      if (done > 0) {
        void logActivity({
          action: 'update',
          entity: 'invoices',
          description: `บันทึกส่งใบแจ้งหนี้ ${done} ใบ` + (errors.length ? ` · ผิดพลาด ${errors.length}` : ''),
        })
      }
      return { done, errors }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export function useBatchVoid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { ids: string[]; reason: string }): Promise<BatchActionResult> => {
      const today = fmtBE(new Date())
      let done = 0
      const errors: BatchActionResult['errors'] = []
      for (const id of input.ids) {
        try {
          await mergeUpdateInvoice(id, {
            status: 'voided',
            data: {
              status: 'voided',
              voidedAt: today,
              voidedReason: input.reason?.trim() || '',
            } as Partial<InvoiceData>,
          })
          done++
        } catch (err) {
          errors.push({ id, message: err instanceof Error ? err.message : String(err) })
        }
      }
      if (done > 0) {
        void logActivity({
          action: 'update',
          entity: 'invoices',
          description: `ยกเลิกใบแจ้งหนี้ ${done} ใบ · เหตุผล: ${input.reason?.trim() || '(ไม่ระบุ)'}`,
        })
      }
      return { done, errors }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

/** Hard delete (rare · prefer void) — for cleaning up mistakes */
export function useDeleteInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: before } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
      // ปลดการจับคู่เงินที่ผูกกับใบนี้ก่อน (เงินไม่หาย → กลายเป็น "ยังไม่จับคู่")
      await unallocateInvoiceFromPayments(id)
      const { error } = await supabase.from(TABLE).delete().eq('id', id)
      if (error) throw error
      void logActivity({
        action: 'delete',
        entity: 'invoices',
        entity_id: id,
        description: `ลบถาวร ใบแจ้งหนี้ #${id}`,
        before: before as Record<string, unknown> | null,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

// ── Record payment ───────────────────────────────────────────────────────────
//
// เงินทุกก้อนเก็บใน `payments` table ที่เดียว (single source of truth)
// receiptNo / taxInvoiceNo / paidAmount ของ invoice ถูก recompute ใน
// recordPaymentCore → recomputeInvoiceMirror (ดู features/payments/core.ts)

/**
 * Record a payment (full or partial) against ONE invoice.
 * เขียนลง payments table แล้ว recompute ยอดของ invoice นั้น (กัน split-brain)
 */
export function useRecordPayment(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      amount: number
      method: string
      date: string
      ref?: string
      note?: string
    }) => {
      await recordPaymentCore({
        date: input.date,
        amount: input.amount,
        payMethod: input.method,
        slipRef: input.ref,
        notes: input.note,
        invoice_ids: [id],
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoices', id] })
      qc.invalidateQueries({ queryKey: ['payments'] })
    },
  })
}

// ── Batch payment result type ────────────────────────────────────────────────

export type BatchPaymentResult = {
  done: number
  totalCollected: number
  errors: Array<{ id: string; message: string }>
}

/**
 * Batch record payment — mark multiple invoices paid in one action.
 *
 * แต่ละใบจ่ายเต็มจำนวน (remaining → 0) ผ่าน recordPaymentCore (payments table = SSOT)
 * → ได้ payment 1 แถวต่อใบ + recompute ยอด/receiptNo/taxInvoiceNo ให้เอง
 * ใบที่จ่ายครบแล้ว/ยกเลิกแล้ว ถูกข้ามเงียบ ๆ
 */
export function useBatchRecordPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      ids: string[]
      date: string
      method: string
      ref?: string
      note?: string
    }): Promise<BatchPaymentResult> => {
      // 1. Fetch all target invoices
      const { data: rows, error: fetchErr } = await supabase
        .from(TABLE)
        .select('id, data, status, category')
        .in('id', input.ids)
      if (fetchErr) throw fetchErr

      // 2. Filter to payable (skip paid / voided)
      const payable = (rows ?? []).filter((r) => {
        const s = ((r as { status: string | null }).status ?? '').toLowerCase()
        return s !== 'paid' && s !== 'voided'
      })
      if (payable.length === 0) throw new Error('ไม่มีใบที่รอรับเงินในรายการที่เลือก')

      // 3. Record one payment per invoice (full remaining) via the single core writer
      let done = 0
      let totalCollected = 0
      const errors: BatchPaymentResult['errors'] = []

      for (const row of payable) {
        const invoiceId = row.id as string
        const d = (row as { data: InvoiceData }).data ?? {}
        const remaining = d.remainingAmount != null
          ? d.remainingAmount
          : Math.max((d.total ?? 0) - (d.paidAmount ?? 0), 0)
        if (remaining <= 0) continue

        try {
          await recordPaymentCore({
            date: input.date,
            amount: remaining,
            payMethod: input.method,
            slipRef: input.ref,
            notes: input.note,
            invoice_ids: [invoiceId],
          })
          done++
          totalCollected += remaining
        } catch (err) {
          errors.push({ id: invoiceId, message: err instanceof Error ? err.message : String(err) })
        }
      }

      return { done, totalCollected, errors }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
    },
  })
}

/** Set or clear follow-up date + note on an invoice */
export function useSetFollowUp(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { followUpDate: string; followUpNote: string }) => {
      await mergeUpdateInvoice(id, {
        data: {
          followUpDate: input.followUpDate.trim() || undefined,
          followUpNote: input.followUpNote.trim() || undefined,
        } as Partial<InvoiceData>,
      })
      void logActivity({
        action: 'update',
        entity: 'invoices',
        entity_id: id,
        description: input.followUpDate.trim()
          ? `ตั้งวันนัดชำระ ${input.followUpDate.trim()}${input.followUpNote.trim() ? ` · ${input.followUpNote.trim()}` : ''}`
          : 'ลบวันนัดชำระ',
        after: { followUpDate: input.followUpDate, followUpNote: input.followUpNote },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoices', id] })
    },
  })
}

/**
 * Auto-void expired draft invoices — port of v1 autoVoidExpiredDrafts()
 *
 * Finds all 'draft' invoices older than `days` days (using Supabase `created_at`
 * first, fallback to `data.date` BE string) and marks them voided.
 *
 * Called once per app session from the invoices page useEffect.
 * Also callable manually from invoice settings.
 *
 * Config comes from app_settings[invoice]: draftVoidEnabled, draftVoidDays
 */
export function useAutoVoidExpiredDrafts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (opts?: { enabled?: boolean; days?: number }): Promise<number> => {
      const enabled = opts?.enabled ?? true
      if (!enabled) return 0
      const days = opts?.days ?? 60
      const cutoff = new Date(Date.now() - days * 864e5).toISOString()

      // Fetch drafts whose created_at is old enough (fast path via indexed column)
      const { data, error } = await supabase
        .from(TABLE)
        .select('id, data, created_at')
        .eq('status', 'draft')
        .lt('created_at', cutoff)
      if (error) throw error

      const rows = data ?? []
      if (rows.length === 0) return 0

      const nowISO = new Date().toISOString()
      const voidReason = `ร่างค้างเกิน ${days} วัน (auto)`
      let count = 0

      for (const row of rows) {
        try {
          const d = (row as { data: InvoiceData }).data ?? {}
          await mergeUpdateInvoice(row.id as string, {
            status: 'voided',
            data: {
              status: 'voided',
              voidedAt: nowISO,
              voidedReason: voidReason,
            } as Partial<InvoiceData>,
          })
          void logActivity({
            action: 'update',
            entity: 'invoices',
            entity_id: row.id as string,
            description: `ยกเลิกร่างอัตโนมัติ (ค้าง > ${days} วัน) · ${(d.invoiceNo as string | undefined) ?? ''}`,
            after: { status: 'voided', voidedReason: voidReason },
          })
          count++
        } catch (_err) {
          // Best-effort — don't abort entire run for one failure
        }
      }

      if (count > 0) {
        void logActivity({
          action: 'update',
          entity: 'invoices',
          description: `ยกเลิกใบร่างอัตโนมัติ ${count} ฉบับ (ค้าง > ${days} วัน)`,
        })
      }
      return count
    },
    onSuccess: (count) => {
      if (count > 0) qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

/**
 * Send ALL draft invoices (global) — port of v1 sendAllDraftsGlobal()
 *
 * Marks every 'draft' invoice in the system as 'sent', regardless of month.
 * Intended for initial setup / end-of-month bulk send.
 * Returns count of invoices sent.
 */
export function useSendAllDraftsGlobal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<BatchActionResult> => {
      // Fetch all draft IDs
      const { data, error } = await supabase
        .from(TABLE)
        .select('id')
        .eq('status', 'draft')
      if (error) throw error
      const ids = (data ?? []).map((r: { id: string }) => r.id)
      if (ids.length === 0) return { done: 0, errors: [] }

      let done = 0
      const errors: BatchActionResult['errors'] = []
      for (const id of ids) {
        try {
          await mergeUpdateInvoice(id, {
            status: 'sent',
            data: { status: 'sent' } as Partial<InvoiceData>,
          })
          done++
        } catch (err) {
          errors.push({ id, message: err instanceof Error ? err.message : String(err) })
        }
      }
      if (done > 0) {
        void logActivity({
          action: 'update',
          entity: 'invoices',
          description: `ส่งใบแจ้งหนี้ร่างทั้งหมด ${done} ใบ` + (errors.length ? ` · ผิดพลาด ${errors.length}` : ''),
        })
      }
      return { done, errors }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export type { Invoice }
