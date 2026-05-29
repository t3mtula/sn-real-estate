import { useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { toast } from 'sonner'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { ContractForm } from '@/features/contracts/components/contract-form'
import { CONTRACT_FORM_DEFAULTS, type ContractFormValues } from '@/features/contracts/schema'
import {
  DuplicateContractNoError,
  useCreateContract,
} from '@/features/contracts/mutations'
import { useContract } from '@/features/contracts/queries'
import { BackButton } from '@/components/yonghua/back-button'
import { Route } from '@/routes/_authenticated/contracts/new'

export function ContractNew() {
  const search = Route.useSearch()
  const renewFromId = search.renewFrom
  const copyFromId = search.copyFrom
  const sourceId = renewFromId ?? copyFromId

  const { data: sourceContract, isLoading: sourceLoading } = useContract(sourceId)
  const create = useCreateContract()
  const navigate = useNavigate()

  const mode = renewFromId ? 'renew' : copyFromId ? 'copy' : 'create'
  const sourceNo = sourceContract?.data?.no ?? ''

  // Build defaultValues from source contract (memoized on sourceContract)
  const defaultValues = useMemo<ContractFormValues>(() => {
    if (!sourceContract) return CONTRACT_FORM_DEFAULTS
    const d = sourceContract.data
    return {
      ...CONTRACT_FORM_DEFAULTS,
      no: '', // always blank — user fills or auto-gen
      pid_property: d.pid_property ? String(d.pid_property) : '',
      tenant_id: d.tenant_id ?? '',
      landlord_id: d.landlord_id ?? '',
      bankAccountId: d.bankAccountId ?? '',
      parent_contract_id: '',
      templateId: d.templateId ?? '',
      start: '',
      end: '',
      dur: 0,
      rate: typeof d.rate === 'string' ? d.rate : '',
      rateAmount: d.rateAmount ?? 0,
      rateIntervalMonths: d.rateIntervalMonths ?? 1,
      billingStart: '',
      deposit: typeof d.deposit === 'number' ? d.deposit : 0,
      payment: d.payment ?? '',
      purpose: (d.purpose as string) ?? 'พักอาศัย',
      tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
      spot: d.spot ?? '',
      dueDay: d.dueDay ?? 5,
      rateAdj: d.rateAdj ?? '',
      madeAtLine: d.madeAtLine ?? '',
      madeAtSubdistrict: d.madeAtSubdistrict ?? '',
      madeAtDistrict: d.madeAtDistrict ?? '',
      madeAtProvince: d.madeAtProvince ?? '',
      madeAtPostal: d.madeAtPostal ?? '',
      madeDate: '',
      wit1: d.wit1 ?? '',
      wit2: d.wit2 ?? '',
    }
  }, [sourceContract])

  // If loading source, show spinner
  if (sourceId && sourceLoading) {
    return (
      <div className='p-8 text-center text-muted-foreground'>กำลังโหลด...</div>
    )
  }

  const title =
    mode === 'renew' ? 'ต่อสัญญา' : mode === 'copy' ? 'คัดลอกสัญญา' : 'สร้างสัญญาใหม่'
  const subtitle =
    mode === 'create'
      ? 'กรอกข้อมูลสัญญา · เลือกผู้เช่า/ผู้ให้เช่า/ทรัพย์/บัญชี'
      : 'ข้อมูลถูกเติมมาจากสัญญาต้นทาง · กรุณาใส่เลขสัญญาใหม่ วันเริ่ม-สิ้นสุด'

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-6'>
        <header className='flex items-center gap-3'>
          <BackButton fallback='/contracts' />
          <div>
            <h1 className='text-2xl font-semibold tracking-tight'>{title}</h1>
            <p className='text-muted-foreground text-sm'>{subtitle}</p>
          </div>
        </header>

        {/* Banner */}
        {mode === 'renew' && sourceNo && (
          <div className='rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200'>
            ต่อสัญญาจาก:{' '}
            <strong>{sourceNo}</strong> · ข้อมูลถูกเติมให้แล้ว · กรุณาใส่เลขสัญญาใหม่
            วันเริ่ม-สิ้นสุด
          </div>
        )}
        {mode === 'copy' && sourceNo && (
          <div className='rounded-md border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-800 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-200'>
            คัดลอกจาก: <strong>{sourceNo}</strong> · ข้อมูลถูกเติมให้แล้ว ·
            กรุณาใส่เลขสัญญาใหม่
          </div>
        )}

        <div className='max-w-4xl'>
          <ContractForm
            mode='create'
            defaultValues={defaultValues}
            renewedFromNo={mode === 'renew' ? sourceNo : undefined}
            submitting={create.isPending}
            onCancel={() => navigate({ to: '/contracts' })}
            onSubmit={async (values, inline) => {
              try {
                const { id } = await create.mutateAsync({
                  values,
                  inline,
                  meta: {
                    renewedFrom: renewFromId,
                    copiedFrom: copyFromId,
                    contractClauses: sourceContract?.data?.contractClauses,
                  },
                })
                navigate({ to: '/contracts/$id', params: { id } })
              } catch (err) {
                if (err instanceof DuplicateContractNoError) {
                  toast.error('เลขสัญญาซ้ำ', {
                    description: `เลขนี้อยู่ในสัญญาของ "${err.conflictTenant}"`,
                    action: {
                      label: 'ดู',
                      onClick: () =>
                        navigate({
                          to: '/contracts/$id',
                          params: { id: err.conflictId },
                        }),
                    },
                  })
                  return
                }
                throw err
              }
            }}
          />
        </div>
      </Main>
    </>
  )
}
