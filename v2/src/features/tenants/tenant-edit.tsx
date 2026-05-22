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
import { TenantForm } from '@/features/tenants/components/tenant-form'
import { useTenant } from '@/features/tenants/queries'
import { DuplicateTaxIdError, useUpdateTenant } from '@/features/tenants/mutations'
import {
  TENANT_FORM_DEFAULTS,
  type TenantFormValues,
} from '@/features/tenants/schema'

export function TenantEdit({ id }: { id: string }) {
  const tenant = useTenant(id)
  const update = useUpdateTenant(id)
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
            <Link to='/tenants/$id' params={{ id }} aria-label='กลับ'>
              <ArrowLeft className='size-4' />
            </Link>
          </Button>
          <div>
            <h1 className='text-2xl font-semibold tracking-tight'>
              แก้ไขข้อมูลผู้เช่า
            </h1>
            <p className='text-muted-foreground text-sm'>
              {tenant.data?.data?.name ?? 'กำลังโหลด...'}
            </p>
          </div>
        </header>

        <div className='max-w-4xl'>
          {tenant.isLoading ? (
            <Skeleton className='h-96 w-full' />
          ) : !tenant.data ? (
            <Card>
              <CardHeader>
                <CardTitle>ไม่พบผู้เช่า</CardTitle>
              </CardHeader>
              <CardContent className='text-sm text-muted-foreground'>
                ผู้เช่า ID{' '}
                <code className='rounded bg-muted px-1.5 py-0.5'>{id}</code> ไม่มีในระบบ
              </CardContent>
            </Card>
          ) : (
            (() => {
              const t = tenant.data.data
              const defaults: TenantFormValues = {
                ...TENANT_FORM_DEFAULTS,
                name: t.name ?? '',
                partyType: t.partyType === 'company' ? 'company' : 'person',
                taxId: t.taxId ?? '',
                branch: t.branch ?? '00000',
                phone: t.phone ?? '',
                signerName: t.signerName ?? '',
                signerTitle: t.signerTitle ?? '',
                addrLine: t.addrLine ?? '',
                addrSubdistrict: t.addrSubdistrict ?? '',
                addrDistrict: t.addrDistrict ?? '',
                addrProvince: t.addrProvince ?? '',
                addrPostal: t.addrPostal ?? '',
              }
              return (
                <TenantForm
                  mode='edit'
                  cancelTo='/tenants/$id'
                  defaultValues={defaults}
                  submitting={update.isPending}
                  onSubmit={async (values) => {
                    try {
                      await update.mutateAsync(values)
                      navigate({ to: '/tenants/$id', params: { id } })
                    } catch (err) {
                      if (err instanceof DuplicateTaxIdError) {
                        toast.error('เลขผู้เสียภาษีซ้ำ', {
                          description: `มีอยู่แล้วในชื่อ "${err.conflictName}"`,
                          action: {
                            label: 'ดู',
                            onClick: () =>
                              navigate({
                                to: '/tenants/$id',
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
