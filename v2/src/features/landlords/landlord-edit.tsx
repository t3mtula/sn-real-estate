import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { LandlordForm } from '@/features/landlords/components/landlord-form'
import { useLandlord } from '@/features/landlords/queries'
import {
  DuplicateTaxIdError,
  useUpdateLandlord,
} from '@/features/landlords/mutations'
import {
  EMPTY_BANK_ROW,
  LANDLORD_FORM_DEFAULTS,
  type LandlordFormValues,
} from '@/features/landlords/schema'

export function LandlordEdit({ id }: { id: string }) {
  const landlord = useLandlord(id)
  const update = useUpdateLandlord(id)
  const navigate = useNavigate()

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
          <Button variant='ghost' size='icon' asChild>
            <Link to='/landlords/$id' params={{ id }} aria-label='กลับ'>
              <ArrowLeft className='size-4' />
            </Link>
          </Button>
          <div>
            <h1 className='text-2xl font-semibold tracking-tight'>
              แก้ไขข้อมูลผู้ให้เช่า
            </h1>
            <p className='text-muted-foreground text-sm'>
              {landlord.data?.data?.name ?? 'กำลังโหลด...'}
            </p>
          </div>
        </header>

        <div className='max-w-4xl'>
          {landlord.isLoading ? (
            <Skeleton className='h-96 w-full' />
          ) : !landlord.data ? (
            <Card>
              <CardHeader>
                <CardTitle>ไม่พบผู้ให้เช่า</CardTitle>
              </CardHeader>
              <CardContent className='text-sm text-muted-foreground'>
                ผู้ให้เช่า ID{' '}
                <code className='rounded bg-muted px-1.5 py-0.5'>{id}</code>{' '}
                ไม่มีในระบบ
              </CardContent>
            </Card>
          ) : (
            (() => {
              const t = landlord.data.data
              const banksFromData = (t.banks ?? []).map((b) => ({
                bank: b.bank ?? '',
                acctNo: b.acctNo ?? '',
                accountName: b.accountName ?? '',
                label: b.label ?? '',
              }))
              const defaults: LandlordFormValues = {
                ...LANDLORD_FORM_DEFAULTS,
                name: t.name ?? '',
                shortName: t.shortName ?? '',
                partyType: t.partyType === 'company' ? 'company' : 'person',
                taxId: t.taxId ?? '',
                branch: t.branch ?? '00000',
                phone: t.phone ?? '',
                signerName: t.signerName ?? '',
                signerTitle: t.signerTitle ?? '',
                logo: t.logo ?? '',
                addrLine: t.addrLine ?? '',
                addrSubdistrict: t.addrSubdistrict ?? '',
                addrDistrict: t.addrDistrict ?? '',
                addrProvince: t.addrProvince ?? '',
                addrPostal: t.addrPostal ?? '',
                banks:
                  banksFromData.length > 0
                    ? banksFromData
                    : [{ ...EMPTY_BANK_ROW }],
                vatRegistered: !!t.vatRegistered,
                vatRate: t.vatRate ?? 7,
                promptPayId: t.promptPayId ?? '',
                promptPayBank: t.promptPayBank ?? '',
                promptPayName: t.promptPayName ?? '',
                notes: t.notes ?? '',
              }
              return (
                <LandlordForm
                  mode='edit'
                  cancelTo='/landlords/$id'
                  defaultValues={defaults}
                  submitting={update.isPending}
                  onSubmit={async (values) => {
                    try {
                      await update.mutateAsync(values)
                      navigate({ to: '/landlords/$id', params: { id } })
                    } catch (err) {
                      if (err instanceof DuplicateTaxIdError) {
                        toast.error('เลขผู้เสียภาษีซ้ำ', {
                          description: `มีอยู่แล้วในชื่อ "${err.conflictName}"`,
                          action: {
                            label: 'ดู',
                            onClick: () =>
                              navigate({
                                to: '/landlords/$id',
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
              )
            })()
          )}
        </div>
      </Main>
    </>
  )
}
