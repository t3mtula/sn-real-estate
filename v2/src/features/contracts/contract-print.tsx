import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Printer } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { useBankAccount } from '@/features/bank-accounts/queries'
import { buildContractHtml } from '@/features/contracts/print/contract-html'
import { useContract } from '@/features/contracts/queries'
import { useLandlord } from '@/features/landlords/queries'
import { useProperty } from '@/features/properties/queries'
import { useActiveContractTemplate, useContractTemplate } from '@/features/templates/queries'
import { useTenant } from '@/features/tenants/queries'

/**
 * Print preview route — full-page iframe ของเอกสาร HTML (ไม่ใช่ modal · ไม่ใช่ tab ใหม่)
 *
 * ใช้ตัวสร้าง HTML ตัวเดียวกับหน้าแก้ template + ปุ่มพิมพ์ในหน้าสัญญา
 * → พิมพ์ที่ไหนหน้าตาก็ตรงกัน · browser จัดหน้า + "บันทึก PDF" ได้แบบ Word
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
  const contractTemplateId = contract?.data?.templateId as string | undefined
  const { data: tenant } = useTenant(tenantId)
  const { data: landlord } = useLandlord(landlordId)
  const { data: bank } = useBankAccount(bankAccountId)
  const { data: property } = useProperty(propertyKey)
  const { data: parent } = useContract(parentId)
  const { data: activeTemplate } = useActiveContractTemplate()
  const { data: specificTemplate } = useContractTemplate(contractTemplateId)
  const template = contractTemplateId ? specificTemplate : activeTemplate

  const html = useMemo(() => {
    if (!contract) return null
    return buildContractHtml(
      {
        contract,
        tenant: tenant ?? null,
        landlord: landlord ?? null,
        bank: bank ?? null,
        property: property ?? null,
        parent: parent ?? null,
        template: template ?? null,
      },
      { embed: true }, // toolbar อยู่ที่ header ของ route แล้ว
    )
  }, [contract, tenant, landlord, bank, property, parent, template])

  const contractNo = contract?.data?.no ?? `#${id}`

  function handlePrint() {
    const iframe = document.getElementById(
      'contract-print-frame',
    ) as HTMLIFrameElement | null
    iframe?.contentWindow?.print()
  }

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
        {html && (
          <div className='flex items-center gap-2'>
            <Button size='sm' onClick={handlePrint}>
              <Printer className='size-4' />
              พิมพ์ / บันทึก PDF
            </Button>
          </div>
        )}
      </header>

      {/* Body */}
      <div className='flex-1 overflow-hidden'>
        {isLoading || !contract ? (
          <div className='flex h-full items-center justify-center text-sm text-muted-foreground'>
            กำลังสร้างเอกสาร...
          </div>
        ) : html ? (
          <iframe
            id='contract-print-frame'
            title={`สัญญา ${contractNo}`}
            srcDoc={html}
            className='h-full w-full border-0'
          />
        ) : (
          <div className='m-4 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive'>
            <p className='font-medium'>สร้างเอกสารไม่สำเร็จ</p>
            <Button asChild variant='outline' size='sm' className='mt-3'>
              <Link to='/contracts/$id' params={{ id: contractId ?? id }}>
                <ArrowLeft className='size-4' />
                กลับ
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
