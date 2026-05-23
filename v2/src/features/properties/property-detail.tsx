import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  Building2,
  Landmark,
  MapPin,
  Pencil,
  Ruler,
  ScrollText,
  Trash2,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useConfirm } from '@/hooks/use-confirm'
import { useLandlord } from '@/features/landlords/queries'
import { PropertyForm } from '@/features/properties/components/property-form'
import { PropertyImages } from '@/features/properties/components/property-images'
import {
  useDeleteProperty,
  useUpdateProperty,
} from '@/features/properties/mutations'
import {
  getPropertyAddressShort,
  getPropertyName,
  getPropertyProvince,
  useProperty,
} from '@/features/properties/queries'
import { useContractMatchKeys } from '@/lib/queries/contract-match'
import {
  PROPERTY_FORM_DEFAULTS,
  type PropertyFormValues,
} from '@/features/properties/schema'
import { PROPERTY_TYPES, type PropertyTypeValue } from '@/features/properties/types'

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  PROPERTY_TYPES.map((t) => [t.value, t.label])
)

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

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | undefined
}) {
  return (
    <div className='flex gap-3'>
      <div className='mt-0.5'>
        <Icon className='size-4 text-muted-foreground' />
      </div>
      <div className='min-w-0 flex-1'>
        <p className='text-xs uppercase tracking-wider text-muted-foreground'>
          {label}
        </p>
        <p className='text-sm'>{value?.trim() || '—'}</p>
      </div>
    </div>
  )
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    const d = new Date(value)
    const beYear = d.getFullYear() + 543
    const month = d.toLocaleDateString('th-TH', { month: 'short' })
    const day = d.getDate()
    return `${day} ${month} ${String(beYear).slice(2)}`
  } catch {
    return '—'
  }
}

export function PropertyDetail({ id }: { id: string }) {
  const { data: property, isLoading, error } = useProperty(id)
  const { data: contractKeys } = useContractMatchKeys()
  const del = useDeleteProperty()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)

  const linkedCount = useMemo(() => {
    if (!property || !contractKeys) return 0
    const pid = property.data?.pid ?? Number.parseInt(property.id, 10)
    const n = Number(pid)
    if (Number.isNaN(n)) return 0
    return contractKeys.filter((c) => {
      const cpid = c.data?.pid_property ?? c.data?.pid
      return cpid != null && Number(cpid) === n
    }).length
  }, [property, contractKeys])

  async function handleDelete() {
    if (!property) return
    const name = getPropertyName(property.data)
    const ok = await confirm({
      title: `ลบทรัพย์สิน "${name}"?`,
      description:
        linkedCount > 0
          ? `ทรัพย์สินนี้มี ${linkedCount} สัญญาผูกอยู่ · ลบแล้วสัญญายังอยู่แต่จะหาทรัพย์ไม่เจอ`
          : 'ลบแล้วเรียกคืนไม่ได้',
      confirmLabel: 'ลบ',
      destructive: true,
    })
    if (!ok) return
    try {
      await del.mutateAsync(property.id)
      toast.success('ลบทรัพย์สินแล้ว')
      navigate({ to: '/properties' })
    } catch (err) {
      toast.error('ลบไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

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
            <Skeleton className='h-64 w-full' />
          </>
        ) : error ? (
          <>
            <Button variant='ghost' size='sm' asChild className='self-start'>
              <Link to='/properties'>
                <ArrowLeft className='size-4' />
                กลับ
              </Link>
            </Button>
            <div className='rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive'>
              โหลดข้อมูลไม่สำเร็จ —{' '}
              {error instanceof Error ? error.message : String(error)}
            </div>
          </>
        ) : !property ? (
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
                ทรัพย์สิน ID{' '}
                <code className='rounded bg-muted px-1.5 py-0.5'>{id}</code>{' '}
                ไม่มีในระบบ
              </CardContent>
            </Card>
          </>
        ) : isEditing ? (
          <PropertyEditing
            property={property}
            onDone={() => setIsEditing(false)}
          />
        ) : (
          <PropertyContent
            property={property}
            onEdit={() => setIsEditing(true)}
            onDelete={handleDelete}
            deleting={del.isPending}
          />
        )}
      </Main>
    </>
  )
}

function PropertyEditing({
  property,
  onDone,
}: {
  property: NonNullable<ReturnType<typeof useProperty>['data']>
  onDone: () => void
}) {
  const update = useUpdateProperty(property.id)
  const p = property.data
  const composedLine =
    p.addr_line ??
    [p.addr_no, p.addr_moo, p.addr_soi, p.addr_road].filter(Boolean).join(' ')
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
        <h1 className='text-2xl font-semibold tracking-tight'>
          แก้ไขทรัพย์สิน
        </h1>
        <p className='text-sm text-muted-foreground'>
          {p.name || `ID: ${property.id}`}
        </p>
      </header>
      <PropertyForm
        mode='edit'
        propertyId={property.id}
        defaultValues={defaults}
        submitting={update.isPending}
        onCancel={onDone}
        onSubmit={async (values) => {
          await update.mutateAsync(values)
          onDone()
        }}
      />
    </>
  )
}

function PropertyContent({
  property,
  onEdit,
  onDelete,
  deleting,
}: {
  property: NonNullable<ReturnType<typeof useProperty>['data']>
  onEdit: () => void
  onDelete: () => Promise<void>
  deleting: boolean
}) {
  const p = property.data
  const typeName = p.type ? (TYPE_LABEL[p.type] ?? p.type) : '—'
  const province = getPropertyProvince(p)
  const address = getPropertyAddressShort(p)
  const { data: ownerLandlord } = useLandlord(p.ownerLandlordId)

  return (
    <>
      <header className='flex flex-wrap items-start justify-between gap-3'>
        <div className='flex items-start gap-3'>
          <Button variant='ghost' size='icon' asChild className='mt-0.5'>
            <Link to='/properties' aria-label='กลับ'>
              <ArrowLeft className='size-4' />
            </Link>
          </Button>
          <div className='min-w-0'>
            <div className='flex flex-wrap items-center gap-2'>
              <h1 className='text-2xl font-semibold tracking-tight'>
                {getPropertyName(p)}
              </h1>
              <Badge variant='secondary' className='font-normal'>
                {typeName}
              </Badge>
              {p.multiTenant && (
                <Badge
                  variant='outline'
                  className='border-accent/40 bg-accent/10 font-normal text-accent'
                >
                  <Users className='size-3' />
                  หลายผู้เช่า
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            onClick={onDelete}
            disabled={deleting}
            className='text-destructive hover:bg-destructive/10 hover:text-destructive'
          >
            <Trash2 className='size-4' />
            ลบ
          </Button>
          <Button onClick={onEdit}>
            <Pencil className='size-4' />
            แก้ไข
          </Button>
        </div>
      </header>

      <div className='grid gap-6 lg:grid-cols-3'>
        <Card className='lg:col-span-2'>
          <CardHeader>
            <CardTitle className='text-base'>ข้อมูลทรัพย์สิน</CardTitle>
          </CardHeader>
          <CardContent className='grid gap-5 sm:grid-cols-2'>
            <InfoRow icon={Building2} label='ประเภท' value={typeName} />
            <InfoRow icon={MapPin} label='จังหวัด' value={province} />
            <div className='sm:col-span-2'>
              <InfoRow icon={MapPin} label='ที่อยู่' value={address} />
            </div>
            <InfoRow icon={Ruler} label='เนื้อที่' value={p.area} />
            <div>
              <div className='flex gap-3'>
                <div className='mt-0.5'>
                  <Landmark className='size-4 text-muted-foreground' />
                </div>
                <div className='min-w-0 flex-1'>
                  <p className='text-xs uppercase tracking-wider text-muted-foreground'>
                    ผู้ให้เช่า (เจ้าของในระบบ)
                  </p>
                  {ownerLandlord ? (
                    <Link
                      to='/landlords/$id'
                      params={{ id: ownerLandlord.id }}
                      className='text-sm text-primary underline-offset-4 hover:underline'
                    >
                      {ownerLandlord.data?.name ?? '(ไม่มีชื่อ)'}
                    </Link>
                  ) : (
                    <p className='text-sm text-muted-foreground'>
                      {p.owner?.trim() || '—'}
                    </p>
                  )}
                </div>
              </div>
            </div>
            {(() => {
              const ownerNote = p.owner?.trim() ?? ''
              if (!ownerNote || !ownerLandlord) return null
              const lname = (ownerLandlord.data?.name ?? '').trim()
              const sname = (ownerLandlord.data?.shortName ?? '').trim()
              if (ownerNote === lname || (sname && ownerNote === sname)) return null
              return (
                <InfoRow icon={Users} label='เจ้าของอื่น (หมายเหตุ)' value={ownerNote} />
              )
            })()}
            <div className='sm:col-span-2'>
              <InfoRow
                icon={ScrollText}
                label='เลขโฉนด / รายละเอียดที่ดิน'
                value={p.titleDeed}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>ข้อมูลระบบ</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3 text-sm'>
            <div className='flex justify-between gap-3'>
              <span className='text-muted-foreground'>เพิ่มเมื่อ</span>
              <span className='font-medium'>
                {formatDate(property.created_at)}
              </span>
            </div>
            <div className='flex justify-between gap-3'>
              <span className='text-muted-foreground'>แก้ไขล่าสุด</span>
              <span className='font-medium'>
                {formatDate(property.updated_at)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className='lg:col-span-3'>
          <CardHeader>
            <CardTitle className='text-base'>
              รูปภาพ ({p.images?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PropertyImages images={p.images ?? []} alt={getPropertyName(p)} />
          </CardContent>
        </Card>

        <Card className='lg:col-span-3'>
          <CardHeader>
            <CardTitle className='text-base'>สัญญาเช่าที่เกี่ยวข้อง</CardTitle>
          </CardHeader>
          <CardContent className='text-sm text-muted-foreground'>
            <p>
              จะแสดงสัญญาที่เชื่อมกับทรัพย์สินนี้ใน{' '}
              <span className='font-medium text-foreground'>Phase 1B</span> ·
              ตอนนี้ยังไม่ build feature สัญญา
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
