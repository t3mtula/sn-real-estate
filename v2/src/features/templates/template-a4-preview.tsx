/**
 * Template A4 Preview — renders the **real PDF** from pdfmake (same code path
 * as /contracts/$id/print) so what you see in the editor === what comes out
 * of the printer. No HTML/CSS approximation.
 *
 * Implementation:
 *   1. Build a fake `Contract` + fake `Tenant`/`Landlord`/`Property`/`BankAccount`
 *      with sample data the user can recognize.
 *   2. Wrap the draft template in a `ContractTemplate` shape and call
 *      `buildContractPdf({ contract, template, ...refs })`.
 *   3. `getPdfBlob(doc)` → object URL → render in <iframe>.
 *   4. Debounce regeneration on draft changes (500ms) so typing in the
 *      editor doesn't hammer pdfmake every keystroke.
 *   5. Revoke previous object URL on cleanup.
 */

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { buildContractPdf } from '@/features/contracts/print/contract-pdf'
import type { BankAccount } from '@/features/bank-accounts/types'
import type { Contract } from '@/features/contracts/types'
import type { Landlord } from '@/features/landlords/types'
import type { Property } from '@/features/properties/types'
import type { Tenant } from '@/features/tenants/types'
import { getPdfBlob } from '@/lib/pdf'
import type { ContractTemplate, TemplateData } from './types'

interface Props {
  draft: TemplateData
}

/* ─────────── sample data — recognizable Thai names ─────────── */

const SAMPLE_CONTRACT: Contract = {
  id: 'preview',
  data: {
    pid: 0,
    no: 'SN.69-00001',
    tenant: 'นายสมชาย ใจดี',
    tenantAddr: '99/9 ถ.พระราม 4 แขวงสาทร เขตสาทร กรุงเทพฯ 10120',
    taxId: '1100800123456',
    landlord: 'บริษัท สมบัตินภา จำกัด',
    landlordAddr: '88 ถ.ราชบุรี-บ้านโป่ง ต.บ้านโป่ง อ.บ้านโป่ง จ.ราชบุรี 70110',
    start: '01/01/2569',
    end: '31/12/2570',
    rate: 10000,
    deposit: 30000,
    payment: 'เดือนละ',
    dur: 24,
    madeAt: 'จังหวัดราชบุรี',
    madeDate: '01/01/2569',
    wit1: 'นางสาวพยาน หนึ่ง',
    wit2: 'นายพยาน สอง',
  },
  created_at: null,
  updated_at: null,
}

const SAMPLE_TENANT: Tenant = {
  id: 'preview-tenant',
  data: {
    name: 'นายสมชาย ใจดี',
    partyType: 'person',
    taxId: '1100800123456',
    phone: '081-234-5678',
    addrLine: '99/9 ถ.พระราม 4',
    addrSubdistrict: 'สาทร',
    addrDistrict: 'สาทร',
    addrProvince: 'กรุงเทพฯ',
    addrPostal: '10120',
  },
  created_at: null,
  updated_at: null,
}

const SAMPLE_LANDLORD: Landlord = {
  id: 'preview-landlord',
  data: {
    name: 'บริษัท สมบัตินภา จำกัด',
    partyType: 'company',
    taxId: '0105556012345',
    phone: '032-211-345',
    signerName: 'นายเจ้าของ สมบัตินภา',
    signerTitle: 'กรรมการผู้จัดการ',
    addrLine: '88 ถ.ราชบุรี-บ้านโป่ง',
    addrSubdistrict: 'บ้านโป่ง',
    addrDistrict: 'บ้านโป่ง',
    addrProvince: 'ราชบุรี',
    addrPostal: '70110',
  },
  created_at: null,
  updated_at: null,
}

const SAMPLE_PROPERTY: Property = {
  id: 'preview-property',
  data: {
    name: 'อาคารพาณิชย์ 3 ชั้น เลขที่ 12/3',
    type: 'shophouse',
    location: 'ราชบุรี',
    area: '4 ตร.วา (16 ตร.ม.)',
    titleDeed: 'โฉนดเลขที่ 12345',
    addr_line: '12/3 ถ.ทรงพล',
    addr_subdistrict: 'บ้านโป่ง',
    addr_district: 'บ้านโป่ง',
    addr_province: 'ราชบุรี',
    addr_postal: '70110',
  } as Property['data'],
  created_at: null,
  updated_at: null,
}

const SAMPLE_BANK: BankAccount = {
  id: 'preview-bank',
  data: {
    bank: 'ธนาคารกรุงเทพ',
    branch: 'บ้านโป่ง',
    acctNo: '123-4-56789-0',
    accountName: 'บริษัท สมบัตินภา จำกัด',
  },
  created_at: null,
  updated_at: null,
}

/* ─────────── main component ─────────── */

export function TemplateA4Preview({ draft }: Props) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [building, setBuilding] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const urlRef = useRef<string | null>(null)

  // Debounce regeneration on draft changes (500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      let cancelled = false
      setBuilding(true)
      setErr(null)

      // Build a ContractTemplate wrapper around the draft
      const template: ContractTemplate = {
        id: 'preview-template',
        data: draft,
        is_active: false,
        created_at: null,
        updated_at: null,
      }

      ;(async () => {
        try {
          const doc = buildContractPdf({
            contract: SAMPLE_CONTRACT,
            tenant: SAMPLE_TENANT,
            landlord: SAMPLE_LANDLORD,
            bank: SAMPLE_BANK,
            property: SAMPLE_PROPERTY,
            parent: null,
            template,
          })
          const blob = await getPdfBlob(doc)
          if (cancelled) return
          const url = URL.createObjectURL(blob)
          // Revoke the previous URL before replacing
          if (urlRef.current) URL.revokeObjectURL(urlRef.current)
          urlRef.current = url
          setPdfUrl(url)
        } catch (e) {
          if (cancelled) return
          setErr(e instanceof Error ? e.message : String(e))
        } finally {
          if (!cancelled) setBuilding(false)
        }
      })()

      return () => {
        cancelled = true
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [draft])

  // Final cleanup of blob URL on unmount
  useEffect(() => {
    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current)
        urlRef.current = null
      }
    }
  }, [])

  return (
    <div className='flex h-full flex-col'>
      {/* toolbar */}
      <div className='mb-3 flex items-center gap-2'>
        <span className='text-sm font-medium text-muted-foreground'>
          A4 Preview · PDF จริง
        </span>
        {building && (
          <span className='flex items-center gap-1 text-xs text-muted-foreground'>
            <Loader2 className='size-3 animate-spin' />
            กำลังสร้าง...
          </span>
        )}
        <span className='ml-auto text-xs text-muted-foreground'>
          ตัวอย่างใช้ข้อมูลสมมุติ
        </span>
      </div>

      {/* iframe area */}
      <div className='flex-1 overflow-hidden rounded-md border bg-muted/30'>
        {err ? (
          <div className='m-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive'>
            <p className='font-medium'>สร้าง PDF ไม่สำเร็จ</p>
            <p className='mt-1'>{err}</p>
          </div>
        ) : pdfUrl ? (
          <iframe
            title='Contract template preview'
            src={pdfUrl}
            className='h-full w-full border-0'
          />
        ) : (
          <div className='flex h-full items-center justify-center text-sm text-muted-foreground'>
            <Loader2 className='mr-2 size-4 animate-spin' />
            กำลังสร้างเอกสาร...
          </div>
        )}
      </div>
    </div>
  )
}
