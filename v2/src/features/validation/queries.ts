import { useQuery } from '@tanstack/react-query'
import { useContracts } from '@/features/contracts/queries'
import { useInvoices } from '@/features/invoices/queries'
import { useTenants } from '@/features/tenants/queries'
import { useLandlords } from '@/features/landlords/queries'
import { useProperties } from '@/features/properties/queries'
import { useBankAccounts } from '@/features/bank-accounts/queries'

export type InlineEditSpec =
  | { type: 'tenant-taxid'; currentValue: string }
  | { type: 'contract-made-at'; currentValue: string }

export type ValidationIssue = {
  entity: 'contract' | 'invoice' | 'tenant' | 'landlord' | 'property' | 'bank_account'
  entityId: string
  entityLabel: string
  severity: 'error' | 'warning' | 'info'
  rule: string
  detail: string
  link?: { to: string; params: Record<string, string> }
  /** ถ้ามี → แสดงปุ่ม "แก้ตรงนี้" แทน/เพิ่มจาก "ดู →" */
  inlineEdit?: InlineEditSpec
}

/** Run all validation rules client-side and return list of issues. */
export function useValidationScan() {
  const { data: contracts } = useContracts()
  const { data: invoices } = useInvoices()
  const { data: tenants } = useTenants()
  const { data: landlords } = useLandlords()
  const { data: properties } = useProperties()
  const { data: banks } = useBankAccounts()

  return useQuery({
    queryKey: [
      'validation-scan',
      contracts?.length,
      invoices?.length,
      tenants?.length,
      landlords?.length,
      properties?.length,
      banks?.length,
    ],
    enabled: !!(contracts && invoices && tenants && landlords && properties && banks),
    queryFn: () => {
      const issues: ValidationIssue[] = []

      // 1. Contract without bankAccountId
      for (const c of contracts ?? []) {
        if (c.data?.cancelled) continue
        if (!c.data?.bankAccountId || String(c.data.bankAccountId).trim() === '') {
          issues.push({
            entity: 'contract',
            entityId: c.id,
            entityLabel: c.data?.no ?? c.id,
            severity: 'error',
            rule: 'missing-bank',
            detail: 'ยังไม่ได้ระบุบัญชีรับโอน — ใบแจ้งหนี้จะออกโดยไม่มีเลขบัญชี',
            link: { to: '/contracts/$id', params: { id: c.id } },
          })
        }
        if (!c.data?.tenant_id || String(c.data.tenant_id).trim() === '') {
          issues.push({
            entity: 'contract',
            entityId: c.id,
            entityLabel: c.data?.no ?? c.id,
            severity: 'warning',
            rule: 'missing-tenant-link',
            detail: 'ไม่ได้ลิงก์กับผู้เช่าใน DB (ใช้ชื่อแทน) — แก้สัญญาแล้วเลือกผู้เช่า',
            link: { to: '/contracts/$id', params: { id: c.id } },
          })
        }
        if (!c.data?.landlord_id || String(c.data.landlord_id).trim() === '') {
          issues.push({
            entity: 'contract',
            entityId: c.id,
            entityLabel: c.data?.no ?? c.id,
            severity: 'warning',
            rule: 'missing-landlord-link',
            detail: 'ไม่ได้ลิงก์กับผู้ให้เช่าใน DB',
            link: { to: '/contracts/$id', params: { id: c.id } },
          })
        }
        if (!c.data?.end || String(c.data.end).trim() === '') {
          issues.push({
            entity: 'contract',
            entityId: c.id,
            entityLabel: c.data?.no ?? c.id,
            severity: 'error',
            rule: 'missing-end-date',
            detail: 'ไม่มีวันสิ้นสุดสัญญา',
            link: { to: '/contracts/$id', params: { id: c.id } },
          })
        }
      }

      // 2. Tenant — taxId checksum (basic length)
      for (const t of tenants ?? []) {
        const tax = (t.data?.taxId ?? '').replace(/\D/g, '')
        if (tax && tax.length !== 13) {
          issues.push({
            entity: 'tenant',
            entityId: t.id,
            entityLabel: t.data?.name ?? t.id,
            severity: 'warning',
            rule: 'invalid-taxid-length',
            detail: `เลขผู้เสียภาษี ${tax} ไม่ใช่ 13 หลัก`,
            link: { to: '/tenants/$id', params: { id: t.id } },
            inlineEdit: { type: 'tenant-taxid', currentValue: t.data?.taxId ?? '' },
          })
        }
      }

      // 3. Landlord without VAT info when used in invoices
      // skip for now — complex, low priority

      // 4. Property without owner
      for (const p of properties ?? []) {
        const owner = p.data?.ownerLandlordId
        if (!owner || String(owner).trim() === '') {
          issues.push({
            entity: 'property',
            entityId: p.id,
            entityLabel: (p.data?.name as string) ?? p.id,
            severity: 'info',
            rule: 'missing-owner',
            detail: 'ทรัพย์สินไม่มีเจ้าของในระบบ (ผู้ให้เช่า)',
            link: { to: '/properties/$id', params: { id: p.id } },
          })
        }
      }

      // 5. Invoices without bankAccountId snapshot AND contract also lacks
      for (const iv of invoices ?? []) {
        const ivBank = iv.data?.bankAccountId
        if (ivBank && String(ivBank).trim() !== '') continue
        const c = contracts?.find((x) => x.id === iv.contract_id)
        const cBank = c?.data?.bankAccountId
        if (!cBank || String(cBank).trim() === '') {
          issues.push({
            entity: 'invoice',
            entityId: iv.id,
            entityLabel: iv.data?.invoiceNo ?? iv.id,
            severity: 'warning',
            rule: 'invoice-no-bank',
            detail: 'ใบแจ้งหนี้นี้และสัญญาที่ผูกอยู่ไม่มีบัญชีรับโอน',
            link: { to: '/invoices/$id', params: { id: iv.id } },
          })
        }
      }

      // 6. Contract — madeAt empty or has no address component
      const HAS_ADDR = /ต\.|อ\.|จ\.|แขวง|เขต|กทม|กรุงเทพ|ซอย|หมู่/
      for (const c of contracts ?? []) {
        if (c.data?.cancelled) continue
        const madeAt = String(c.data?.madeAt ?? '').trim()
        if (!madeAt) {
          issues.push({
            entity: 'contract',
            entityId: c.id,
            entityLabel: c.data?.no ?? c.id,
            severity: 'warning',
            rule: 'missing-made-at',
            detail: 'ไม่ได้ระบุสถานที่ทำสัญญา — ต้องระบุก่อน print สัญญา',
            link: { to: '/contracts/$id', params: { id: c.id } },
            inlineEdit: { type: 'contract-made-at', currentValue: '' },
          })
        } else if (!HAS_ADDR.test(madeAt)) {
          issues.push({
            entity: 'contract',
            entityId: c.id,
            entityLabel: c.data?.no ?? c.id,
            severity: 'warning',
            rule: 'incomplete-made-at',
            detail: `สถานที่ทำสัญญา "${madeAt}" ไม่มีที่อยู่ — ต้องระบุทั้งชื่อและที่อยู่`,
            link: { to: '/contracts/$id', params: { id: c.id } },
            inlineEdit: { type: 'contract-made-at', currentValue: madeAt },
          })
        }
      }

      return issues
    },
  })
}
