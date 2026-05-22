import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useBankAccount } from '@/features/bank-accounts/queries'
import { buildContractPdf } from '@/features/contracts/print/contract-pdf'
import { useContract } from '@/features/contracts/queries'
import { useLandlord } from '@/features/landlords/queries'
import { useProperty } from '@/features/properties/queries'
import { useActiveContractTemplate } from '@/features/templates/queries'
import { useTenant } from '@/features/tenants/queries'
import { getPdfBlob } from '@/lib/pdf'

/**
 * Print preview route — full-page iframe ของ PDF blob (ไม่ใช่ modal · ไม่ใช่ tab ใหม่)
 *
 * ตรง Tem rule "ทุกหน้าเปลี่ยนหน้า · ไม่ overlay" + ลูกน้องเห็น preview ก่อน
 * save · MCP browser ก็ดูได้ผ่าน iframe inline ไม่ติด popup block
 */
export function ContractPrint({ id }: { id: string }) {
  const navigate = useNavigate()
  const { data: contract, isLoading } = useContract(id)
  const contractId = contract?.id
  const tenantId = contract?.data?.tenant_id
  const landlordId = contract?.data?.landlord_id
  const bankAccountId = contract?.data?.bankAccountId as string | undefined
  const propertyPid = contract?.data?.pid_property
  const propertyKey = propertyPid != null ? String(propertyPid) : undefined
  const parentId = contract?.data?.parent_contract_id as string | undefined
  const { data: tenant } = useTenant(tenantId)
  const { data: landlord } = useLandlord(landlordId)
  const { data: bank } = useBankAccount(bankAccountId)
  const { data: property } = useProperty(propertyKey)
  const { data: parent } = useContract(parentId)
  const { data: template } = useActiveContractTemplate()

  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfErr, setPdfErr] = useState<string | null>(null)
  const [pdfBuilding, setPdfBuilding] = useState(false)

  useEffect(() => {
    if (!contract) return
    let cancelled = false
    setPdfBuilding(true)
    setPdfErr(null)
    ;(async () => {
      try {
        const doc = buildContractPdf({
          contract,
          tenant: tenant ?? null,
          landlord: landlord ?? null,
          bank: bank ?? null,
          property: property ?? null,
          parent: parent ?? null,
          template: template ?? null,
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
  }, [contract, tenant, landlord, bank, property, parent, template])

  // Cleanup blob URL on unmount/change
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
  }, [pdfUrl])

  const contractNo = contract?.data?.no ?? `#${id}`
  const fileName = `สัญญาเช่า-${contractNo.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`

  return (
    <div className='flex h-svh flex-col bg-muted/30'>
      {/* Toolbar (page-level, no overlay) */}
      <header className='flex items-center justify-between gap-3 border-b bg-card px-4 py-2'>
        <div className='flex items-center gap-2'>
          <Button
            variant='ghost'
            size='icon'
            onClick={() =>
              navigate({
                to: '/contracts/$id',
                params: { id: contractId ?? id },
              })
            }
            aria-label='กลับไปหน้าสัญญา'
          >
            <ArrowLeft className='size-4' />
          </Button>
          <div>
            <h1 className='text-sm font-medium'>ตัวอย่างก่อนพิมพ์</h1>
            <p className='text-xs text-muted-foreground'>
              สัญญา {contractNo}
              {tenant?.data?.name ? ` · ${tenant.data.name}` : ''}
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
                    'contract-pdf-frame',
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
              <Link
                to='/contracts/$id'
                params={{ id: contractId ?? id }}
              >
                <ArrowLeft className='size-4' />
                กลับ
              </Link>
            </Button>
          </div>
        ) : pdfUrl ? (
          <iframe
            id='contract-pdf-frame'
            title={`สัญญา ${contractNo}`}
            src={pdfUrl}
            className='h-full w-full border-0'
          />
        ) : null}
      </div>
    </div>
  )
}
