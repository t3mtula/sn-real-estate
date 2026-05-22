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
        text: 'TEST CONTRACT',
        fontSize: 22,
        bold: true,
        alignment: 'center',
      },
      {
        text: `No. ${contractNo}`,
        alignment: 'center',
        fontSize: 12,
        margin: [0, 8, 0, 0],
      },
    ],

    defaultStyle: {
      // Helvetica is pdfmake's built-in default · doesn't need vfs
      font: 'Helvetica',
      fontSize: 11,
    },
  }
}
