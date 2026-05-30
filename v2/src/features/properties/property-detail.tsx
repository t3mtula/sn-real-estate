import { Link, useNavigate } from '@tanstack/react-router'
import {
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useConfirm } from '@/hooks/use-confirm'
import { useLandlord } from '@/features/landlords/queries'
import { PropertyForm } from '@/features/properties/components/property-form'
import { PropertyImages } from '@/features/properties/components/property-images'
import {
  useDeleteProperty,
  useUpdateProperty,
} from '@/features/properties/mutations'
import {
  getPropertyAddressFull,
  getPropertyName,
  getPropertyProvince,
  getPropertyTypeLabel,
  useProperty,
} from '@/features/properties/queries'
import { useContractMatchKeys } from '@/lib/queries/contract-match'
import { useContracts, getContractStatus } from '@/features/contracts/queries'
import { useInvoiceStatsByContract } from '@/lib/queries/invoice-stats'
import {
  type ContractRow,
  STATUS_ACCENT_STRIP,
  createContractColumns,
} from '@/features/contracts/contract-columns'
import {
  PROPERTY_FORM_DEFAULTS,
  type PropertyFormValues,
} from '@/features/properties/schema'
import { type PropertyTypeValue } from '@/features/properties/types'
import { BackButton } from '@/components/yonghua/back-button'
import {
  UtilityBadge,
  getPropertyUtilities,
} from '@/features/meters/utility-badge'
import { cn } from '@/lib/utils'

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
            <BackButton fallback='/properties' variant='text' />
            <div className='rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive'>
              โหลดข้อมูลไม่สำเร็จ —{' '}
              {error instanceof Error ? error.message : String(error)}
            </div>
          </>
        ) : !property ? (
          <>
            <BackButton fallback='/properties' variant='text' />
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
    hasWater: p.utilities?.water?.enabled === true,
    waterRate: p.utilities?.water?.ratePerUnit ?? 0,
    hasElectricity: p.utilities?.electricity?.enabled === true,
    electricityRate: p.utilities?.electricity?.ratePerUnit ?? 0,
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
  const typeName = getPropertyTypeLabel(p.type)
  const province = getPropertyProvince(p)
  const address = getPropertyAddressFull(p)
  const { data: ownerLandlord } = useLandlord(p.ownerLandlordId)
  const { data: allContracts } = useContracts()
  const { data: invoiceStats } = useInvoiceStatsByContract()
  const navigate = useNavigate()

  // สัญญาที่ผูกกับทรัพย์นี้ (จับคู่ด้วย pid) · augment สถานะ + ยอดค้าง
  // default order: ค้างชำระมากสุดอยู่บน → ใช้งานก่อนยกเลิก → สิ้นสุดล่าสุดก่อน
  const contractRows = useMemo<ContractRow[]>(() => {
    if (!allContracts) return []
    const pid = p?.pid ?? Number.parseInt(property.id, 10)
    const n = Number(pid)
    if (Number.isNaN(n)) return []
    const matched = allContracts.filter((c) => {
      const a = c.data?.pid_property
      const b = (c.data as { pid?: number })?.pid
      return Number(a) === n || Number(b) === n
    })
    const augmented: ContractRow[] = matched.map((c) => ({
      ...c,
      _status: getContractStatus(c.data),
      _overdueCount: invoiceStats?.get(c.id)?.overdueCount ?? 0,
      _overdueAmount: invoiceStats?.get(c.id)?.overdueAmount ?? 0,
      _building: '',
    }))
    return augmented.sort((a, b) => {
      const aHasDebt = a._overdueAmount > 0 ? 1 : 0
      const bHasDebt = b._overdueAmount > 0 ? 1 : 0
      if (aHasDebt !== bHasDebt) return bHasDebt - aHasDebt
      if (b._overdueAmount !== a._overdueAmount)
        return b._overdueAmount - a._overdueAmount
      const aActive = a.data?.cancelled ? 1 : 0
      const bActive = b.data?.cancelled ? 1 : 0
      if (aActive !== bActive) return aActive - bActive
      return (b.data?.end ?? '').localeCompare(a.data?.end ?? '')
    })
  }, [allContracts, invoiceStats, p?.pid, property.id])

  // คอลัมน์ใช้ชุดกลางตัวเดียวกับหน้า "สัญญาเช่า" — โชว์ น้ำ/ไฟ แทนคอลัมน์ทรัพย์
  // (ทรัพย์ซ้ำกับหน้าที่เปิดอยู่) · ปิด select/landlord/แก้ล่าสุด/ปุ่ม preview
  const contractColumns = useMemo(
    () => createContractColumns({ utilities: true }),
    [],
  )
  const [contractSorting, setContractSorting] = useState<SortingState>([])
  const contractTable = useReactTable({
    data: contractRows,
    columns: contractColumns,
    state: { sorting: contractSorting },
    getRowId: (row) => row.id,
    onSortingChange: setContractSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <>
      <header className='flex flex-wrap items-start justify-between gap-3'>
        <div className='flex items-start gap-3'>
          <BackButton fallback='/properties' />
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
              {(() => {
                const u = getPropertyUtilities(p)
                return (
                  <>
                    {u.water && (
                      <UtilityBadge kind='water' enabled rate={u.waterRate} />
                    )}
                    {u.electricity && (
                      <UtilityBadge
                        kind='electricity'
                        enabled
                        rate={u.electricityRate}
                      />
                    )}
                  </>
                )
              })()}
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

        <div className='space-y-6'>
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

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>
                รูปภาพ ({p.images?.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PropertyImages images={p.images ?? []} alt={getPropertyName(p)} />
            </CardContent>
          </Card>
        </div>

        <Card className='lg:col-span-3'>
          <CardHeader>
            <CardTitle className='text-base'>
              สัญญาเช่าที่เกี่ยวข้อง ({contractRows.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contractRows.length === 0 ? (
              <p className='text-sm text-muted-foreground'>
                ยังไม่มีสัญญาเช่าผูกกับทรัพย์สินนี้
              </p>
            ) : (
              <div className='overflow-x-auto rounded-md border'>
                <Table className='min-w-[720px]'>
                  <TableHeader>
                    {contractTable.getHeaderGroups().map((headerGroup) => (
                      <TableRow
                        key={headerGroup.id}
                        className='hover:bg-transparent'
                      >
                        {headerGroup.headers.map((header) => (
                          <TableHead
                            key={header.id}
                            className='text-xs uppercase tracking-wider'
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                )}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {contractTable.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        className={cn(
                          'cursor-pointer hover:bg-muted/40',
                          STATUS_ACCENT_STRIP[row.original._status] ??
                            'border-l-2 border-l-transparent',
                        )}
                        onClick={() =>
                          navigate({
                            to: '/contracts/$id',
                            params: { id: row.original.id },
                          })
                        }
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className='py-3'>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
