import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PropertyForm } from '@/features/properties/components/property-form'
import { useUpdateProperty } from '@/features/properties/mutations'
import { useProperty } from '@/features/properties/queries'
import {
  PROPERTY_FORM_DEFAULTS,
  type PropertyFormValues,
} from '@/features/properties/schema'
import type { PropertyTypeValue } from '@/features/properties/types'

const VALID_TYPES = new Set<string>([
  'shophouse',
  'land_with_house',
  'vacant_land',
  'rooftop_tower',
  'apartment',
  'other',
])

function coerceType(value: string | undefined): PropertyTypeValue {
  if (value && VALID_TYPES.has(value)) return value as PropertyTypeValue
  return 'other'
}

export function PropertyEdit({ id }: { id: string }) {
  const { data: property, isLoading, error } = useProperty(id)
  const update = useUpdateProperty(id)
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
        {isLoading ? (
          <>
            <Skeleton className='h-12 w-72' />
            <Skeleton className='h-96 w-full' />
          </>
        ) : error || !property ? (
          <>
            <Button variant='ghost' size='sm' asChild className='self-start'>
              <Link to='/properties'>
                <ArrowLeft className='size-4' />
                กลับ
              </Link>
            </Button>
            <Card>
              <CardHeader>
                <CardTitle>ไม่พบทรัพย์สิน</CardTitle>
              </CardHeader>
              <CardContent className='text-sm text-muted-foreground'>
                {error
                  ? `โหลดข้อมูลไม่สำเร็จ — ${error instanceof Error ? error.message : String(error)}`
                  : `ทรัพย์สิน ID ${id} ไม่มีในระบบ`}
              </CardContent>
            </Card>
          </>
        ) : (
          (() => {
            const p = property.data
            // Compose addrLine from v1 sub-parts if v2's addr_line is empty
            const composedLine =
              p.addr_line ??
              [p.addr_no, p.addr_moo, p.addr_soi, p.addr_road]
                .filter(Boolean)
                .join(' ')
            const defaults: PropertyFormValues = {
              ...PROPERTY_FORM_DEFAULTS,
              name: p.name ?? '',
              type: coerceType(p.type),
              location: p.location ?? '',
              addrLine: composedLine,
              addrSubdistrict: p.addr_subdistrict ?? '',
              addrDistrict: p.addr_district ?? '',
              addrProvince: p.addr_province ?? p.province ?? '',
              addrPostal: p.addr_postal ?? '',
              titleDeed: p.titleDeed ?? '',
              area: p.area ?? '',
              owner: p.owner ?? '',
              ownerLandlordId: p.ownerLandlordId ?? '',
              multiTenant: p.multiTenant === true,
              images: (p.images ?? []).filter(Boolean),
            }
            return (
              <>
                <header className='flex items-center gap-3'>
                  <Button variant='ghost' size='icon' asChild>
                    <Link
                      to='/properties/$id'
                      params={{ id }}
                      aria-label='กลับ'
                    >
                      <ArrowLeft className='size-4' />
                    </Link>
                  </Button>
                  <div>
                    <h1 className='text-2xl font-semibold tracking-tight'>
                      แก้ไขทรัพย์สิน
                    </h1>
                    <p className='text-muted-foreground text-sm'>
                      {p.name || `ID: ${id}`}
                    </p>
                  </div>
                </header>

                <div className='max-w-4xl'>
                  <PropertyForm
                    mode='edit'
                    propertyId={id}
                    defaultValues={defaults}
                    cancelTo={`/properties/${id}`}
                    submitting={update.isPending}
                    onSubmit={async (values) => {
                      await update.mutateAsync(values)
                      navigate({
                        to: '/properties/$id',
                        params: { id },
                      })
                    }}
                  />
                </div>
              </>
            )
          })()
        )}
      </Main>
    </>
  )
}
