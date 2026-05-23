/**
 * ContractRowPreview — invisible component that, when given a contract id,
 * loads all the refs needed, builds the v1-style HTML, and pops the
 * centered PrintOverlay. Used directly from the contracts list "preview"
 * row button so users can see the printable contract without navigating
 * to the full detail page first.
 */

import { useMemo } from 'react'
import { PrintOverlay } from '@/components/print-overlay'
import { useBankAccount } from '@/features/bank-accounts/queries'
import { useContract } from '@/features/contracts/queries'
import { buildContractHtml } from '@/features/contracts/print/contract-html'
import { useLandlord } from '@/features/landlords/queries'
import { useProperty } from '@/features/properties/queries'
import { useActiveContractTemplate } from '@/features/templates/queries'
import { useTenant } from '@/features/tenants/queries'

type Props = {
  id: string | null
  onClose: () => void
}

export function ContractRowPreview({ id, onClose }: Props) {
  const { data: contract } = useContract(id ?? undefined)
  const tenant = useTenant(contract?.data?.tenant_id)
  const landlord = useLandlord(contract?.data?.landlord_id)
  const bank = useBankAccount(contract?.data?.bankAccountId)
  const propertyId = (contract?.data?.pid_property ?? contract?.data?.pid)?.toString()
  const property = useProperty(propertyId)
  const template = useActiveContractTemplate()

  const html = useMemo(() => {
    if (!id || !contract) return null
    return buildContractHtml({
      contract,
      tenant: tenant.data ?? null,
      landlord: landlord.data ?? null,
      bank: bank.data ?? null,
      property: property.data ?? null,
      parent: null,
      template: template.data ?? null,
    })
  }, [id, contract, tenant.data, landlord.data, bank.data, property.data, template.data])

  const c = contract?.data
  const no = c?.no ?? id ?? ''
  const title = `สัญญาเช่า ${no}`
  const downloadName = `สัญญา-${no.replace(/[/\\?%*:|"<>]/g, '_')}.html`

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
