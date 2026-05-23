/**
 * InvoiceRowPreview — loads refs, builds invoice/receipt HTML, opens the
 * centered PrintOverlay directly from the invoices list. `kind` selects
 * which document to render — invoice (default) or receipt.
 */

import { useEffect, useState } from 'react'
import { PrintOverlay } from '@/components/print-overlay'
import { useBankAccount } from '@/features/bank-accounts/queries'
import { useContract } from '@/features/contracts/queries'
import {
  buildInvoiceHtml,
  buildReceiptHtml,
} from '@/features/invoices/print/invoice-html'
import { useInvoice } from '@/features/invoices/queries'
import { useLandlord } from '@/features/landlords/queries'
import { useProperty } from '@/features/properties/queries'
import { useTenant } from '@/features/tenants/queries'

export type InvoicePreviewKind = 'invoice' | 'receipt'

type Props = {
  id: string | null
  kind: InvoicePreviewKind
  onClose: () => void
}

export function InvoiceRowPreview({ id, kind, onClose }: Props) {
  const { data: invoice } = useInvoice(id ?? undefined)
  const contract = useContract(invoice?.contract_id ?? undefined)
  const tenant = useTenant(contract.data?.data?.tenant_id)
  const landlord = useLandlord(contract.data?.data?.landlord_id)
  const bankAccountId =
    (invoice?.data?.bankAccountId ?? contract.data?.data?.bankAccountId) as
      | string
      | undefined
  const bank = useBankAccount(bankAccountId)
  const propertyId = contract.data?.data?.pid_property?.toString()
  const property = useProperty(propertyId)

  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    if (!id || !invoice) {
      setHtml(null)
      return
    }
    let cancelled = false
    const refs = {
      invoice,
      contract: contract.data ?? null,
      tenant: tenant.data ?? null,
      landlord: landlord.data ?? null,
      property: property.data ?? null,
      bank: bank.data ?? null,
    }
    ;(async () => {
      try {
        const out =
          kind === 'invoice' ? await buildInvoiceHtml(refs) : await buildReceiptHtml(refs)
        if (!cancelled) setHtml(out)
      } catch {
        if (!cancelled) setHtml('<html><body style="padding:40px;font-family:Sarabun">สร้างตัวอย่างไม่สำเร็จ</body></html>')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, kind, invoice, contract.data, tenant.data, landlord.data, property.data, bank.data])

  const data = invoice?.data
  const isDeposit = (data?.category ?? 'rent') === 'deposit'
  const docNo = (kind === 'receipt'
    ? ((data as { receiptNo?: string } | undefined)?.receiptNo ?? data?.invoiceNo)
    : data?.invoiceNo) ?? id ?? ''
  const docKind =
    kind === 'receipt'
      ? isDeposit
        ? 'ใบรับเงินประกัน'
        : 'ใบเสร็จรับเงิน'
      : 'ใบแจ้งหนี้'
  const title = `${docKind} ${docNo}`
  const downloadName = `${docKind}-${String(docNo).replace(/[/\\?%*:|"<>]/g, '_')}.html`

  return (
    <PrintOverlay
      open={!!id}
      html={html}
      title={title}
      downloadName={downloadName}
      onClose={onClose}
    />
  )
}
