import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useBankAccount } from '@/features/bank-accounts/queries'
import { useContract } from '@/features/contracts/queries'
import { useInvoice } from '@/features/invoices/queries'
import { buildInvoicePdf } from '@/features/invoices/print/invoice-pdf'
import { useLandlord } from '@/features/landlords/queries'
import { useProperty } from '@/features/properties/queries'
import { useTenant } from '@/features/tenants/queries'
import { getPdfBlob } from '@/lib/pdf'

/**
 * Invoice print preview · iframe of PDF blob.
 * Pattern mirrors /contracts/$id/print.
 */
export function InvoicePrint({ id }: { id: string }) {
  const navigate = useNavigate()
  const { data: invoice, isLoading } = useInvoice(id)

  const contractId = invoice?.contract_id ?? undefined
  const { data: contract } = useContract(contractId ?? undefined)
  const landlordId = contract?.data?.landlord_id
  const tenantId = contract?.data?.tenant_id
  const bankAccountId =
    invoice?.data?.bankAccountId ||
    (contract?.data?.bankAccountId as string | undefined)
  const propertyPid =
    invoice?.data?.pid ?? contract?.data?.pid_property
  const propertyKey = propertyPid != null ? String(propertyPid) : undefined

  const { data: landlord } = useLandlord(landlordId)
  const { data: tenant } = useTenant(tenantId)
  const { data: bank } = useBankAccount(bankAccountId)
  const { data: property } = useProperty(propertyKey)

  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfErr, setPdfErr] = useState<string | null>(null)
  const [pdfBuilding, setPdfBuilding] = useState(false)

  useEffect(() => {
    if (!invoice) return
    let cancelled = false
    setPdfBuilding(true)
    setPdfErr(null)
    ;(async () => {
      try {
        const doc = buildInvoicePdf({
          invoice,
          contract: contract ?? null,
          tenant: tenant ?? null,
          landlord: landlord ?? null,
          property: property ?? null,
          bank: bank ?? null,
        })
        const blob = await getPdfBlob(doc)
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        setPdfUrl(url)
      } catch (err) {
        if (cancelled) return
        setPdfErr(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setPdfBuilding(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [invoice, contract, tenant, landlord, property, bank])

  // Cleanup blob URL on unmount/change
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
  }, [pdfUrl])

  const invoiceNo = invoice?.data?.invoiceNo ?? `#${id}`
  const fileName = `ใบแจ้งหนี้-${invoiceNo.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`

  return (
    <div className='flex h-svh flex-col bg-muted/30'>
      {/* Toolbar */}
      <header className='flex items-center justify-between gap-3 border-b bg-card px-4 py-2'>
        <div className='flex items-center gap-2'>
          <Button
            variant='ghost'
            size='icon'
            onClick={() => navigate({ to: '/invoices/$id', params: { id } })}
            aria-label='กลับไปหน้าใบแจ้งหนี้'
          >
            <ArrowLeft className='size-4' />
          </Button>
          <div>
            <h1 className='text-sm font-medium'>ตัวอย่างใบแจ้งหนี้</h1>
            <p className='text-xs text-muted-foreground'>
              {invoiceNo}
              {invoice?.data?.tenant ? ` · ${invoice.data.tenant}` : ''}
            </p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          {pdfUrl && (
            <>
              <Button asChild variant='outline' size='sm'>
                <a href={pdfUrl} download={fileName}>
                  <Download className='size-4' />
                  ดาวน์โหลด PDF
                </a>
              </Button>
              <Button
                size='sm'
                onClick={() => {
                  const iframe = document.getElementById(
                    'invoice-pdf-frame',
                  ) as HTMLIFrameElement | null
                  iframe?.contentWindow?.print()
                }}
              >
                <Printer className='size-4' />
                สั่งพิมพ์
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Body */}
      <div className='flex-1 overflow-hidden'>
        {isLoading || pdfBuilding ? (
          <div className='flex h-full items-center justify-center text-sm text-muted-foreground'>
            กำลังสร้างเอกสาร...
          </div>
        ) : pdfErr ? (
          <div className='m-4 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive'>
            <p className='font-medium'>สร้างไฟล์ PDF ไม่สำเร็จ</p>
            <p className='mt-1 text-xs'>{pdfErr}</p>
            <Button asChild variant='outline' size='sm' className='mt-3'>
              <Link to='/invoices/$id' params={{ id }}>
                <ArrowLeft className='size-4' />
                กลับ
              </Link>
            </Button>
          </div>
        ) : pdfUrl ? (
          <iframe
            id='invoice-pdf-frame'
            title={`ใบแจ้งหนี้ ${invoiceNo}`}
            src={pdfUrl}
            className='h-full w-full border-0'
          />
        ) : null}
      </div>
    </div>
  )
}
