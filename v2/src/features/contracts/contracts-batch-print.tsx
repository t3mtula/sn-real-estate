import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useBankAccounts } from '@/features/bank-accounts/queries'
import {
  buildContractsBatchPdf,
  type Refs,
} from '@/features/contracts/print/contract-pdf'
import { useContracts } from '@/features/contracts/queries'
import { useLandlords } from '@/features/landlords/queries'
import { useProperties } from '@/features/properties/queries'
import {
  useActiveContractTemplate,
  useContractTemplates,
} from '@/features/templates/queries'
import { useTenants } from '@/features/tenants/queries'
import { getPdfBlob } from '@/lib/pdf'

/**
 * พิมพ์หลายสัญญาเป็นไฟล์เดียว — full-page iframe (ตรง pattern ContractPrint)
 * รับ ids จาก search param `ids=a,b,c`
 */
export function ContractsBatchPrint({ ids }: { ids: string[] }) {
  const navigate = useNavigate()
  const { data: contracts } = useContracts()
  const { data: tenants } = useTenants()
  const { data: landlords } = useLandlords()
  const { data: properties } = useProperties()
  const { data: banks } = useBankAccounts()
  const { data: templates } = useContractTemplates()
  const { data: activeTemplate } = useActiveContractTemplate()

  const ready =
    !!contracts && !!tenants && !!landlords && !!properties && !!banks && !!templates

  const refsList = useMemo<Refs[]>(() => {
    if (!ready) return []
    const byId = <T extends { id: string }>(arr: T[]) =>
      new Map(arr.map((x) => [x.id, x]))
    const tenantMap = byId(tenants!)
    const landlordMap = byId(landlords!)
    const bankMap = byId(banks!)
    const tplMap = byId(templates!)
    const contractById = byId(contracts!)
    const propByPid = new Map(
      properties!.map((p) => [String(p.data?.pid ?? p.id), p]),
    )
    return ids
      .map((id) => contractById.get(id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .map((contract) => {
        const d = contract.data ?? {}
        const tplId = d.templateId as string | undefined
        return {
          contract,
          tenant: d.tenant_id ? tenantMap.get(d.tenant_id) ?? null : null,
          landlord: d.landlord_id ? landlordMap.get(d.landlord_id) ?? null : null,
          bank: d.bankAccountId
            ? bankMap.get(d.bankAccountId as string) ?? null
            : null,
          property:
            d.pid_property != null
              ? propByPid.get(String(d.pid_property)) ?? null
              : null,
          parent: d.parent_contract_id
            ? contractById.get(d.parent_contract_id) ?? null
            : null,
          template: tplId ? tplMap.get(tplId) ?? activeTemplate ?? null : activeTemplate ?? null,
        }
      })
  }, [ready, ids, contracts, tenants, landlords, properties, banks, templates, activeTemplate])

  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfErr, setPdfErr] = useState<string | null>(null)
  const [building, setBuilding] = useState(false)

  useEffect(() => {
    if (!ready || refsList.length === 0) return
    let cancelled = false
    setBuilding(true)
    setPdfErr(null)
    ;(async () => {
      try {
        const doc = buildContractsBatchPdf(refsList)
        const blob = await getPdfBlob(doc)
        if (cancelled) return
        setPdfUrl(URL.createObjectURL(blob))
      } catch (err) {
        if (cancelled) return
        setPdfErr(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setBuilding(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ready, refsList])

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
  }, [pdfUrl])

  return (
    <div className='flex h-svh flex-col bg-muted/30'>
      <header className='flex items-center justify-between gap-3 border-b bg-card px-4 py-2'>
        <div className='flex items-center gap-2'>
          <Button
            variant='ghost'
            size='icon'
            onClick={() => navigate({ to: '/contracts' })}
            aria-label='กลับไปหน้ารายการสัญญา'
          >
            <ArrowLeft className='size-4' />
          </Button>
          <div>
            <h1 className='text-sm font-medium'>พิมพ์สัญญาเป็นกลุ่ม</h1>
            <p className='text-xs text-muted-foreground'>
              {refsList.length} ฉบับในไฟล์เดียว
            </p>
          </div>
        </div>
        {pdfUrl && (
          <div className='flex items-center gap-2'>
            <Button asChild variant='outline' size='sm'>
              <a href={pdfUrl} download={`สัญญาเช่า-รวม-${refsList.length}ฉบับ.pdf`}>
                <Download className='size-4' />
                ดาวน์โหลด PDF
              </a>
            </Button>
            <Button
              size='sm'
              onClick={() => {
                const iframe = document.getElementById(
                  'contracts-batch-pdf-frame',
                ) as HTMLIFrameElement | null
                iframe?.contentWindow?.print()
              }}
            >
              <Printer className='size-4' />
              สั่งพิมพ์
            </Button>
          </div>
        )}
      </header>

      <div className='flex-1 overflow-hidden'>
        {!ready || building ? (
          <div className='flex h-full items-center justify-center text-sm text-muted-foreground'>
            กำลังสร้างเอกสาร {refsList.length || ids.length} ฉบับ...
          </div>
        ) : refsList.length === 0 ? (
          <div className='flex h-full items-center justify-center text-sm text-muted-foreground'>
            ไม่พบสัญญาที่เลือก
          </div>
        ) : pdfErr ? (
          <div className='m-4 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive'>
            <p className='font-medium'>สร้างไฟล์ PDF ไม่สำเร็จ</p>
            <p className='mt-1 text-xs'>{pdfErr}</p>
          </div>
        ) : pdfUrl ? (
          <iframe
            id='contracts-batch-pdf-frame'
            title='พิมพ์สัญญาเป็นกลุ่ม'
            src={pdfUrl}
            className='h-full w-full border-0'
          />
        ) : null}
      </div>
    </div>
  )
}
