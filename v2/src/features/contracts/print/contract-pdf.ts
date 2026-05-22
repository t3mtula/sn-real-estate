/**
 * Contract PDF — minimal smoke test
 *
 * Building block by block. Current state: bare minimum doc to verify the
 * pdfmake pipeline (fonts + render + blob) actually produces a PDF for our
 * Thai content. Once this works we layer back parties · property · clauses
 * (from default-template.ts) · signatures.
 */

import type { TDocumentDefinitions } from '@/lib/pdf'
import type { BankAccount } from '@/features/bank-accounts/types'
import type { Contract } from '@/features/contracts/types'
import type { Landlord } from '@/features/landlords/types'
import type { Property } from '@/features/properties/types'
import type { Tenant } from '@/features/tenants/types'

type Refs = {
  contract: Contract
  tenant?: Tenant | null
  landlord?: Landlord | null
  property?: Property | null
  bank?: BankAccount | null
  parent?: Contract | null
}

export function buildContractPdf(refs: Refs): TDocumentDefinitions {
  const c = refs.contract
  const contractNo = (c.data.no ?? '').trim() || `#${c.id}`

  return {
    info: {
      title: `สัญญาเช่า ${contractNo}`,
      author: 'SN Real Estate',
    },
    pageSize: 'A4',
    pageMargins: [50, 60, 50, 50],

    content: [
      {
        text: 'สัญญาเช่า',
        fontSize: 24,
        bold: true,
        color: '#0f4c5c',
        alignment: 'center',
        margin: [0, 0, 0, 4],
      },
      {
        text: `เลขที่ ${contractNo}`,
        alignment: 'center',
        fontSize: 14,
        color: '#475569',
        margin: [0, 0, 0, 24],
      },
      {
        text: 'ทดสอบ Thai content · ระบบสร้าง PDF ได้สำเร็จ',
        fontSize: 14,
        alignment: 'center',
        italics: true,
        color: '#64748b',
      },
    ],
  }
}
